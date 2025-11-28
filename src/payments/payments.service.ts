import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import Stripe from 'stripe';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TemplateService } from '../whatsapp/templates/template.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private currency: string;
  private webhookSecret: string | undefined;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
    private readonly waTemplates: TemplateService,
    private readonly config: ConfigService,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }
    this.stripe = new Stripe(apiKey, { apiVersion: '2024-06-20' as any });
    this.currency = process.env.STRIPE_CURRENCY || 'usd';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  // ============== IDEMPOTENCY HELPERS ==============
  private async hasProcessedEvent(eventId: string): Promise<boolean> {
    this.logger.debug(`Checking idempotency for event ${eventId}`);
    const client = this.supabase.getClient();
    const { data } = await client
      .from('stripe_events_processed')
      .select('id')
      .eq('id', eventId)
      .single();
    return Boolean(data);
  }

  private async recordProcessedEvent(event: Stripe.Event): Promise<void> {
    this.logger.debug(`Recording processed event ${event.id} (${event.type})`);
    const client = this.supabase.getClient();
    await client.from('stripe_events_processed').insert({
      id: event.id,
      type: event.type,
      payload: event as any,
    });
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
      .select(
        `
        *,
        products(
          seller_org_id,
          base_price,
          sale_price,
          name,
          sku,
          unit_of_measurement,
          product_images(image_url, is_primary, display_order)
        )
      `,
      )
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

      // WhatsApp notify seller immediately (new order + accept/reject) on card path
      try {
        const frontendUrl =
          this.config.get<string>('frontend.url') ||
          process.env.FRONTEND_URL ||
          'http://localhost:3001';
        const manageUrl = `${frontendUrl}/seller/orders/${order.id}`;
        const orderNum = String(order.order_number || order.id);
        const currency = (this.currency || 'usd').toUpperCase();
        const buyerName =
          (shippingAddressSnapshot as any)?.contact_name ||
          (shippingAddressSnapshot as any)?.name ||
          'Buyer';

        // Prefer product creator from any order item snapshot
        const { data: anyItem } = await client
          .from('order_items')
          .select('product_snapshot')
          .eq('order_id', order.id)
          .limit(1)
          .single();
        let targetSellerUserId: string | null =
          anyItem?.product_snapshot?.created_by || null;

        if (!targetSellerUserId) {
          const { data: owner } = await client
            .from('organization_users')
            .select('user_id, joined_at')
            .eq('organization_id', sellerOrgId)
            .order('joined_at', { ascending: true })
            .limit(1)
            .single();
          targetSellerUserId = owner?.user_id ?? null;
        }

        let notifyPhone: string | null = null;
        if (targetSellerUserId) {
          const { data: sellerUser } = await client
            .from('users')
            .select('id, phone_number')
            .eq('id', targetSellerUserId)
            .not('phone_number', 'is', null)
            .single();
          if (sellerUser?.phone_number) {
            notifyPhone = String(sellerUser.phone_number);
            // Send template (new order)
            const summary =
              items && items.length
                ? (() => {
                    const first = items[0];
                    const unit =
                      (first.product_snapshot as any)?.unit_of_measurement ||
                      '';
                    const qty = first.quantity ?? 0;
                    const name =
                      (first.product_snapshot as any)?.name || 'items';
                    return qty && unit
                      ? `${qty} ${unit} of ${name} for ${currency} ${total.toFixed(
                          2,
                        )}`
                      : `${items.length} item(s) for ${currency} ${total.toFixed(
                          2,
                        )}`;
                  })()
                : `${currency} ${total.toFixed(2)}`;
            await this.waTemplates.sendNewOrderToSeller(
              notifyPhone.replace(/^\+/, ''),
              orderNum,
              buyerName,
              Number(total.toFixed(2)),
              currency,
              manageUrl,
              'en',
            );
            // Send Accept/Reject buttons
            await this.waTemplates.sendOrderAcceptButtons(
              notifyPhone,
              String(order.id),
              summary,
            );
          }
        }

        if (!notifyPhone) {
          // Try organization phone as last resort
          const { data: org } = await client
            .from('organizations')
            .select('phone_number')
            .eq('id', sellerOrgId)
            .single();
          if (org?.phone_number) {
            const orgPhone = String(org.phone_number);
            const summary =
              items && items.length
                ? (() => {
                    const first = items[0];
                    const unit =
                      (first.product_snapshot as any)?.unit_of_measurement ||
                      '';
                    const qty = first.quantity ?? 0;
                    const name =
                      (first.product_snapshot as any)?.name || 'items';
                    return qty && unit
                      ? `${qty} ${unit} of ${name} for ${currency} ${total.toFixed(
                          2,
                        )}`
                      : `${items.length} item(s) for ${currency} ${total.toFixed(
                          2,
                        )}`;
                  })()
                : `${currency} ${total.toFixed(2)}`;
            await this.waTemplates.sendNewOrderToSeller(
              orgPhone.replace(/^\+/, ''),
              orderNum,
              buyerName,
              Number(total.toFixed(2)),
              currency,
              manageUrl,
              'en',
            );
            await this.waTemplates.sendOrderAcceptButtons(
              orgPhone,
              String(order.id),
              summary,
            );
          } else {
            this.logger.warn(
              `No seller phone found for seller_org=${sellerOrgId}; skipping WA for order ${order.id}`,
            );
          }
        }
      } catch (waErr) {
        this.logger.warn(
          `Card path WA notify seller (new order) failed for order ${order.id}: ${String(
            (waErr as any)?.message || waErr,
          )}`,
        );
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
    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);

    // Idempotency: if we've already processed this event, ACK 200 with no-op
    if (await this.hasProcessedEvent(event.id)) {
      this.logger.warn(`Duplicate event ${event.id}, skipping`);
      return;
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      this.logger.log(`Handling payment_intent.succeeded for PI ${pi.id}`);
      await this.onPaymentSucceeded(pi);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      this.logger.log(`Handling payment_intent.payment_failed for PI ${pi.id}`);
      await this.onPaymentFailed(pi);
    }

    // Record event as processed
    await this.recordProcessedEvent(event);
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

      // Decrement product stock for all items in these paid orders
      try {
        this.logger.log(
          `Updating product stock levels for paid orders: ${orderIds.join(', ')}`,
        );

        const { data: orderItems, error: orderItemsError } = await client
          .from('order_items')
          .select('product_id, quantity')
          .in('order_id', orderIds);

        if (orderItemsError) {
          this.logger.error(
            `Failed to load order_items for stock update: ${orderItemsError.message}`,
          );
        } else if (orderItems && orderItems.length > 0) {
          // Aggregate quantity per product in case there are multiple items
          const productTotals = new Map<string, number>();

          for (const item of orderItems as any[]) {
            const productId = item.product_id as string | null;
            const qty = Number(item.quantity || 0);
            if (!productId || qty <= 0) continue;
            productTotals.set(
              productId,
              (productTotals.get(productId) || 0) + qty,
            );
          }

          for (const [productId, totalQty] of productTotals.entries()) {
            const { data: product, error: productError } = await client
              .from('products')
              .select('stock_quantity')
              .eq('id', productId)
              .single();

            if (productError) {
              this.logger.error(
                `Failed to load product ${productId} for stock update: ${productError.message}`,
              );
              continue;
            }

            const currentStock = Number(product?.stock_quantity || 0);
            const newStock = Math.max(0, currentStock - Number(totalQty || 0));

            this.logger.debug(
              `Updating stock for product ${productId}: ${currentStock} -> ${newStock}`,
            );

            const { error: updateError } = await client
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', productId);

            if (updateError) {
              this.logger.error(
                `Failed to update stock for product ${productId}: ${updateError.message}`,
              );
            }
          }
        }
      } catch (stockErr) {
        this.logger.error(
          `Unexpected error while updating product stock for paid orders: ${String(
            (stockErr as any)?.message || stockErr,
          )}`,
        );
      }
    }

    // Create transactions and credit balances per seller
    for (const [sellerOrgId, amountCents] of Object.entries(splits || {})) {
      this.logger.log(
        `Creating transaction for seller ${sellerOrgId}: $${(
          Number(amountCents) / 100
        ).toFixed(2)}`,
      );
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

    // Notify buyer via email (card path receipt)
    if (buyerUserId) {
      this.logger.log(
        `Sending order confirmation email to buyer ${buyerUserId}`,
      );
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
          'Your order receipt',
          `<p>Thanks for your order!</p><p>You can view your order receipt here: <a href="${link}">${link}</a></p>`,
          `Thanks for your order! View your receipt: ${link}`,
        );
      }
    }

    // Notify sellers (basic notification event, one per seller org)
    const sellerOrgIds = Object.keys(splits || {});
    if (sellerOrgIds.length) {
      try {
        const frontendUrl =
          this.config.get<string>('frontend.url') ||
          process.env.FRONTEND_URL ||
          'http://localhost:3001';

        for (const sellerOrgId of sellerOrgIds) {
          // Find users for this specific seller organization
          const { data: sellerUsers } = await client
            .from('organization_users')
            .select('user_id')
            .eq('organization_id', sellerOrgId);
          const recipients = (sellerUsers || []).map((r: any) => r.user_id);
          if (!recipients.length) continue;

          // Find the order for this seller among the paid orderIds
          const { data: ord } = await client
            .from('orders')
            .select('id')
            .in('id', orderIds)
            .eq('seller_org_id', sellerOrgId)
            .limit(1)
            .single();

          const sellerOrderId = ord?.id as string | undefined;

          this.logger.log(
            `Emitting order_paid notification event for seller_org=${sellerOrgId} order=${sellerOrderId}`,
          );

          await this.notifications.emitEvent({
            eventType: 'order_paid',
            organizationId: sellerOrgId,
            payload: {
              title: 'New paid order',
              body: 'An order has been paid and is ready to fulfill. Review the order, pack the items, add tracking details, and mark it as shipped.',
              order_ids: sellerOrderId ? [sellerOrderId] : [],
              recipients,
              category: 'orders',
              priority: 'high',
              cta_url: sellerOrderId
                ? `${frontendUrl}/seller/orders/${sellerOrderId}`
                : `${frontendUrl}/seller/orders`,
            },
          });
        }
      } catch (notifyErr) {
        this.logger.error(
          `Notifications emitEvent failed; continuing without blocking: ${String(
            (notifyErr as any)?.message || notifyErr,
          )}`,
        );
      }
    }

    // WhatsApp notify the specific seller for each seller org, if paired
    try {
      for (const sellerOrgId of sellerOrgIds) {
        // Find a representative order for this seller among the paid orderIds
        const { data: ord } = await client
          .from('orders')
          .select(
            `
            id,
            order_number,
            seller_org_id,
            order_items(product_snapshot)
          `,
          )
          .in('id', orderIds)
          .eq('seller_org_id', sellerOrgId)
          .limit(1)
          .single();
        if (!ord) continue;

        // Prefer product creator as the target seller user
        const creatorId =
          ord.order_items?.find((it: any) => it?.product_snapshot?.created_by)
            ?.product_snapshot?.created_by || null;

        let targetSellerUserId: string | null = creatorId;
        if (!targetSellerUserId) {
          const { data: owner } = await client
            .from('organization_users')
            .select('user_id, joined_at')
            .eq('organization_id', sellerOrgId)
            .order('joined_at', { ascending: true })
            .limit(1)
            .single();
          targetSellerUserId = owner?.user_id ?? null;
        }

        if (targetSellerUserId) {
          const { data: sellerUser } = await client
            .from('users')
            .select('id, phone_number')
            .eq('id', targetSellerUserId)
            .not('phone_number', 'is', null)
            .single();
          if (sellerUser?.phone_number) {
            const orderNumber = String(ord.order_number || ord.id);
            this.logger.log(
              `Sending WA paid update to seller user ${sellerUser.id} for order ${orderNumber}`,
            );
            await this.waTemplates.sendOrderUpdateIfPaired(
              sellerUser.id,
              String(sellerUser.phone_number),
              orderNumber,
              'paid',
              undefined,
              'en',
            );
          }
        }
      }
    } catch (waErr) {
      // do not fail webhook handling
      // eslint-disable-next-line no-console
      console.warn('WA notify seller on payment succeeded failed:', waErr);
    }

    // Clear the buyer's shopping cart after successful payment
    try {
      this.logger.log(
        `Clearing cart for buyer_org_id=${buyerOrgId}, buyer_user_id=${buyerUserId}`,
      );
      const { data: cart } = await client
        .from('shopping_carts')
        .select('id')
        .eq('buyer_org_id', buyerOrgId)
        .eq('buyer_user_id', buyerUserId)
        .single();
      if (cart?.id) {
        await client.from('cart_items').delete().eq('cart_id', cart.id);
        await client
          .from('shopping_carts')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', cart.id);
        this.logger.log(`Cleared cart ${cart.id}`);
      }
    } catch (e) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.warn('Failed to clear cart after payment:', e);
    }
  }

  private async onPaymentFailed(_pi: Stripe.PaymentIntent) {
    // Mark orders as payment_failed if we have metadata
    const client = this.supabase.getClient();
    const orderIds = safeParseArray(_pi.metadata?.order_ids);
    if (orderIds.length > 0) {
      this.logger.warn(
        `Marking orders as payment_failed for PI ${_pi.id}: ${orderIds.join(',')}`,
      );
      await client
        .from('orders')
        .update({
          payment_status: 'payment_failed',
          updated_at: new Date().toISOString(),
        })
        .in('id', orderIds);
      // Optionally append timeline entries
      for (const id of orderIds) {
        await client.from('order_timeline').insert({
          order_id: id,
          event_type: 'payment_failed',
          description: 'Payment failed via Stripe',
          metadata: { stripe_pi: _pi.id },
        });
      }
    }
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
