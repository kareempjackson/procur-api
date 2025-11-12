import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import Stripe from 'stripe';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private currency: string;
  private webhookSecret: string | undefined;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }
    this.stripe = new Stripe(apiKey, { apiVersion: '2024-06-20' as any });
    this.currency = process.env.STRIPE_CURRENCY || 'usd';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  async createCartPaymentIntent(
    buyerOrgId: string,
    buyerUserId: string,
    dto: {
      shipping_address_id: string;
      billing_address_id?: string;
      buyer_notes?: string;
    },
  ) {
    const client = this.supabase.getClient();

    // Resolve current cart id using same RPC as BuyersService
    const { data: cartId, error: cartIdError } = await client.rpc(
      'get_or_create_cart',
      {
        p_buyer_org_id: buyerOrgId,
        p_buyer_user_id: buyerUserId,
      },
    );
    if (cartIdError || !cartId) {
      throw new BadRequestException('Cart is empty or unavailable');
    }

    // Load cart items with product details
    const { data: cartItems } = await client
      .from('cart_items')
      .select('*, products(seller_org_id, base_price, sale_price, name, sku)')
      .eq('cart_id', cartId);

    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestException('Cart has no items');
    }

    const bySeller = new Map<string, any[]>();
    for (const item of cartItems as any[]) {
      const sellerId = item.products?.seller_org_id;
      if (!sellerId) continue;
      if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
      bySeller.get(sellerId)!.push(item);
    }

    const orderIds: string[] = [];
    const splits: Record<string, number> = {};
    let totalCents = 0;

    for (const [sellerOrgId, items] of bySeller.entries()) {
      let subtotal = 0;
      for (const it of items) {
        const unit = Number(
          it.products?.sale_price || it.products?.base_price || 0,
        );
        subtotal += unit * Number(it.quantity || 0);
      }
      const shipping = 10; // placeholder
      const tax = subtotal * 0.08; // placeholder
      const total = subtotal + shipping + tax;

      // Fetch full address snapshot for persistence on the order
      let shippingAddressSnapshot: any = { id: dto.shipping_address_id };
      let billingAddressSnapshot: any = {
        id: dto.billing_address_id || dto.shipping_address_id,
      };
      const { data: shippingAddress } = await client
        .from('buyer_addresses')
        .select('*')
        .eq('id', dto.shipping_address_id)
        .single();
      if (shippingAddress) shippingAddressSnapshot = shippingAddress;
      if (dto.billing_address_id) {
        const { data: billingAddress } = await client
          .from('buyer_addresses')
          .select('*')
          .eq('id', dto.billing_address_id)
          .single();
        if (billingAddress) billingAddressSnapshot = billingAddress;
      } else {
        billingAddressSnapshot = shippingAddress || billingAddressSnapshot;
      }

      const { data: order, error } = await client
        .from('orders')
        .insert({
          order_number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          buyer_org_id: buyerOrgId,
          seller_org_id: sellerOrgId,
          buyer_user_id: buyerUserId,
          status: 'pending',
          payment_status: 'pending',
          subtotal,
          tax_amount: tax,
          shipping_amount: shipping,
          discount_amount: 0,
          total_amount: total,
          currency: this.currency.toUpperCase(),
          shipping_address: shippingAddressSnapshot,
          billing_address: billingAddressSnapshot,
          buyer_notes: dto.buyer_notes,
        })
        .select('*')
        .single();
      if (error)
        throw new BadRequestException(
          `Failed to create order: ${error.message}`,
        );
      orderIds.push(order.id);

      // Insert order_items from items snapshot
      for (const it of items) {
        const unit = Number(
          it.products?.sale_price || it.products?.base_price || 0,
        );
        const lineTotal = unit * Number(it.quantity || 0);
        await client.from('order_items').insert({
          order_id: order.id,
          product_id: it.product_id,
          product_name: it.products?.name,
          product_sku: it.products?.sku,
          unit_price: unit,
          quantity: it.quantity,
          total_price: lineTotal,
          product_snapshot: it.products,
        });
      }

      const cents = Math.round(total * 100);
      splits[sellerOrgId] = (splits[sellerOrgId] || 0) + cents;
      totalCents += cents;
    }

    const pi = await this.stripe.paymentIntents.create({
      amount: totalCents,
      currency: this.currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_ids: JSON.stringify(orderIds),
        splits: JSON.stringify(splits),
        buyer_org_id: buyerOrgId,
        buyer_user_id: buyerUserId,
        currency: this.currency,
      },
    });

    const { error: updErr } = await client
      .from('orders')
      .update({ stripe_payment_intent_id: pi.id })
      .in('id', orderIds);
    if (updErr)
      throw new BadRequestException(
        `Failed to link PaymentIntent: ${updErr.message}`,
      );

    return { client_secret: pi.client_secret, order_ids: orderIds };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    if (!this.webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    }
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await this.onPaymentSucceeded(pi);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await this.onPaymentFailed(pi);
    }
  }

  private async onPaymentSucceeded(pi: Stripe.PaymentIntent) {
    const client = this.supabase.getClient();
    const orderIds = safeParseArray(pi.metadata?.order_ids);
    const splits = safeParseObject(pi.metadata?.splits) as Record<
      string,
      number
    >;
    const buyerOrgId = String(pi.metadata?.buyer_org_id || '');
    const buyerUserId = String(pi.metadata?.buyer_user_id || '');

    if (orderIds.length > 0) {
      await client
        .from('orders')
        .update({
          payment_status: 'paid',
          stripe_payment_method_id:
            (pi.latest_charge as any)?.payment_method || null,
          paid_at: new Date().toISOString(),
        })
        .in('id', orderIds);
    }

    // Create transactions and credit balances per seller
    for (const [sellerOrgId, amountCents] of Object.entries(splits || {})) {
      await client.from('transactions').insert({
        transaction_number: `TX-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        seller_org_id: sellerOrgId,
        type: 'sale',
        status: 'completed',
        amount: Number(amountCents) / 100,
        currency: (pi.currency || this.currency).toUpperCase(),
        payment_method: 'card',
        gateway_transaction_id: pi.id,
        platform_fee: 0,
        payment_processing_fee: 0,
        net_amount: Number(amountCents) / 100,
        description: 'Order payment captured',
        metadata: { order_ids: orderIds },
        processed_at: new Date().toISOString(),
      });

      // Credit seller balance (create row if missing)
      const { data: bal } = await client
        .from('seller_balances')
        .select('available_amount_cents')
        .eq('seller_org_id', sellerOrgId)
        .single();
      if (bal) {
        await client
          .from('seller_balances')
          .update({
            available_amount_cents:
              Number(bal.available_amount_cents) + Number(amountCents),
            updated_at: new Date().toISOString(),
          })
          .eq('seller_org_id', sellerOrgId);
      } else {
        await client.from('seller_balances').insert({
          seller_org_id: sellerOrgId,
          available_amount_cents: Number(amountCents),
          currency: (pi.currency || this.currency).toUpperCase(),
        });
      }
    }

    // Notify buyer via email
    if (buyerUserId) {
      const { data: buyer } = await client
        .from('users')
        .select('email, fullname')
        .eq('id', buyerUserId)
        .single();
      if (buyer?.email) {
        const firstOrderId = orderIds[0];
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const link = `${frontendUrl}/buyer/order-confirmation/${firstOrderId}`;
        await this.emailService.sendBasicEmail(
          buyer.email,
          'Your order has been placed',
          `<p>Thanks for your order!</p><p>You can view your order here: <a href="${link}">${link}</a></p>`,
          `Thanks for your order! View: ${link}`,
        );
      }
    }

    // Notify sellers (basic notification event)
    const sellerOrgIds = Object.keys(splits || {});
    if (sellerOrgIds.length) {
      const { data: sellerUsers } = await client
        .from('organization_users')
        .select('user_id')
        .in('organization_id', sellerOrgIds);
      const recipients = (sellerUsers || []).map((r: any) => r.user_id);
      if (recipients.length) {
        await this.notifications.emitEvent({
          eventType: 'order_paid',
          organizationId: buyerOrgId,
          payload: {
            title: 'New paid order',
            body: 'An order has been paid and is ready to fulfill.',
            order_ids: orderIds,
            recipients,
            category: 'orders',
            priority: 'high',
          },
        });
      }
    }
  }

  private async onPaymentFailed(_pi: Stripe.PaymentIntent) {
    // Optionally mark orders as payment_failed
  }
}

function safeParseArray(value: any): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseObject(value: any): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as any) : {};
  } catch {
    return {};
  }
}
