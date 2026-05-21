import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Stripe from 'stripe';
import { SupabaseService } from '../database/supabase.service';
import { DisputeResponse } from './dto/dispute.dto';

type StripeDisputeStatus =
  | 'warning_needs_response'
  | 'warning_under_review'
  | 'warning_closed'
  | 'needs_response'
  | 'under_review'
  | 'won'
  | 'lost';

const FINAL_STATUSES: StripeDisputeStatus[] = ['won', 'lost', 'warning_closed'];

interface OrderLookup {
  order_id: string;
  parent_order_id: string | null;
}

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // -- Webhook entrypoints ----------------------------------------------

  /**
   * Idempotently upsert a dispute from any of charge.dispute.{created,updated,closed}.
   * The handler is the same for all three since Stripe sends the full dispute payload
   * each time; closing events just have a terminal status.
   */
  async upsertFromStripe(dispute: Stripe.Dispute): Promise<void> {
    const chargeId =
      typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;
    const paymentIntentId =
      typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id ?? null;

    const orderLookup = await this.resolveOrderLink(chargeId, paymentIntentId);
    if (!orderLookup) {
      // Charge isn't tied to any order in our DB (could be a manual Dashboard charge).
      // Log and exit so Stripe still gets a 200 from the webhook.
      this.logger.warn(
        `Dispute ${dispute.id} on charge ${chargeId ?? '?'} not linked to any Procur order; skipping`,
      );
      return;
    }

    const status = dispute.status as StripeDisputeStatus;
    const isFinal = FINAL_STATUSES.includes(status);
    const outcome = this.computeOutcome(status, dispute);

    const client = this.supabase.getClient();
    const nowIso = new Date().toISOString();

    const { data: existing } = await client
      .from('disputes')
      .select('id, status, is_final')
      .eq('stripe_dispute_id', dispute.id)
      .maybeSingle();

    const row = {
      order_id: orderLookup.order_id,
      parent_order_id: orderLookup.parent_order_id,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: dispute.amount,
      currency: (dispute.currency || 'usd').toUpperCase(),
      reason: dispute.reason,
      status,
      network_reason_code: dispute.network_reason_code ?? null,
      evidence_due_by: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : null,
      is_charge_refundable: dispute.is_charge_refundable ?? null,
      is_final: isFinal,
      outcome,
      payload_snapshot: dispute as unknown as Record<string, unknown>,
      updated_at: nowIso,
      ...(isFinal && { resolved_at: nowIso }),
    };

    if (existing) {
      const { error } = await client
        .from('disputes')
        .update(row)
        .eq('id', existing.id);
      if (error) throw new Error(`Failed to update dispute ${dispute.id}: ${error.message}`);
    } else {
      const { error } = await client.from('disputes').insert(row);
      if (error) throw new Error(`Failed to insert dispute ${dispute.id}: ${error.message}`);

      // First-time insert: log a transaction with type='dispute_hold' for the books.
      await this.recordDisputeTransaction(orderLookup, dispute, 'dispute_hold');
    }

    // Refresh the order-level convenience flag (parent + all children share state via order_id).
    await this.refreshHasActiveDispute(orderLookup);

    // Final-state side effect: log dispute_release transaction so finance reports show the outcome.
    if (isFinal && (!existing || !existing.is_final)) {
      await this.recordDisputeTransaction(orderLookup, dispute, 'dispute_release');
      await this.recordTimeline(orderLookup.order_id, dispute, status);
    } else if (!existing) {
      await this.recordTimeline(orderLookup.order_id, dispute, 'opened');
    }
  }

  // -- Read API ----------------------------------------------------------

  async listForOrder(orderId: string): Promise<DisputeResponse[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('disputes')
      .select('*')
      .or(`order_id.eq.${orderId},parent_order_id.eq.${orderId}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => this.mapRow(row));
  }

  async get(orderId: string, disputeId: string): Promise<DisputeResponse> {
    const { data, error } = await this.supabase
      .getClient()
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException(`Dispute ${disputeId} not found`);
    if (data.order_id !== orderId && data.parent_order_id !== orderId) {
      throw new NotFoundException(`Dispute ${disputeId} not on order ${orderId}`);
    }
    return this.mapRow(data);
  }

  // -- Helpers -----------------------------------------------------------

  private async resolveOrderLink(
    chargeId: string | null,
    paymentIntentId: string | null,
  ): Promise<OrderLookup | null> {
    const client = this.supabase.getClient();
    // Prefer matching by PaymentIntent (parent of multi-seller carts holds it).
    if (paymentIntentId) {
      const { data } = await client
        .from('orders')
        .select('id, parent_order_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .order('parent_order_id', { nullsFirst: true })
        .limit(1)
        .maybeSingle();
      if (data) return { order_id: data.id, parent_order_id: data.parent_order_id };
    }
    if (chargeId) {
      const { data } = await client
        .from('orders')
        .select('id, parent_order_id')
        .eq('stripe_charge_id', chargeId)
        .limit(1)
        .maybeSingle();
      if (data) return { order_id: data.id, parent_order_id: data.parent_order_id };
    }
    return null;
  }

  private async refreshHasActiveDispute(lookup: OrderLookup): Promise<void> {
    const client = this.supabase.getClient();
    const targetOrderId = lookup.parent_order_id ?? lookup.order_id;

    // Active = not yet final. Flag the parent (which is what surfaces in admin lists)
    // and cascade to all children.
    const { count } = await client
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .or(`order_id.eq.${targetOrderId},parent_order_id.eq.${targetOrderId}`)
      .eq('is_final', false);

    const hasActive = (count ?? 0) > 0;

    await client
      .from('orders')
      .update({ has_active_dispute: hasActive })
      .or(`id.eq.${targetOrderId},parent_order_id.eq.${targetOrderId}`);
  }

  private async recordDisputeTransaction(
    lookup: OrderLookup,
    dispute: Stripe.Dispute,
    type: 'dispute_hold' | 'dispute_release',
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Look up seller_org_id for the transaction row (parent rows have NULL, take a child).
    const { data: orderRow } = await client
      .from('orders')
      .select('seller_org_id, buyer_org_id')
      .eq('id', lookup.order_id)
      .single();

    let sellerOrgId: string | null = orderRow?.seller_org_id ?? null;
    if (!sellerOrgId) {
      const { data: child } = await client
        .from('orders')
        .select('seller_org_id')
        .eq('parent_order_id', lookup.order_id)
        .not('seller_org_id', 'is', null)
        .limit(1)
        .maybeSingle();
      sellerOrgId = (child as { seller_org_id?: string | null } | null)?.seller_org_id ?? null;
    }

    if (!sellerOrgId) {
      this.logger.warn(
        `Cannot record ${type} transaction for order ${lookup.order_id}: no seller_org_id`,
      );
      return;
    }

    const transactionNumber = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    await client.from('transactions').insert({
      transaction_number: transactionNumber,
      order_id: lookup.order_id,
      seller_org_id: sellerOrgId,
      buyer_org_id: orderRow?.buyer_org_id ?? null,
      type,
      status: type === 'dispute_release' ? 'completed' : 'pending',
      amount: -(dispute.amount / 100),
      currency: (dispute.currency || 'usd').toUpperCase(),
      payment_method: 'credit_card',
      payment_reference: dispute.id,
      gateway_transaction_id:
        typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null,
      description: `Stripe dispute ${type === 'dispute_release' ? 'closed' : 'opened'} (${dispute.reason}, status=${dispute.status})`,
      metadata: {
        dispute_id: dispute.id,
        reason: dispute.reason,
        status: dispute.status,
        outcome: this.computeOutcome(dispute.status as StripeDisputeStatus, dispute),
        order_id: lookup.order_id,
      },
      processed_at: new Date().toISOString(),
      ...(type === 'dispute_release' && {
        settled_at: new Date().toISOString(),
      }),
    });
  }

  private async recordTimeline(
    orderId: string,
    dispute: Stripe.Dispute,
    state: 'opened' | StripeDisputeStatus,
  ): Promise<void> {
    const client = this.supabase.getClient();
    await client.from('order_timeline').insert({
      order_id: orderId,
      event_type:
        state === 'opened' ? 'dispute_opened' : `dispute_${state}`,
      title:
        state === 'opened'
          ? `Stripe dispute opened (${dispute.reason})`
          : `Stripe dispute resolved: ${state}`,
      description: `${(dispute.currency || 'usd').toUpperCase()} ${(dispute.amount / 100).toFixed(2)} — ${dispute.reason}`,
      actor_type: 'system',
      metadata: {
        dispute_id: dispute.id,
        status: dispute.status,
        amount_cents: dispute.amount,
      },
    });
  }

  private computeOutcome(
    status: StripeDisputeStatus,
    _dispute: Stripe.Dispute,
  ): 'won' | 'lost' | 'warning_closed' | 'charge_refunded' | null {
    if (status === 'won') return 'won';
    if (status === 'lost') return 'lost';
    if (status === 'warning_closed') return 'warning_closed';
    return null;
  }

  private mapRow(row: Record<string, unknown>): DisputeResponse {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      order_id: String(r.order_id),
      parent_order_id: (r.parent_order_id as string | null) ?? null,
      stripe_dispute_id: String(r.stripe_dispute_id),
      stripe_charge_id: (r.stripe_charge_id as string | null) ?? null,
      stripe_payment_intent_id: (r.stripe_payment_intent_id as string | null) ?? null,
      amount_cents: Number(r.amount_cents),
      currency: String(r.currency),
      reason: (r.reason as string | null) ?? null,
      status: String(r.status),
      network_reason_code: (r.network_reason_code as string | null) ?? null,
      evidence_due_by: (r.evidence_due_by as string | null) ?? null,
      is_charge_refundable: (r.is_charge_refundable as boolean | null) ?? null,
      is_final: Boolean(r.is_final),
      outcome: (r.outcome as DisputeResponse['outcome']) ?? null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      resolved_at: (r.resolved_at as string | null) ?? null,
    };
  }
}
