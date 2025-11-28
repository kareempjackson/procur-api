import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { BankInfoService } from '../bank-info/bank-info.service';

@Injectable()
export class OrderClearingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly bankInfo: BankInfoService,
  ) {}

  /**
   * After inspection approval, create the two-leg clearing transactions:
   *  - buyer_settlement: supermarket → Procur
   *  - farmer_payout: Procur → farmer
   */
  async createClearingTransactions(
    orderId: string,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data: order, error: orderError } = await client
      .from('orders')
      .select(
        'id, buyer_org_id, seller_org_id, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, inspection_status',
      )
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found');
    }

    if ((order.inspection_status as string | null) !== 'approved') {
      throw new BadRequestException(
        'Order must be approved after inspection before creating clearing transactions',
      );
    }

    const buyerOrgId = order.buyer_org_id as string | null;
    const sellerOrgId = order.seller_org_id as string | null;

    if (!buyerOrgId || !sellerOrgId) {
      throw new BadRequestException(
        'Order is missing buyer or seller organization',
      );
    }

    // Ensure we have bank info for farmer before creating payout leg
    const bankInfo = await this.bankInfo.getRawBankInfo(sellerOrgId);
    if (!bankInfo) {
      throw new BadRequestException(
        'Farmer bank information is missing – add bank details before creating payout',
      );
    }

    const amount = Number(order.total_amount ?? 0);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Order total amount must be positive');
    }

    // Helper to generate transaction_number using existing DB function
    const { data: buyerTxnNum, error: buyerTxnErr } = await client.rpc(
      'generate_transaction_number',
    );
    if (buyerTxnErr || !buyerTxnNum) {
      throw new BadRequestException(
        `Failed to generate buyer transaction number: ${buyerTxnErr?.message ?? 'unknown'}`,
      );
    }

    const { data: payoutTxnNum, error: payoutTxnErr } = await client.rpc(
      'generate_transaction_number',
    );
    if (payoutTxnErr || !payoutTxnNum) {
      throw new BadRequestException(
        `Failed to generate payout transaction number: ${payoutTxnErr?.message ?? 'unknown'}`,
      );
    }

    const nowIso = new Date().toISOString();

    const { error: insertError } = await client.from('transactions').insert([
      {
        // Leg 1: buyer settlement (sale)
        transaction_number: buyerTxnNum as string,
        order_id: order.id,
        seller_org_id: sellerOrgId,
        buyer_org_id: buyerOrgId,
        type: 'sale',
        status: 'pending',
        amount,
        currency: 'XCD',
        payment_method: 'bank_transfer',
        platform_fee: 0,
        payment_processing_fee: 0,
        net_amount: amount,
        description: 'Buyer settlement (direct deposit to Procur)',
        metadata: {
          flow: 'direct_deposit_clearing',
          leg: 'buyer_settlement',
          phase: 'awaiting_buyer_transfer',
        },
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        // Leg 2: farmer payout (payout)
        transaction_number: payoutTxnNum as string,
        order_id: order.id,
        seller_org_id: sellerOrgId,
        buyer_org_id: buyerOrgId,
        type: 'payout',
        status: 'pending',
        amount,
        currency: 'XCD',
        payment_method: 'bank_transfer',
        platform_fee: 0,
        payment_processing_fee: 0,
        net_amount: amount,
        description: 'Farmer payout (bank transfer from Procur)',
        metadata: {
          flow: 'direct_deposit_clearing',
          leg: 'farmer_payout',
          phase: 'awaiting_funds',
          bank_token: bankInfo.token,
        },
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    if (insertError) {
      throw new BadRequestException(
        `Failed to create clearing transactions: ${insertError.message}`,
      );
    }

    return { success: true };
  }

  async listBuyerSettlements(input: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    settlements: {
      id: string;
      orderId: string | null;
      buyerOrgId: string | null;
      buyerOrgName: string | null;
      sellerOrgId: string | null;
      sellerOrgName: string | null;
      amount: number;
      currency: string;
      status: string;
      createdAt: string;
      bankReference: string | null;
      proofUrl: string | null;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const client = this.supabase.getClient();
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? input.limit : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = client
      .from('transactions')
      .select(
        'id, order_id, buyer_org_id, seller_org_id, amount, currency, status, metadata, created_at',
        { count: 'exact' },
      )
      .contains('metadata', {
        flow: 'direct_deposit_clearing',
        leg: 'buyer_settlement',
      })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (input.status) {
      query = query.eq('status', input.status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new BadRequestException(
        `Failed to list buyer settlements: ${error.message}`,
      );
    }

    const rows = (data || []) as any[];
    const orgIds = Array.from(
      new Set(
        rows
          .map((r) => [
            (r.buyer_org_id as string | null) ?? null,
            (r.seller_org_id as string | null) ?? null,
          ])
          .flat()
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let orgById: Record<string, { name: string | null }> = {};

    if (orgIds.length > 0) {
      const { data: orgs, error: orgErr } = await client
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      if (orgErr) {
        throw new BadRequestException(
          `Failed to load organizations for settlements: ${orgErr.message}`,
        );
      }
      orgById = Object.fromEntries(
        (orgs || []).map((o: any) => [
          o.id as string,
          { name: (o.name as string) ?? null },
        ]),
      );
    }

    const settlements = rows.map((r) => {
      const meta = (r.metadata || {}) as any;
      return {
        id: r.id as string,
        orderId: (r.order_id as string | null) ?? null,
        buyerOrgId: (r.buyer_org_id as string | null) ?? null,
        buyerOrgName:
          orgById[(r.buyer_org_id as string | null) ?? '']?.name ?? null,
        sellerOrgId: (r.seller_org_id as string | null) ?? null,
        sellerOrgName:
          orgById[(r.seller_org_id as string | null) ?? '']?.name ?? null,
        amount: Number(r.amount ?? 0),
        currency: (r.currency as string) ?? 'XCD',
        status: (r.status as string) ?? 'pending',
        createdAt: (r.created_at as string) ?? new Date().toISOString(),
        bankReference:
          (meta.bank_reference as string | undefined | null) ?? null,
        proofUrl: (meta.bank_proof_url as string | undefined | null) ?? null,
      };
    });

    return {
      settlements,
      total: count || 0,
      page,
      limit,
    };
  }

  async listFarmerPayouts(input: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    payouts: {
      id: string;
      orderId: string | null;
      buyerOrgId: string | null;
      buyerOrgName: string | null;
      sellerOrgId: string | null;
      sellerOrgName: string | null;
      amount: number;
      currency: string;
      status: string;
      createdAt: string;
      proofUrl: string | null;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const client = this.supabase.getClient();
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? input.limit : 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = client
      .from('transactions')
      .select(
        'id, order_id, buyer_org_id, seller_org_id, amount, currency, status, metadata, created_at',
        { count: 'exact' },
      )
      .contains('metadata', {
        flow: 'direct_deposit_clearing',
        leg: 'farmer_payout',
      })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (input.status) {
      query = query.eq('status', input.status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new BadRequestException(
        `Failed to list farmer payouts: ${error.message}`,
      );
    }

    const rows = (data || []) as any[];
    const orgIds = Array.from(
      new Set(
        rows
          .map((r) => [
            (r.buyer_org_id as string | null) ?? null,
            (r.seller_org_id as string | null) ?? null,
          ])
          .flat()
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let orgById: Record<string, { name: string | null }> = {};

    if (orgIds.length > 0) {
      const { data: orgs, error: orgErr } = await client
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      if (orgErr) {
        throw new BadRequestException(
          `Failed to load organizations for payouts: ${orgErr.message}`,
        );
      }
      orgById = Object.fromEntries(
        (orgs || []).map((o: any) => [
          o.id as string,
          { name: (o.name as string) ?? null },
        ]),
      );
    }

    const payouts = rows.map((r) => {
      const meta = (r.metadata || {}) as any;
      return {
        id: r.id as string,
        orderId: (r.order_id as string | null) ?? null,
        buyerOrgId: (r.buyer_org_id as string | null) ?? null,
        buyerOrgName:
          orgById[(r.buyer_org_id as string | null) ?? '']?.name ?? null,
        sellerOrgId: (r.seller_org_id as string | null) ?? null,
        sellerOrgName:
          orgById[(r.seller_org_id as string | null) ?? '']?.name ?? null,
        amount: Number(r.amount ?? 0),
        currency: (r.currency as string) ?? 'XCD',
        status: (r.status as string) ?? 'pending',
        createdAt: (r.created_at as string) ?? new Date().toISOString(),
        proofUrl: (meta.payout_proof_url as string | undefined | null) ?? null,
      };
    });

    return {
      payouts,
      total: count || 0,
      page,
      limit,
    };
  }

  async markBuyerSettlementCompleted(input: {
    transactionId: string;
    bankReference?: string;
    proofUrl?: string;
  }): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data: tx, error: txError } = await client
      .from('transactions')
      .select('id, order_id, metadata, status')
      .eq('id', input.transactionId)
      .single();

    if (txError || !tx) {
      throw new NotFoundException('Buyer settlement transaction not found');
    }

    const meta = ((tx as any).metadata || {}) as any;
    if (
      meta.flow !== 'direct_deposit_clearing' ||
      meta.leg !== 'buyer_settlement'
    ) {
      throw new BadRequestException(
        'Transaction is not a buyer settlement for the direct deposit flow',
      );
    }

    const updatedMeta = {
      ...meta,
      bank_reference: input.bankReference ?? meta.bank_reference ?? null,
      bank_proof_url: input.proofUrl ?? meta.bank_proof_url ?? null,
      phase: 'completed',
    };

    const nowIso = new Date().toISOString();

    const { error: updateError } = await client
      .from('transactions')
      .update({
        status: 'completed',
        metadata: updatedMeta,
        processed_at: nowIso,
        settled_at: nowIso,
      })
      .eq('id', input.transactionId);

    if (updateError) {
      throw new BadRequestException(
        `Failed to mark buyer settlement completed: ${updateError.message}`,
      );
    }

    // Move paired farmer payout phase to pending_execution
    if (tx.order_id) {
      const { data: payoutTx, error: payoutError } = await client
        .from('transactions')
        .select('id, metadata')
        .eq('order_id', tx.order_id as string)
        .contains('metadata', {
          flow: 'direct_deposit_clearing',
          leg: 'farmer_payout',
        })
        .limit(1)
        .maybeSingle();

      if (!payoutError && payoutTx) {
        const payoutMeta = ((payoutTx as any).metadata || {}) as any;
        const newPayoutMeta = {
          ...payoutMeta,
          phase: 'pending_execution',
        };
        await client
          .from('transactions')
          .update({ metadata: newPayoutMeta })
          .eq('id', payoutTx.id as string);
      }
    }

    return { success: true };
  }

  async markFarmerPayoutCompleted(input: {
    transactionId: string;
    proofUrl?: string;
  }): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data: tx, error: txError } = await client
      .from('transactions')
      .select('id, order_id, metadata, status')
      .eq('id', input.transactionId)
      .single();

    if (txError || !tx) {
      throw new NotFoundException('Farmer payout transaction not found');
    }

    const meta = ((tx as any).metadata || {}) as any;
    if (
      meta.flow !== 'direct_deposit_clearing' ||
      meta.leg !== 'farmer_payout'
    ) {
      throw new BadRequestException(
        'Transaction is not a farmer payout for the direct deposit flow',
      );
    }

    const updatedMeta = {
      ...meta,
      payout_proof_url: input.proofUrl ?? meta.payout_proof_url ?? null,
      phase: 'completed',
    };

    const nowIso = new Date().toISOString();

    const { error: updateError } = await client
      .from('transactions')
      .update({
        status: 'completed',
        metadata: updatedMeta,
        processed_at: nowIso,
        settled_at: nowIso,
      })
      .eq('id', input.transactionId);

    if (updateError) {
      throw new BadRequestException(
        `Failed to mark farmer payout completed: ${updateError.message}`,
      );
    }

    // Update order payment_status to paid
    if (tx.order_id) {
      const { error: orderError } = await client
        .from('orders')
        .update({
          payment_status: 'paid',
          paid_at: nowIso,
        })
        .eq('id', tx.order_id as string);

      if (orderError) {
        throw new BadRequestException(
          `Failed to update order payment status: ${orderError.message}`,
        );
      }

      // Append timeline events
      await client.from('order_timeline').insert({
        order_id: tx.order_id as string,
        event_type: 'farmer_payout_completed',
        title: 'Farmer payout completed',
        description: 'Farmer has been paid via bank transfer from Procur',
        actor_type: 'admin',
        metadata: {
          flow: 'direct_deposit_clearing',
          transaction_id: tx.id,
        },
        is_visible_to_buyer: true,
        is_visible_to_seller: true,
      });
    }

    return { success: true };
  }
}
