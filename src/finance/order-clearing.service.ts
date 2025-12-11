import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { BankInfoService } from '../bank-info/bank-info.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrderClearingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly bankInfo: BankInfoService,
    private readonly email: EmailService,
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
    const { data: buyerTxnNumRaw, error: buyerTxnErr } = await client.rpc(
      'generate_transaction_number',
    );
    const buyerTxnNum = buyerTxnNumRaw as string | null;
    if (buyerTxnErr || !buyerTxnNum || typeof buyerTxnNum !== 'string') {
      throw new BadRequestException(
        `Failed to generate buyer transaction number: ${buyerTxnErr?.message ?? 'unknown'}`,
      );
    }

    const { data: payoutTxnNumRaw, error: payoutTxnErr } = await client.rpc(
      'generate_transaction_number',
    );
    const payoutTxnNum = payoutTxnNumRaw as string | null;
    if (payoutTxnErr || !payoutTxnNum || typeof payoutTxnNum !== 'string') {
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

    const rows: {
      id: string;
      order_id: string | null;
      buyer_org_id: string | null;
      seller_org_id: string | null;
      amount: number | null;
      currency: string | null;
      status: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string | null;
    }[] = (data || []) as any[];
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
        (orgs || []).map((raw) => {
          const o = raw as { id: string; name: string | null };
          return [o.id, { name: o.name ?? null }];
        }),
      );
    }

    const settlements = rows.map((r) => {
      const meta = (r.metadata || {}) as {
        bank_reference?: string | null;
        bank_proof_url?: string | null;
      };
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

    const rows: {
      id: string;
      order_id: string | null;
      buyer_org_id: string | null;
      seller_org_id: string | null;
      amount: number | null;
      currency: string | null;
      status: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string | null;
    }[] = (data || []) as any[];
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
        (orgs || []).map((raw) => {
          const o = raw as { id: string; name: string | null };
          return [o.id, { name: o.name ?? null }];
        }),
      );
    }

    const payouts = rows.map((r) => {
      const meta = (r.metadata || {}) as {
        payout_proof_url?: string | null;
      };
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
      .select(
        'id, order_id, buyer_org_id, seller_org_id, amount, currency, payment_method, transaction_number, platform_fee, metadata, status',
      )
      .eq('id', input.transactionId)
      .single();

    if (txError || !tx) {
      throw new NotFoundException('Buyer settlement transaction not found');
    }

    const txMeta =
      (tx as { metadata?: Record<string, unknown> }).metadata ?? {};
    if (
      txMeta.flow !== 'direct_deposit_clearing' ||
      txMeta.leg !== 'buyer_settlement'
    ) {
      throw new BadRequestException(
        'Transaction is not a buyer settlement for the direct deposit flow',
      );
    }

    const updatedMeta = {
      ...txMeta,
      bank_reference:
        input.bankReference ??
        (txMeta.bank_reference as string | undefined | null) ??
        null,
      bank_proof_url:
        input.proofUrl ??
        (txMeta.bank_proof_url as string | undefined | null) ??
        null,
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
        const payoutMeta =
          (payoutTx as { metadata?: Record<string, unknown> }).metadata ?? {};
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

    // Send buyer payment receipt email (direct deposit flow)
    try {
      if (tx.order_id) {
        const { data: order, error: orderError } = await client
          .from('orders')
          .select(
            'id, order_number, buyer_org_id, buyer_user_id, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, currency',
          )
          .eq('id', tx.order_id as string)
          .single();

        if (!order || orderError) {
          return { success: true };
        }

        const buyerOrgId = order.buyer_org_id as string | null;
        const buyerUserId = order.buyer_user_id as string | null;

        let buyerOrgName: string | null = null;
        if (buyerOrgId) {
          const { data: org } = await client
            .from('organizations')
            .select('name, business_name')
            .eq('id', buyerOrgId)
            .single();
          if (org) {
            const typedOrg = org as {
              name?: string | null;
              business_name?: string | null;
            };
            buyerOrgName =
              typedOrg.business_name?.trim() || typedOrg.name?.trim() || null;
          }
        }

        let buyerEmail: string | null = null;
        let buyerContactName: string | null = null;

        // Prefer the specific buyer user on the order
        if (buyerUserId) {
          const { data: buyerUser } = await client
            .from('users')
            .select('email, fullname')
            .eq('id', buyerUserId)
            .single();
          if (buyerUser) {
            const typedUser = buyerUser as {
              email?: string | null;
              fullname?: string | null;
            };
            buyerEmail = typedUser.email ?? null;
            buyerContactName = typedUser.fullname ?? null;
          }
        }

        // Fallback: first member in the buyer organization
        if ((!buyerEmail || !buyerContactName) && buyerOrgId) {
          const { data: orgUser } = await client
            .from('organization_users')
            .select('user_id')
            .eq('organization_id', buyerOrgId)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          const orgUserId =
            (orgUser as { user_id?: string | null } | null)?.user_id ?? null;

          if (orgUserId) {
            const { data: user } = await client
              .from('users')
              .select('email, fullname')
              .eq('id', orgUserId)
              .single();

            if (user) {
              const typedUser = user as {
                email?: string | null;
                fullname?: string | null;
              };
              buyerEmail = buyerEmail ?? typedUser.email ?? null;
              buyerContactName =
                buyerContactName ?? typedUser.fullname ?? null;
            }
          }
        }

        if (buyerEmail) {
          const buyerName =
            buyerOrgName || buyerContactName || buyerEmail || 'Customer';
          const receiptNumber =
            (tx as { transaction_number?: string | null }).transaction_number ||
            input.transactionId;
          const amountCurrency =
            (tx as { currency?: string | null }).currency ||
            (order.currency as string | null) ||
            'XCD';
          const platformFee =
            (tx as { platform_fee?: number | null }).platform_fee ?? 0;

          await this.email.sendBuyerCompletionReceipt({
            email: buyerEmail,
            buyerName,
            buyerEmail,
            buyerContact: buyerContactName,
            receiptNumber,
            paymentDate: nowIso,
            orderNumber:
              (order.order_number as string | null) || (order.id as string),
            paymentMethod:
              (tx as { payment_method?: string | null }).payment_method ||
              'Bank transfer',
            paymentReference:
              (updatedMeta.bank_reference as string | undefined | null) ?? null,
            paymentStatus: 'settled',
            subtotal: Number(order.subtotal ?? 0),
            delivery: Number(order.shipping_amount ?? 0),
            platformFee: Number(platformFee ?? 0),
            taxAmount: Number(order.tax_amount ?? 0),
            discount: Number(order.discount_amount ?? 0),
            totalPaid: Number(order.total_amount ?? 0),
            currency: String(amountCurrency),
          });
        }
      }
    } catch (emailErr) {
      // Do not block admin flows on email issues
      // eslint-disable-next-line no-console
      console.warn(
        'Buyer completion receipt email failed:',
        (emailErr as Error)?.message || emailErr,
      );
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
      .select(
        'id, order_id, buyer_org_id, seller_org_id, amount, currency, payment_method, transaction_number, platform_fee, metadata, status',
      )
      .eq('id', input.transactionId)
      .single();

    if (txError || !tx) {
      throw new NotFoundException('Farmer payout transaction not found');
    }

    const txMeta =
      (tx as { metadata?: Record<string, unknown> }).metadata ?? {};
    if (
      txMeta.flow !== 'direct_deposit_clearing' ||
      txMeta.leg !== 'farmer_payout'
    ) {
      throw new BadRequestException(
        'Transaction is not a farmer payout for the direct deposit flow',
      );
    }

    const updatedMeta = {
      ...txMeta,
      payout_proof_url:
        input.proofUrl ??
        (txMeta.payout_proof_url as string | undefined | null) ??
        null,
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

      // Send seller payment receipt email (direct deposit flow)
      try {
        const { data: order, error: orderError2 } = await client
          .from('orders')
          .select(
            'id, order_number, buyer_org_id, seller_org_id, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, currency',
          )
          .eq('id', tx.order_id as string)
          .single();

        if (!order || orderError2) {
          return { success: true };
        }

        const buyerOrgId = order.buyer_org_id as string | null;
        const sellerOrgId = order.seller_org_id as string | null;

        let buyerOrgName: string | null = null;
        let sellerOrgName: string | null = null;

        if (buyerOrgId || sellerOrgId) {
          const orgIds: string[] = [];
          if (buyerOrgId) orgIds.push(buyerOrgId);
          if (sellerOrgId && sellerOrgId !== buyerOrgId) {
            orgIds.push(sellerOrgId);
          }

          if (orgIds.length > 0) {
            const { data: orgs } = await client
              .from('organizations')
              .select('id, name, business_name')
              .in('id', orgIds);

            for (const raw of orgs || []) {
              const org = raw as {
                id: string;
                name?: string | null;
                business_name?: string | null;
              };
              const orgName =
                org.business_name?.trim() || org.name?.trim() || null;
              if (org.id === buyerOrgId) buyerOrgName = orgName;
              if (org.id === sellerOrgId) sellerOrgName = orgName;
            }
          }
        }

        // Resolve buyer contact details for "Paid by" section
        let buyerEmail: string | null = null;
        let buyerContactName: string | null = null;

        if (buyerOrgId) {
          const { data: orgUser } = await client
            .from('organization_users')
            .select('user_id')
            .eq('organization_id', buyerOrgId)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          const orgUserId =
            (orgUser as { user_id?: string | null } | null)?.user_id ?? null;

          if (orgUserId) {
            const { data: user } = await client
              .from('users')
              .select('email, fullname')
              .eq('id', orgUserId)
              .single();

            if (user) {
              const typedUser = user as {
                email?: string | null;
                fullname?: string | null;
              };
              buyerEmail = typedUser.email ?? null;
              buyerContactName = typedUser.fullname ?? null;
            }
          }
        }

        const buyerNameForSeller =
          buyerOrgName || buyerContactName || buyerEmail || 'Customer';
        const amountCurrency =
          (tx as { currency?: string | null }).currency ||
          (order.currency as string | null) ||
          'XCD';
        const platformFee =
          (tx as { platform_fee?: number | null }).platform_fee ?? 0;
        const receiptNumber =
          (tx as { transaction_number?: string | null }).transaction_number ||
          input.transactionId;
        const orderNumber =
          (order.order_number as string | null) || (order.id as string);

        if (sellerOrgId) {
          const { data: orgUsers } = await client
            .from('organization_users')
            .select('user_id, is_active')
            .eq('organization_id', sellerOrgId)
            .eq('is_active', true);

          const sellerUserIds =
            (orgUsers || [])
              .map(
                (row) => (row as { user_id?: string | null }).user_id ?? null,
              )
              .filter((id): id is string => Boolean(id)) || [];

          if (sellerUserIds.length > 0) {
            const { data: users } = await client
              .from('users')
              .select('id, email, fullname')
              .in('id', sellerUserIds)
              .not('email', 'is', null);

            for (const rawUser of users || []) {
              const sellerUser = rawUser as {
                email?: string | null;
                fullname?: string | null;
              };
              if (!sellerUser.email) continue;

              const sellerDisplayName =
                sellerOrgName ||
                sellerUser.fullname ||
                sellerUser.email ||
                'Seller';

              await this.email.sendSellerCompletionReceipt({
                email: sellerUser.email,
                sellerName: sellerDisplayName,
                buyerName: buyerNameForSeller,
                buyerEmail: buyerEmail ?? 'N/A',
                buyerContact: buyerContactName,
                receiptNumber,
                paymentDate: nowIso,
                orderNumber,
                paymentMethod:
                  (tx as { payment_method?: string | null }).payment_method ||
                  'Bank transfer',
                paymentReference:
                  (updatedMeta.payout_proof_url as string | undefined | null) ??
                  null,
                paymentStatus: 'completed',
                subtotal: Number(order.subtotal ?? 0),
                delivery: Number(order.shipping_amount ?? 0),
                platformFee: Number(platformFee ?? 0),
                taxAmount: Number(order.tax_amount ?? 0),
                discount: Number(order.discount_amount ?? 0),
                totalPaid: Number(order.total_amount ?? 0),
                currency: String(amountCurrency),
              });
            }
          }
        }
      } catch (emailErr) {
        // Do not block admin flows on email issues
        // eslint-disable-next-line no-console
        console.warn(
          'Seller completion receipt email failed:',
          (emailErr as Error)?.message || emailErr,
        );
      }
    }

    return { success: true };
  }
}
