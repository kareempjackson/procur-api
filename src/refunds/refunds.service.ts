import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { SupabaseService } from '../database/supabase.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentEventTypes } from '../events/event-types';
import { StripeService } from '../stripe/stripe.service';
import { CreditNoteService } from './credit-note.service';
import {
  RefundMethod,
  RefundReasonCode,
  RefundResponse,
  RefundStatus,
} from './dto/refund.dto';

interface OrderRow {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  buyer_org_id: string;
  parent_order_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: string | number;
  currency: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  refunded_amount_cents: number;
}

interface IssueRefundInput {
  orderId: string;
  amountCents: number;
  reason: string;
  reasonCode: RefundReasonCode;
  refundMethod: RefundMethod;
  initiatedBy: { userId: string | null; role: 'admin' | 'buyer' | 'system' };
  notifyBuyer: boolean;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stripe: StripeService,
    private readonly email: EmailService,
    private readonly creditNote: CreditNoteService,
    private readonly notifications: NotificationsService,
  ) {}

  // -- Public entrypoints ------------------------------------------------

  async issueRefund(input: IssueRefundInput): Promise<RefundResponse> {
    const order = await this.loadOrder(input.orderId);

    if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
      throw new BadRequestException(
        `Order ${input.orderId} is not in a refundable state (payment_status=${order.payment_status})`,
      );
    }

    const parent = order.parent_order_id
      ? await this.loadOrder(order.parent_order_id)
      : order;

    if (input.refundMethod === RefundMethod.CARD) {
      if (order.payment_method !== 'credit_card') {
        throw new BadRequestException(
          'Cannot refund offline order to card. Use buyer_credit instead.',
        );
      }
      if (!parent.stripe_payment_intent_id) {
        throw new BadRequestException(
          'Order has no Stripe PaymentIntent on record',
        );
      }
    }

    const orderTotalCents = Math.round(Number(order.total_amount) * 100);
    if (orderTotalCents <= 0) {
      throw new BadRequestException('Order total is not refundable');
    }
    const remainingCents = orderTotalCents - (order.refunded_amount_cents ?? 0);
    if (input.amountCents > remainingCents) {
      throw new BadRequestException(
        `Refund amount ${input.amountCents} cents exceeds remaining refundable ${remainingCents} cents`,
      );
    }

    const refundNumber = this.generateNumber('RFD');
    const creditNoteNumber = this.generateNumber('CN');
    const currency = (order.currency || 'USD').toUpperCase();

    const client = this.supabase.getClient();
    const { data: insertedRefund, error: insertErr } = await client
      .from('refunds')
      .insert({
        order_id: order.id,
        parent_order_id: order.parent_order_id,
        refund_number: refundNumber,
        credit_note_number: creditNoteNumber,
        amount_cents: input.amountCents,
        currency,
        reason: input.reason,
        reason_code: input.reasonCode,
        refund_method: input.refundMethod,
        status: 'pending',
        stripe_payment_intent_id: parent.stripe_payment_intent_id,
        initiated_by_user_id: input.initiatedBy.userId,
        initiated_by_role: input.initiatedBy.role,
        notify_buyer: input.notifyBuyer,
        metadata: {
          parent_total_cents: Math.round(Number(parent.total_amount) * 100),
          remaining_before_cents: remainingCents,
        },
      })
      .select('*')
      .single();
    if (insertErr || !insertedRefund) {
      throw new BadRequestException(
        `Failed to create refund row: ${insertErr?.message}`,
      );
    }
    const refundId = insertedRefund.id as string;

    let stripeRefund: Stripe.Refund | null = null;
    let succeededAt: string | null = null;

    try {
      if (input.refundMethod === RefundMethod.CARD) {
        stripeRefund = await this.stripe.createRefund({
          paymentIntentId: parent.stripe_payment_intent_id!,
          amountCents: input.amountCents,
          reason: this.mapStripeReasonCode(input.reasonCode),
          metadata: {
            order_id: order.id,
            refund_id: refundId,
            credit_note_number: creditNoteNumber,
            initiated_by: input.initiatedBy.role,
          },
          idempotencyKey: `refund:${refundId}`,
        });

        const stripeStatus = stripeRefund.status;
        const dbStatus =
          stripeStatus === 'succeeded'
            ? 'succeeded'
            : stripeStatus === 'failed' || stripeStatus === 'canceled'
            ? 'failed'
            : 'pending';
        if (dbStatus === 'succeeded') succeededAt = new Date().toISOString();

        await client
          .from('refunds')
          .update({
            stripe_refund_id: stripeRefund.id,
            status: dbStatus,
            ...(dbStatus === 'succeeded' && { succeeded_at: succeededAt }),
            ...(dbStatus === 'failed' && {
              failed_at: new Date().toISOString(),
              failure_reason:
                stripeRefund.failure_reason || 'Stripe refund failed',
            }),
          })
          .eq('id', refundId);
      } else {
        // buyer_credit — synchronous: increase the buyer credit balance.
        const { error: rpcErr } = await client.rpc('adjust_buyer_credit', {
          p_buyer_org_id: order.buyer_org_id,
          p_amount_cents: input.amountCents,
          p_type: 'refund',
          p_reason: 'order_refund',
          p_note: `Refund ${refundNumber} for order ${order.order_number}`,
          p_order_id: order.id,
          p_admin_user_id: input.initiatedBy.userId,
        });
        if (rpcErr) {
          throw new BadRequestException(
            `Failed to credit buyer balance: ${rpcErr.message}`,
          );
        }
        succeededAt = new Date().toISOString();
        await client
          .from('refunds')
          .update({ status: 'succeeded', succeeded_at: succeededAt })
          .eq('id', refundId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Refund ${refundId} failed: ${message}`);
      await client
        .from('refunds')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: message,
        })
        .eq('id', refundId);
      throw new BadRequestException(`Refund failed: ${message}`);
    }

    // Update parent order's running refund total + status flag.
    await this.applyRefundToParentOrder(parent.id, input.amountCents);

    // Buyer-settlement transactions row.
    await this.recordRefundTransaction({
      order,
      parent,
      refundId,
      refundNumber,
      amountCents: input.amountCents,
      currency,
      stripeChargeId:
        typeof stripeRefund?.charge === 'string' ? stripeRefund.charge : null,
      method: input.refundMethod,
      status: succeededAt ? 'completed' : 'pending',
    });

    // Order timeline entry.
    await client.from('order_timeline').insert({
      order_id: order.id,
      event_type: 'refund_initiated',
      title: `Refund ${refundNumber} issued`,
      description: input.reason,
      actor_user_id: input.initiatedBy.userId,
      actor_type: input.initiatedBy.role,
      metadata: {
        refund_id: refundId,
        amount_cents: input.amountCents,
        method: input.refundMethod,
        reason_code: input.reasonCode,
      },
    });

    // Best-effort downstream notification fanout.
    try {
      await this.notifications.emitEvent({
        eventType: PaymentEventTypes.REFUND_INITIATED,
        actorUserId: input.initiatedBy.userId ?? undefined,
        organizationId: order.buyer_org_id,
        payload: {
          order_id: order.id,
          parent_order_id: parent.id,
          refund_id: refundId,
          refund_number: refundNumber,
          credit_note_number: creditNoteNumber,
          amount_cents: input.amountCents,
          currency,
          method: input.refundMethod,
        },
        dedupeKey: `refund:${refundId}:initiated`,
      });
    } catch (err) {
      this.logger.warn(`Failed to emit REFUND_INITIATED event: ${err}`);
    }

    // Email the buyer (best-effort; failures are logged but don't roll back the refund).
    if (input.notifyBuyer) {
      try {
        await this.emailRefundConfirmation(
          order,
          parent,
          refundId,
          refundNumber,
          creditNoteNumber,
          input.amountCents,
          currency,
          input.refundMethod,
          input.reason,
          input.reasonCode,
          succeededAt ? new Date(succeededAt) : new Date(),
        );
      } catch (err) {
        this.logger.error(`Failed to send refund confirmation email: ${err}`);
      }
    }

    return this.toResponse(refundId);
  }

  async listForOrder(orderId: string): Promise<RefundResponse[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('refunds')
      .select('*')
      .or(`order_id.eq.${orderId},parent_order_id.eq.${orderId}`)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []).map((r) => this.mapRow(r));
  }

  async getRefund(orderId: string, refundId: string): Promise<RefundResponse> {
    const row = await this.loadRefund(refundId);
    if (row.order_id !== orderId && row.parent_order_id !== orderId) {
      throw new NotFoundException(`Refund ${refundId} not found on order ${orderId}`);
    }
    return this.mapRow(row);
  }

  async retryFailedCardRefund(refundId: string): Promise<RefundResponse> {
    const row = await this.loadRefund(refundId);
    if (row.refund_method !== 'card') {
      throw new BadRequestException('Only card refunds can be retried');
    }
    if (row.status !== 'failed') {
      throw new ConflictException(
        `Refund ${refundId} is in status '${row.status}', only failed refunds can be retried`,
      );
    }
    if (!row.stripe_payment_intent_id) {
      throw new BadRequestException('Refund has no Stripe PaymentIntent on record');
    }
    const newIdempotencyKey = `refund:${refundId}:retry:${randomUUID().slice(0, 8)}`;

    try {
      const stripeRefund = await this.stripe.createRefund({
        paymentIntentId: row.stripe_payment_intent_id,
        amountCents: row.amount_cents,
        reason: this.mapStripeReasonCode(row.reason_code as RefundReasonCode),
        metadata: { order_id: row.order_id, refund_id: refundId, retry: 'true' },
        idempotencyKey: newIdempotencyKey,
      });
      const dbStatus =
        stripeRefund.status === 'succeeded'
          ? 'succeeded'
          : stripeRefund.status === 'failed' || stripeRefund.status === 'canceled'
          ? 'failed'
          : 'pending';
      const succeededAt = dbStatus === 'succeeded' ? new Date().toISOString() : null;
      await this.supabase
        .getClient()
        .from('refunds')
        .update({
          stripe_refund_id: stripeRefund.id,
          status: dbStatus,
          failure_reason: dbStatus === 'failed' ? stripeRefund.failure_reason : null,
          succeeded_at: succeededAt,
          failed_at: dbStatus === 'failed' ? new Date().toISOString() : null,
        })
        .eq('id', refundId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.supabase
        .getClient()
        .from('refunds')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: message,
        })
        .eq('id', refundId);
      throw new BadRequestException(`Retry failed: ${message}`);
    }

    return this.toResponse(refundId);
  }

  async resendEmail(refundId: string, override?: string): Promise<void> {
    const row = await this.loadRefund(refundId);
    const order = await this.loadOrder(row.order_id);
    const parent = order.parent_order_id
      ? await this.loadOrder(order.parent_order_id)
      : order;

    const recipient = override || (await this.resolveBuyerEmail(order.buyer_org_id));
    if (!recipient) {
      throw new BadRequestException('No recipient email available for buyer organization');
    }

    await this.emailRefundConfirmation(
      order,
      parent,
      refundId,
      row.refund_number,
      row.credit_note_number,
      row.amount_cents,
      row.currency,
      row.refund_method as RefundMethod,
      row.reason,
      row.reason_code as RefundReasonCode,
      row.succeeded_at ? new Date(row.succeeded_at) : new Date(),
      recipient,
    );

    await this.supabase
      .getClient()
      .from('refunds')
      .update({ buyer_notified_at: new Date().toISOString() })
      .eq('id', refundId);
  }

  // -- Webhook reconciliation --------------------------------------------

  async markRefundSucceededByStripeId(stripeRefundId: string, chargeId: string | null) {
    const client = this.supabase.getClient();
    const { data: refund } = await client
      .from('refunds')
      .select('id, status, order_id, parent_order_id, refund_number')
      .eq('stripe_refund_id', stripeRefundId)
      .maybeSingle();
    if (!refund || refund.status === 'succeeded') return;

    await client
      .from('refunds')
      .update({ status: 'succeeded', succeeded_at: new Date().toISOString() })
      .eq('id', refund.id)
      .eq('status', 'pending');

    // Promote linked transactions row to completed.
    await client
      .from('transactions')
      .update({ status: 'completed', settled_at: new Date().toISOString() })
      .eq('payment_reference', refund.refund_number)
      .eq('status', 'pending');

    if (chargeId) {
      await client
        .from('orders')
        .update({ stripe_charge_id: chargeId })
        .or(`id.eq.${refund.order_id},id.eq.${refund.parent_order_id ?? refund.order_id}`)
        .is('stripe_charge_id', null);
    }

    try {
      await this.notifications.emitEvent({
        eventType: PaymentEventTypes.REFUND_COMPLETED,
        organizationId: undefined,
        payload: {
          refund_id: refund.id,
          order_id: refund.order_id,
          parent_order_id: refund.parent_order_id,
          refund_number: refund.refund_number,
        },
        dedupeKey: `refund:${refund.id}:completed`,
      });
    } catch (err) {
      this.logger.warn(`Failed to emit REFUND_COMPLETED event: ${err}`);
    }
  }

  async markRefundFailedByStripeId(stripeRefundId: string, failureReason: string) {
    const { error } = await this.supabase
      .getClient()
      .from('refunds')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: failureReason,
      })
      .eq('stripe_refund_id', stripeRefundId)
      .eq('status', 'pending');
    if (error) this.logger.error(error.message);
  }

  // -- Helpers -----------------------------------------------------------

  private async loadOrder(orderId: string): Promise<OrderRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from('orders')
      .select(
        'id, order_number, invoice_number, buyer_org_id, parent_order_id, payment_method, payment_status, total_amount, currency, stripe_payment_intent_id, stripe_charge_id, refunded_amount_cents',
      )
      .eq('id', orderId)
      .single();
    if (error || !data) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return data as OrderRow;
  }

  private async loadRefund(refundId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .single();
    if (error || !data) {
      throw new NotFoundException(`Refund ${refundId} not found`);
    }
    return data;
  }

  private async applyRefundToParentOrder(parentOrderId: string, amountCents: number) {
    const client = this.supabase.getClient();
    const { data: parent } = await client
      .from('orders')
      .select('id, total_amount, refunded_amount_cents')
      .eq('id', parentOrderId)
      .single();
    if (!parent) return;
    const totalCents = Math.round(Number(parent.total_amount) * 100);
    const newRefundedCents = (parent.refunded_amount_cents ?? 0) + amountCents;
    const nextStatus =
      newRefundedCents >= totalCents ? 'refunded' : 'partially_refunded';
    await client
      .from('orders')
      .update({
        refunded_amount_cents: newRefundedCents,
        last_refunded_at: new Date().toISOString(),
        payment_status: nextStatus,
      })
      .eq('id', parentOrderId);

    // Cascade payment_status to children of multi-seller carts so seller views agree.
    await client
      .from('orders')
      .update({ payment_status: nextStatus })
      .eq('parent_order_id', parentOrderId);
  }

  private async recordRefundTransaction(opts: {
    order: OrderRow;
    parent: OrderRow;
    refundId: string;
    refundNumber: string;
    amountCents: number;
    currency: string;
    stripeChargeId: string | null;
    method: RefundMethod;
    status: 'pending' | 'completed';
  }) {
    const sellerOrgId = await this.resolveSellerOrgIdForOrder(opts.order);

    const transactionNumber = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    await this.supabase
      .getClient()
      .from('transactions')
      .insert({
        transaction_number: transactionNumber,
        order_id: opts.order.id,
        seller_org_id: sellerOrgId,
        buyer_org_id: opts.order.buyer_org_id,
        type: 'refund',
        status: opts.status,
        amount: -(opts.amountCents / 100),
        currency: opts.currency,
        payment_method:
          opts.method === RefundMethod.CARD ? 'credit_card' : 'buyer_credit',
        payment_reference: opts.refundNumber,
        gateway_transaction_id: opts.stripeChargeId,
        description: `Refund ${opts.refundNumber} on order ${opts.order.order_number}`,
        metadata: {
          refund_id: opts.refundId,
          order_id: opts.order.id,
          parent_order_id: opts.parent.id,
        },
        processed_at: new Date().toISOString(),
        ...(opts.status === 'completed' && {
          settled_at: new Date().toISOString(),
        }),
      });
  }

  private async resolveSellerOrgIdForOrder(order: OrderRow): Promise<string> {
    // Parent rows of multi-seller carts have seller_org_id NULL. Use the first child.
    const { data } = await this.supabase
      .getClient()
      .from('orders')
      .select('seller_org_id, parent_order_id')
      .eq('id', order.id)
      .single();
    if (data?.seller_org_id) return data.seller_org_id as string;

    const { data: anyChild } = await this.supabase
      .getClient()
      .from('orders')
      .select('seller_org_id')
      .eq('parent_order_id', order.id)
      .not('seller_org_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (anyChild?.seller_org_id) return anyChild.seller_org_id as string;

    // Fallback: any seller in the system to satisfy the NOT NULL FK. This shouldn't normally hit.
    throw new BadRequestException(
      'Unable to resolve a seller organization for the refund transaction',
    );
  }

  private generateNumber(prefix: 'RFD' | 'CN'): string {
    const now = new Date();
    const stamp =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, '0') +
      String(now.getUTCDate()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${stamp}-${random}`;
  }

  private mapStripeReasonCode(
    code: RefundReasonCode,
  ): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
    if (code === RefundReasonCode.DUPLICATE) return 'duplicate';
    if (code === RefundReasonCode.FRAUDULENT) return 'fraudulent';
    return 'requested_by_customer';
  }

  private async toResponse(refundId: string): Promise<RefundResponse> {
    const row = await this.loadRefund(refundId);
    return this.mapRow(row);
  }

  private mapRow(row: any): RefundResponse {
    return {
      id: row.id,
      order_id: row.order_id,
      parent_order_id: row.parent_order_id,
      refund_number: row.refund_number,
      credit_note_number: row.credit_note_number,
      amount_cents: row.amount_cents,
      currency: row.currency,
      reason: row.reason,
      reason_code: row.reason_code,
      refund_method: row.refund_method,
      status: row.status,
      stripe_refund_id: row.stripe_refund_id,
      stripe_payment_intent_id: row.stripe_payment_intent_id,
      initiated_by_role: row.initiated_by_role,
      notify_buyer: row.notify_buyer,
      buyer_notified_at: row.buyer_notified_at,
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      succeeded_at: row.succeeded_at,
      failed_at: row.failed_at,
    };
  }

  private async resolveBuyerEmail(buyerOrgId: string): Promise<string | null> {
    const { data } = await this.supabase
      .getClient()
      .from('organization_users')
      .select('users!inner(email)')
      .eq('organization_id', buyerOrgId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (
      ((data?.users as unknown as { email?: string })?.email as string) || null
    );
  }

  private async emailRefundConfirmation(
    order: OrderRow,
    parent: OrderRow,
    refundId: string,
    refundNumber: string,
    creditNoteNumber: string,
    amountCents: number,
    currency: string,
    method: RefundMethod,
    reason: string,
    reasonCode: RefundReasonCode,
    processedAt: Date,
    recipientOverride?: string,
  ) {
    const to = recipientOverride || (await this.resolveBuyerEmail(order.buyer_org_id));
    if (!to) {
      this.logger.warn(
        `No buyer email for org ${order.buyer_org_id}; skipping refund email`,
      );
      return;
    }

    // Best-effort credit-note PDF; if generation fails, send the email without attachment.
    let pdfBuffer: Buffer | undefined;
    let pdfFilename: string | undefined;
    try {
      const result = await this.creditNote.generate(order.id, {
        refundNumber,
        creditNoteNumber,
        amountCents,
        reason,
        reasonCode,
        refundMethod: method,
        processedAt,
      });
      pdfBuffer = result.buffer;
      pdfFilename = result.filename;
    } catch (err) {
      this.logger.error(`Credit-note PDF generation failed: ${err}`);
    }

    const buyerName = await this.resolveBuyerName(order.buyer_org_id);

    await this.email.sendRefundConfirmationEmail({
      to,
      buyerName,
      orderNumber: order.order_number || order.id,
      invoiceNumber: order.invoice_number || order.order_number || order.id,
      refundNumber,
      creditNoteNumber,
      amountCents,
      currency,
      refundMethod: method,
      creditNotePdf: pdfBuffer,
      creditNotePdfFilename: pdfFilename,
    });

    await this.supabase
      .getClient()
      .from('refunds')
      .update({ buyer_notified_at: new Date().toISOString() })
      .eq('id', refundId);
  }

  private async resolveBuyerName(buyerOrgId: string): Promise<string> {
    const { data } = await this.supabase
      .getClient()
      .from('organizations')
      .select('name, business_name')
      .eq('id', buyerOrgId)
      .single();
    return (
      (data as { business_name?: string; name?: string } | null)?.business_name ||
      (data as { name?: string } | null)?.name ||
      'Buyer'
    );
  }
}
