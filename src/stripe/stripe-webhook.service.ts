import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { SupabaseService } from '../database/supabase.service';
import { RefundsService } from '../refunds/refunds.service';
import { DisputesService } from '../disputes/disputes.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly refunds: RefundsService,
    private readonly disputes: DisputesService,
  ) {}

  /**
   * Idempotently records the event then dispatches to the typed handler.
   * Returns true if the event was newly processed, false if it was already recorded.
   */
  async handle(event: Stripe.Event): Promise<boolean> {
    const client = this.supabase.getClient();

    const { data: inserted, error: insertErr } = await client
      .from('stripe_webhook_events')
      .insert({ id: event.id, type: event.type, payload: event as any })
      .select('id')
      .maybeSingle();

    if (insertErr) {
      const code = (insertErr as { code?: string }).code;
      if (code === '23505') {
        // duplicate primary key — already processed
        return false;
      }
      this.logger.error(`Failed to record webhook event ${event.id}: ${insertErr.message}`);
      throw insertErr;
    }
    if (!inserted) return false;

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'charge.refunded':
          await this.onChargeRefunded(event.data.object as Stripe.Charge);
          break;
        case 'charge.dispute.created':
        case 'charge.dispute.updated':
        case 'charge.dispute.closed':
          await this.disputes.upsertFromStripe(event.data.object as Stripe.Dispute);
          break;
        default:
          this.logger.log(`Unhandled Stripe event type ${event.type} (${event.id})`);
      }
      await client
        .from('stripe_webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', event.id);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook handler failed for ${event.id}: ${message}`);
      await client
        .from('stripe_webhook_events')
        .update({ processing_error: message })
        .eq('id', event.id);
      throw err;
    }
  }

  // -- Handlers ---------------------------------------------------------

  /**
   * Sync-confirm in createOrder normally promotes the order to 'paid' before this webhook fires.
   * We act as a backstop for the 3DS-via-webhook path; the WHERE filter prevents double-writes.
   */
  private async onPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
    const chargeId =
      typeof pi.latest_charge === 'string'
        ? pi.latest_charge
        : pi.latest_charge?.id ?? null;
    const client = this.supabase.getClient();
    const updates: Record<string, unknown> = {
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
    };
    if (chargeId) updates.stripe_charge_id = chargeId;
    await client
      .from('orders')
      .update(updates)
      .eq('stripe_payment_intent_id', pi.id)
      .eq('payment_status', 'pending');
  }

  private async onPaymentIntentFailed(pi: Stripe.PaymentIntent) {
    await this.supabase
      .getClient()
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('stripe_payment_intent_id', pi.id)
      .eq('payment_status', 'pending');
  }

  /**
   * charge.refunded fires for any refund (cumulative). We walk the charge.refunds.data and
   * promote each pending row in our refunds table to succeeded/failed via RefundsService.
   */
  private async onChargeRefunded(charge: Stripe.Charge) {
    const refunds = charge.refunds?.data ?? [];
    for (const refund of refunds) {
      if (refund.status === 'succeeded') {
        await this.refunds.markRefundSucceededByStripeId(
          refund.id,
          typeof charge.id === 'string' ? charge.id : null,
        );
      } else if (refund.status === 'failed' || refund.status === 'canceled') {
        await this.refunds.markRefundFailedByStripeId(
          refund.id,
          refund.failure_reason || 'Stripe refund failed',
        );
      }
    }
  }
}
