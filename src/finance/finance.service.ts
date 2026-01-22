import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class FinanceService {
  constructor(private readonly db: SupabaseService) {}

  async createPayoutBatch(minAmountCents: number = 10000) {
    // Enforce minimum $100 (10000 cents) - sellers cannot get payouts under $100
    const effectiveMin = Math.max(minAmountCents, 10000);

    const client = this.db.getClient();
    const { data: balances, error: balErr } = await client
      .from('seller_balances')
      .select('*')
      .gte('available_amount_cents', effectiveMin);
    if (balErr) throw new BadRequestException(balErr.message);

    const reference = `PB-${new Date().toISOString().slice(0, 10)}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const { data: batch, error: batchErr } = await client
      .from('payout_batches')
      .insert({ reference, status: 'draft' })
      .select('*')
      .single();
    if (batchErr) throw new BadRequestException(batchErr.message);

    let total = 0;
    let items = 0;
    for (const b of balances || []) {
      const amount = Number(b.available_amount_cents || 0);
      if (amount <= 0) continue;

      await client.from('payout_batch_items').insert({
        batch_id: batch.id,
        seller_org_id: b.seller_org_id,
        amount_cents: amount,
        currency: b.currency || 'USD',
        status: 'pending',
        transactions: [],
      });
      total += amount;
      items += 1;

      await client
        .from('seller_balances')
        .update({
          available_amount_cents: 0,
          pending_amount_cents: Number(b.pending_amount_cents || 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('seller_org_id', b.seller_org_id);
    }

    await client
      .from('payout_batches')
      .update({
        total_items: items,
        total_amount_cents: total,
        status: 'exported',
      })
      .eq('id', batch.id);

    return {
      id: batch.id,
      reference,
      total_items: items,
      total_amount_cents: total,
    };
  }

  async listBatches(q: { status?: string; page?: number; limit?: number }) {
    const client = this.db.getClient();
    const page = q.page || 1;
    const limit = q.limit || 20;
    const from = (page - 1) * limit;
    let query = client.from('payout_batches').select('*', { count: 'exact' });
    if (q.status) query = query.eq('status', q.status);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { batches: data || [], total: count || 0, page, limit };
  }

  async exportBatchCsv(batchId: string) {
    const client = this.db.getClient();
    const { data: items, error } = await client
      .from('payout_batch_items')
      .select('seller_org_id, amount_cents, currency')
      .eq('batch_id', batchId);
    if (error) throw new BadRequestException(error.message);
    const rows = ['seller_org_id,amount,currency'];
    for (const it of items || []) {
      rows.push(
        `${it.seller_org_id},${(Number(it.amount_cents) / 100).toFixed(2)},${it.currency}`,
      );
    }
    return { filename: `payout_${batchId}.csv`, csv: rows.join('\n') };
  }

  async markBatchPaid(batchId: string, notes?: string) {
    const client = this.db.getClient();
    const { data: items, error } = await client
      .from('payout_batch_items')
      .select('*')
      .eq('batch_id', batchId);
    if (error) throw new BadRequestException(error.message);

    for (const it of items || []) {
      await client
        .from('payout_batch_items')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', it.id);

      const { data: bal } = await client
        .from('seller_balances')
        .select('pending_amount_cents')
        .eq('seller_org_id', it.seller_org_id)
        .single();
      await client
        .from('seller_balances')
        .update({
          pending_amount_cents: Math.max(
            0,
            Number(bal?.pending_amount_cents || 0) - Number(it.amount_cents),
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('seller_org_id', it.seller_org_id);
    }

    await client
      .from('payout_batches')
      .update({ status: 'paid', processed_at: new Date().toISOString(), notes })
      .eq('id', batchId);

    return { ok: true };
  }
}
