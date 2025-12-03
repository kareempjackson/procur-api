import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { SellersService } from '../sellers/sellers.service';

export type OfflinePaymentMethod =
  | 'bank_transfer'
  | 'cash_on_delivery'
  | 'cheque_on_delivery';

export type PaymentLinkStatus =
  | 'draft'
  | 'active'
  | 'awaiting_payment_confirmation'
  | 'paid'
  | 'expired'
  | 'cancelled';

@Injectable()
export class PaymentLinksService {
  private readonly logger = new Logger(PaymentLinksService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sellersService: SellersService,
  ) {}

  /**
   * Generate a short public code for the payment link.
   * Example: grn-8F2K9A
   */
  private generateLinkCode(): string {
    const slug = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `grn-${slug}`;
  }

  /**
   * Create a payment link for an existing order owned by the seller org.
   * This keeps v1 simple: the seller/ops creates the order first, then
   * attaches a shareable payment link to it.
   */
  async createForOrder(input: {
    sellerOrgId: string;
    orderId: string;
    createdByUserId: string;
    allowedPaymentMethods: OfflinePaymentMethod[];
    expiresAt?: string;
    buyerContact?: {
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      taxId?: string;
    };
    platformFeeAmount?: number;
    deliveryFeeAmountOverride?: number;
    taxAmountOverride?: number;
    meta?: Record<string, any>;
  }): Promise<{
    id: string;
    link_code: string;
    public_url: string;
    status: PaymentLinkStatus;
    currency: string;
    subtotal_amount: number;
    delivery_fee_amount: number;
    platform_fee_amount: number;
    tax_amount: number;
    total_amount: number;
  }> {
    // Ensure seller is fully verified before creating payment links
    await this.sellersService.ensureSellerVerified(input.sellerOrgId);

    const client = this.supabase.getClient();

    const { data: order, error: orderError } = await client
      .from('orders')
      .select(
        `
        id,
        order_number,
        buyer_org_id,
        seller_org_id,
        subtotal,
        tax_amount,
        shipping_amount,
        discount_amount,
        total_amount,
        currency
      `,
      )
      .eq('id', input.orderId)
      .eq('seller_org_id', input.sellerOrgId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found for this seller');
    }

    const subtotal = Number(order.subtotal ?? 0);
    const shipping = Number(order.shipping_amount ?? 0);
    const tax = Number(order.tax_amount ?? 0);
    const discount = Number(order.discount_amount ?? 0);
    const baseTotal = Number(order.total_amount ?? 0);

    if (!subtotal || subtotal <= 0 || !baseTotal || baseTotal <= 0) {
      throw new BadRequestException(
        'Order amounts must be positive to create a payment link',
      );
    }

    const deliveryFeeAmount =
      typeof input.deliveryFeeAmountOverride === 'number'
        ? input.deliveryFeeAmountOverride
        : shipping;
    const platformFeeAmount = Number(input.platformFeeAmount ?? 0);
    const taxAmount =
      typeof input.taxAmountOverride === 'number'
        ? input.taxAmountOverride
        : tax;

    const totalAmount =
      subtotal + deliveryFeeAmount + platformFeeAmount + taxAmount - discount;

    if (totalAmount <= 0) {
      throw new BadRequestException(
        'Computed total amount must be positive for payment link',
      );
    }

    if (
      !input.allowedPaymentMethods ||
      input.allowedPaymentMethods.length === 0
    ) {
      throw new BadRequestException(
        'At least one offline payment method must be allowed',
      );
    }

    const linkCode = this.generateLinkCode();

    const feeBreakdown = {
      subtotal_amount: subtotal,
      delivery_fee_amount: deliveryFeeAmount,
      platform_fee_amount: platformFeeAmount,
      tax_amount: taxAmount,
      discount_amount: discount,
    };

    const { data: link, error: linkError } = await client
      .from('payment_links')
      .insert({
        link_code: linkCode,
        order_id: order.id,
        seller_org_id: order.seller_org_id,
        buyer_org_id: order.buyer_org_id,
        buyer_contact: input.buyerContact || null,
        status: 'active',
        currency: (order.currency as string | null) || 'XCD',
        subtotal_amount: subtotal,
        delivery_fee_amount: deliveryFeeAmount,
        platform_fee_amount: platformFeeAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        allowed_payment_methods: input.allowedPaymentMethods,
        fee_breakdown: feeBreakdown,
        expires_at: input.expiresAt || null,
        meta: input.meta || null,
        created_by: input.createdByUserId,
      })
      .select('*')
      .single();

    if (linkError || !link) {
      this.logger.error(
        `Failed to create payment link for order ${order.id}: ${linkError?.message}`,
      );
      throw new BadRequestException(
        `Failed to create payment link: ${linkError?.message ?? 'unknown error'}`,
      );
    }

    const frontendUrl =
      process.env.FRONTEND_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001';

    return {
      id: link.id as string,
      link_code: link.link_code as string,
      public_url: `${frontendUrl}/p/${link.link_code}`,
      status: link.status as PaymentLinkStatus,
      currency: link.currency as string,
      subtotal_amount: Number(link.subtotal_amount ?? 0),
      delivery_fee_amount: Number(link.delivery_fee_amount ?? 0),
      platform_fee_amount: Number(link.platform_fee_amount ?? 0),
      tax_amount: Number(link.tax_amount ?? 0),
      total_amount: Number(link.total_amount ?? 0),
    };
  }

  /**
   * Seller flow: create a simple offline order (with one line item) and
   * immediately attach a payment link to it. This is used by the
   * "Create payment link" modal on the seller dashboard when the farmer
   * is drafting an offline transaction and the buyer may not exist yet.
   */
  async createOrderAndLinkForSeller(input: {
    sellerOrgId: string;
    buyerOrgId?: string;
    buyerName?: string;
    buyerCompany?: string;
    buyerBusinessType?: string;
    buyerEmail?: string;
    buyerPhone?: string;
    shippingAddress?: {
      line1: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    lineItems: {
      product_name: string;
      unit?: string;
      quantity: number;
      unit_price: number;
    }[];
    currency?: string;
    allowedPaymentMethods: OfflinePaymentMethod[];
    expiresAt?: string;
    notes?: string;
    deliveryDate?: string;
    createdByUserId: string;
  }) {
    // Block unverified sellers from creating offline orders + payment links
    await this.sellersService.ensureSellerVerified(input.sellerOrgId);

    const client = this.supabase.getClient();

    if (!input.lineItems || input.lineItems.length === 0) {
      throw new BadRequestException(
        'At least one product (name, unit, quantity, cost per unit) is required',
      );
    }

    for (const item of input.lineItems) {
      if (
        !item.product_name ||
        !item.unit ||
        !item.quantity ||
        !item.unit_price
      ) {
        throw new BadRequestException(
          'Each product must have a name, unit, quantity, and cost per unit',
        );
      }
    }

    const subtotal = input.lineItems.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity || 0),
      0,
    );

    if (!subtotal || subtotal <= 0) {
      throw new BadRequestException(
        'Total amount must be greater than zero to create an order',
      );
    }

    if (
      !input.allowedPaymentMethods ||
      input.allowedPaymentMethods.length === 0
    ) {
      throw new BadRequestException(
        'At least one offline payment method must be allowed',
      );
    }

    // Resolve or create buyer organization
    let buyerOrgId = input.buyerOrgId || null;

    if (!buyerOrgId) {
      if (!input.buyerName) {
        throw new BadRequestException(
          'Buyer name is required when buyer_org_id is not provided',
        );
      }

      const { data: org, error: orgError } = await client
        .from('organizations')
        .insert({
          name: input.buyerName,
          business_name: input.buyerCompany || input.buyerName,
          account_type: 'buyer',
          business_type: input.buyerBusinessType || 'general',
          status: 'pending_verification',
        })
        .select('id')
        .single();

      if (orgError || !org) {
        throw new BadRequestException(
          `Failed to create buyer organization: ${orgError?.message ?? 'unknown error'}`,
        );
      }
      buyerOrgId = org.id as string;
    } else {
      const { data: existingOrg } = await client
        .from('organizations')
        .select('id, business_type')
        .eq('id', buyerOrgId)
        .maybeSingle();
      if (!existingOrg) {
        throw new BadRequestException('Buyer organization not found');
      }
    }

    const now = new Date();
    const orderNumber = `ORD-${now.getTime()}-${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`;

    const shippingAmount = 20;
    const taxAmount = 0;
    const platformFeeAmount = Number((subtotal * 0.05).toFixed(2));
    const discountAmount = 0;
    const totalAmount = subtotal + shippingAmount + platformFeeAmount;

    const shippingAddressSnapshot = input.shippingAddress
      ? {
          contact_name: input.buyerName ?? undefined,
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2,
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          postal_code: input.shippingAddress.postal_code,
          country: input.shippingAddress.country,
          phone: input.buyerPhone ?? undefined,
        }
      : null;

    // Create order
    const { data: order, error: orderError } = await client
      .from('orders')
      .insert({
        order_number: orderNumber,
        buyer_org_id: buyerOrgId,
        seller_org_id: input.sellerOrgId,
        status: 'pending',
        payment_status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        currency: (input.currency || 'XCD').toUpperCase(),
        shipping_address: shippingAddressSnapshot,
        billing_address: shippingAddressSnapshot,
        buyer_notes: input.notes,
        estimated_delivery_date: input.deliveryDate || null,
      })
      .select('*')
      .single();

    if (orderError || !order) {
      throw new BadRequestException(
        `Failed to create order for payment link: ${orderError?.message ?? 'unknown error'}`,
      );
    }

    // Attach payment link to this new order
    const link = await this.createForOrder({
      sellerOrgId: input.sellerOrgId,
      orderId: order.id as string,
      createdByUserId: input.createdByUserId,
      allowedPaymentMethods: input.allowedPaymentMethods,
      expiresAt: input.expiresAt,
      buyerContact: {
        name: input.buyerName,
        company: input.buyerCompany,
        email: input.buyerEmail,
        phone: input.buyerPhone,
      },
      platformFeeAmount,
      deliveryFeeAmountOverride: shippingAmount,
      taxAmountOverride: taxAmount,
      meta: {
        flow: 'seller_offline_payment_link',
        line_items: input.lineItems,
      },
    });

    return {
      order_id: order.id as string,
      order_number: order.order_number as string,
      payment_link: link,
    };
  }

  /**
   * Seller flow: update an existing offline order + payment link created
   * via the seller dashboard. This is limited to non-final links and
   * reuses the same fee logic as creation.
   */
  async updateOfflineOrderAndLinkForSeller(input: {
    sellerOrgId: string;
    paymentLinkId: string;
    buyerName?: string;
    buyerCompany?: string;
    buyerBusinessType?: string;
    buyerEmail?: string;
    buyerPhone?: string;
    shippingAddress?: {
      line1: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    lineItems?: {
      product_name: string;
      unit?: string;
      quantity: number;
      unit_price: number;
    }[];
    currency?: string;
    allowedPaymentMethods?: OfflinePaymentMethod[];
    expiresAt?: string | null;
    notes?: string;
    deliveryDate?: string;
    updatedByUserId: string;
  }) {
    await this.sellersService.ensureSellerVerified(input.sellerOrgId);

    const client = this.supabase.getClient();

    const { data: link, error: linkError } = await client
      .from('payment_links')
      .select(
        'id, status, seller_org_id, order_id, meta, buyer_contact, currency, subtotal_amount, delivery_fee_amount, platform_fee_amount, tax_amount, total_amount, fee_breakdown, expires_at, allowed_payment_methods',
      )
      .eq('id', input.paymentLinkId)
      .eq('seller_org_id', input.sellerOrgId)
      .single();

    if (linkError || !link) {
      throw new NotFoundException('Payment link not found for this seller');
    }

    const currentStatus = link.status as PaymentLinkStatus;
    if (
      currentStatus === 'paid' ||
      currentStatus === 'expired' ||
      currentStatus === 'cancelled' ||
      currentStatus === 'awaiting_payment_confirmation'
    ) {
      throw new BadRequestException(
        'This payment link can no longer be edited. Please create a new link if changes are needed.',
      );
    }

    const meta = (link.meta as any) || {};
    if (meta.flow && meta.flow !== 'seller_offline_payment_link') {
      // To avoid accidentally mutating non-offline flows
      throw new BadRequestException(
        'Only offline payment links created from the seller dashboard can be edited here.',
      );
    }

    const lineItems =
      (input.lineItems && input.lineItems.length > 0
        ? input.lineItems
        : (meta.line_items as any[] | undefined)) ?? [];

    if (!lineItems || lineItems.length === 0) {
      throw new BadRequestException(
        'At least one product (name, unit, quantity, cost per unit) is required',
      );
    }

    for (const item of lineItems) {
      if (
        !item.product_name ||
        !item.unit ||
        !item.quantity ||
        !item.unit_price
      ) {
        throw new BadRequestException(
          'Each product must have a name, unit, quantity, and cost per unit',
        );
      }
    }

    const subtotal = lineItems.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity || 0),
      0,
    );

    if (!subtotal || subtotal <= 0) {
      throw new BadRequestException(
        'Total amount must be greater than zero to update this order',
      );
    }

    const allowedMethods =
      (input.allowedPaymentMethods &&
        input.allowedPaymentMethods.length > 0 &&
        input.allowedPaymentMethods) ||
      (link.allowed_payment_methods as OfflinePaymentMethod[] | undefined);

    if (!allowedMethods || allowedMethods.length === 0) {
      throw new BadRequestException(
        'At least one offline payment method must be allowed',
      );
    }

    const currency = (
      input.currency ||
      (link.currency as string) ||
      'XCD'
    ).toUpperCase();

    const deliveryFeeAmount =
      typeof link.delivery_fee_amount === 'number'
        ? Number(link.delivery_fee_amount)
        : 20;
    const taxAmount =
      typeof link.tax_amount === 'number' ? Number(link.tax_amount) : 0;
    const platformFeeAmount = Number((subtotal * 0.05).toFixed(2));
    const discountAmount = Number(link.fee_breakdown?.discount_amount ?? 0);
    const totalAmount =
      subtotal +
      deliveryFeeAmount +
      platformFeeAmount +
      taxAmount -
      discountAmount;

    const updatedBuyerContact = {
      ...(link.buyer_contact as any),
      name: input.buyerName ?? (link.buyer_contact as any)?.name,
      company: input.buyerCompany ?? (link.buyer_contact as any)?.company,
      email: input.buyerEmail ?? (link.buyer_contact as any)?.email,
      phone: input.buyerPhone ?? (link.buyer_contact as any)?.phone,
    };

    const shippingAddressSnapshot = input.shippingAddress
      ? {
          contact_name:
            input.buyerName ??
            (link.buyer_contact as any)?.name ??
            (link.buyer_contact as any)?.contact_name,
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2,
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          postal_code: input.shippingAddress.postal_code,
          country: input.shippingAddress.country,
          phone:
            input.buyerPhone ??
            (link.buyer_contact as any)?.phone ??
            (link.buyer_contact as any)?.contact_phone,
        }
      : null;

    // Update underlying order snapshot
    if (link.order_id) {
      const { error: orderUpdateError } = await client
        .from('orders')
        .update({
          subtotal,
          shipping_amount: deliveryFeeAmount,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          currency,
          shipping_address: shippingAddressSnapshot,
          billing_address: shippingAddressSnapshot,
          buyer_notes: input.notes ?? undefined,
          estimated_delivery_date: input.deliveryDate ?? null,
        })
        .eq('id', link.order_id);

      if (orderUpdateError) {
        this.logger.error(
          `Failed to update order ${link.order_id} for payment link ${link.id}: ${orderUpdateError.message}`,
        );
        throw new BadRequestException(
          `Failed to update order for payment link: ${orderUpdateError.message}`,
        );
      }
    }

    const updatedFeeBreakdown = {
      subtotal_amount: subtotal,
      delivery_fee_amount: deliveryFeeAmount,
      platform_fee_amount: platformFeeAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
    };

    const { data: updatedLink, error: updateLinkError } = await client
      .from('payment_links')
      .update({
        subtotal_amount: subtotal,
        delivery_fee_amount: deliveryFeeAmount,
        platform_fee_amount: platformFeeAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency,
        buyer_contact: updatedBuyerContact,
        allowed_payment_methods: allowedMethods,
        expires_at: input.expiresAt ?? link.expires_at,
        fee_breakdown: updatedFeeBreakdown,
        meta: {
          ...(meta || {}),
          flow: 'seller_offline_payment_link',
          line_items: lineItems,
          last_updated_by: input.updatedByUserId,
        },
      })
      .eq('id', input.paymentLinkId)
      .select('*')
      .single();

    if (updateLinkError || !updatedLink) {
      this.logger.error(
        `Failed to update payment link ${link.id}: ${updateLinkError?.message}`,
      );
      throw new BadRequestException(
        `Failed to update payment link: ${updateLinkError?.message ?? 'unknown error'}`,
      );
    }

    const frontendUrl =
      process.env.FRONTEND_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001';

    return {
      id: updatedLink.id as string,
      link_code: updatedLink.link_code as string,
      public_url: `${frontendUrl}/p/${updatedLink.link_code}`,
      status: updatedLink.status as PaymentLinkStatus,
      currency: (updatedLink.currency as string) || currency,
      subtotal_amount: Number(updatedLink.subtotal_amount ?? subtotal),
      delivery_fee_amount: Number(
        updatedLink.delivery_fee_amount ?? deliveryFeeAmount,
      ),
      platform_fee_amount: Number(
        updatedLink.platform_fee_amount ?? platformFeeAmount,
      ),
      tax_amount: Number(updatedLink.tax_amount ?? taxAmount),
      total_amount: Number(updatedLink.total_amount ?? totalAmount),
    };
  }

  /**
   * Fetch a payment link and its public mini-site payload by code.
   * This is used by the buyer-facing mini-site (with or without account).
   */
  async getPublicByCode(code: string): Promise<any> {
    const client = this.supabase.getClient();

    const { data: link, error } = await client
      .from('payment_links')
      .select(
        `
        *,
        orders:orders!payment_links_order_id_fkey (
          id,
          order_number,
          status,
          payment_status,
          buyer_org_id,
          seller_org_id,
          subtotal,
          tax_amount,
          shipping_amount,
          discount_amount,
          total_amount,
          currency,
          shipping_address,
          estimated_delivery_date,
          buyer_notes,
          order_items (*)
        )
      `,
      )
      .eq('link_code', code)
      .single();

    if (error || !link) {
      throw new NotFoundException('Payment link not found');
    }

    const pl = link as any;
    const order = (pl.orders as any) || null;

    const buyerSnapshot = (pl.buyer_contact as any) || {};

    const feeBreakdown = pl.fee_breakdown || {
      subtotal_amount: Number(pl.subtotal_amount ?? order?.subtotal ?? 0),
      delivery_fee_amount: Number(
        pl.delivery_fee_amount ?? order?.shipping_amount ?? 0,
      ),
      platform_fee_amount: Number(pl.platform_fee_amount ?? 0),
      tax_amount: Number(pl.tax_amount ?? order?.tax_amount ?? 0),
      discount_amount: Number(order?.discount_amount ?? 0),
    };

    const orderItems = (order?.order_items as any[]) || [];
    const meta = (pl.meta as any) || {};
    const metaLineItems = Array.isArray(meta.line_items)
      ? (meta.line_items as any[])
      : undefined;
    const metaLineItem = meta.line_item as any | undefined;

    let itemsForDisplay: any[] = [];
    if (orderItems.length > 0) {
      itemsForDisplay = orderItems;
    } else if (metaLineItems && metaLineItems.length > 0) {
      itemsForDisplay = metaLineItems.map((li, idx) => ({
        id: li.id || `offline-line-item-${idx}`,
        product_name: li.product_name,
        unit: li.unit,
        quantity: li.quantity,
        unit_price: li.unit_price,
        total_price: Number(li.unit_price) * Number(li.quantity || 0),
      }));
    } else if (metaLineItem) {
      itemsForDisplay = [
        {
          id: 'offline-line-item',
          product_name: metaLineItem.product_name,
          unit: metaLineItem.unit,
          quantity: metaLineItem.quantity,
          unit_price: metaLineItem.unit_price,
          total_price:
            Number(metaLineItem.unit_price) *
            Number(metaLineItem.quantity || 0),
        },
      ];
    }

    return {
      code: pl.link_code,
      status: pl.status,
      currency: pl.currency,
      amounts: {
        subtotal: Number(pl.subtotal_amount),
        delivery_fee: Number(pl.delivery_fee_amount),
        platform_fee: Number(pl.platform_fee_amount),
        tax: Number(pl.tax_amount),
        discount: Number(order?.discount_amount ?? 0),
        total: Number(pl.total_amount),
      },
      fee_breakdown: feeBreakdown,
      allowed_payment_methods: pl.allowed_payment_methods || [],
      expires_at: pl.expires_at,
      order: order
        ? {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            payment_status: order.payment_status,
            items: itemsForDisplay,
            notes: order.buyer_notes,
            shipping_address: order.shipping_address,
            estimated_delivery_date: order.estimated_delivery_date,
          }
        : null,
      seller: order
        ? {
            id: order.seller_org_id,
          }
        : null,
      buyer: {
        organization: order && {
          id: order.buyer_org_id,
        },
        contact: {
          name: buyerSnapshot.name || null,
          company: buyerSnapshot.company || null,
          email: buyerSnapshot.email || null,
          phone: buyerSnapshot.phone || null,
          tax_id: buyerSnapshot.taxId || null,
        },
      },
      receipt: {
        url: pl.receipt_url || null,
      },
    };
  }

  /**
   * Buyer-facing action: record that they intend to pay via a specific
   * offline method (bank transfer / cash / cheque). This does not mark
   * the payment as settled; admins must confirm separately.
   */
  async createOfflinePaymentIntent(input: {
    linkCode: string;
    paymentMethod: OfflinePaymentMethod;
    paymentReference?: string;
    proofUrl?: string;
    buyerContact?: {
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      taxId?: string;
    };
  }): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data: link, error } = await client
      .from('payment_links')
      .select('*')
      .eq('link_code', input.linkCode)
      .single();

    if (error || !link) {
      throw new NotFoundException('Payment link not found');
    }

    if (link.status === 'expired' || link.status === 'cancelled') {
      throw new BadRequestException('This payment link is no longer active');
    }

    if (link.status === 'paid') {
      throw new BadRequestException('This payment link is already paid');
    }

    const allowed: string[] = link.allowed_payment_methods || [];
    if (!allowed.includes(input.paymentMethod)) {
      throw new BadRequestException(
        `Payment method ${input.paymentMethod} is not allowed for this link`,
      );
    }

    const now = new Date().toISOString();

    const { error: insertError } = await client
      .from('payment_link_payments')
      .insert({
        payment_link_id: link.id,
        amount: link.total_amount,
        currency: link.currency,
        payment_method_type: input.paymentMethod,
        status: 'awaiting_manual_confirmation',
        payment_reference: input.paymentReference || null,
        proof_url: input.proofUrl || null,
        meta: {
          flow: 'offline_payment_link',
          created_from_public_link: true,
          buyer_contact: input.buyerContact || null,
        },
      });

    if (insertError) {
      this.logger.error(
        `Failed to create offline payment intent for link ${link.id}: ${insertError.message}`,
      );
      throw new BadRequestException(
        `Failed to create offline payment intent: ${insertError.message}`,
      );
    }

    const { error: updateError } = await client
      .from('payment_links')
      .update({
        status: 'awaiting_payment_confirmation',
        updated_at: now,
      })
      .eq('id', link.id);

    if (updateError) {
      this.logger.error(
        `Failed to update payment link status for link ${link.id}: ${updateError.message}`,
      );
      throw new BadRequestException(
        `Failed to update payment link: ${updateError.message}`,
      );
    }

    return { success: true };
  }

  /**
   * Seller-facing listing of all payment links for their organization.
   */
  async listForSeller(sellerOrgId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('payment_links')
      .select(
        `
        id,
        link_code,
        status,
        total_amount,
        currency,
        created_at,
        expires_at,
        meta
      `,
      )
      .eq('seller_org_id', sellerOrgId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to list payment links: ${error.message}`,
      );
    }

    const frontendUrl =
      process.env.FRONTEND_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001';

    return (data || []).map((pl: any) => ({
      id: pl.id as string,
      code: pl.link_code as string,
      status: pl.status as string,
      total_amount: Number(pl.total_amount ?? 0),
      currency: (pl.currency as string) || 'XCD',
      created_at: pl.created_at as string,
      expires_at: pl.expires_at as string | null,
      public_url: `${frontendUrl}/p/${pl.link_code}`,
    }));
  }

  /**
   * Admin-facing action: confirm that an offline payment was received.
   * Marks the latest payment_link_payments row as paid, updates the
   * payment link + underlying order payment_status, and optionally
   * records basic transaction metadata.
   */
  async confirmOfflinePayment(input: {
    paymentLinkId: string;
    adminUserId: string;
    paymentReference?: string;
    proofUrl?: string;
  }): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data: link, error: linkError } = await client
      .from('payment_links')
      .select('*')
      .eq('id', input.paymentLinkId)
      .single();

    if (linkError || !link) {
      throw new NotFoundException('Payment link not found');
    }

    const { data: payment, error: payError } = await client
      .from('payment_link_payments')
      .select('*')
      .eq('payment_link_id', input.paymentLinkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (payError || !payment) {
      throw new BadRequestException(
        'No payment intent found to confirm for this link',
      );
    }

    const nowIso = new Date().toISOString();

    const { error: updatePaymentError } = await client
      .from('payment_link_payments')
      .update({
        status: 'paid',
        payment_reference: input.paymentReference || payment.payment_reference,
        proof_url: input.proofUrl || payment.proof_url,
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', payment.id);

    if (updatePaymentError) {
      throw new BadRequestException(
        `Failed to update payment intent: ${updatePaymentError.message}`,
      );
    }

    const { error: updateLinkError } = await client
      .from('payment_links')
      .update({
        status: 'paid',
        updated_at: nowIso,
      })
      .eq('id', link.id);

    if (updateLinkError) {
      throw new BadRequestException(
        `Failed to mark payment link paid: ${updateLinkError.message}`,
      );
    }

    if (link.order_id) {
      const { error: orderError } = await client
        .from('orders')
        .update({
          payment_status: 'paid',
          paid_at: nowIso,
        })
        .eq('id', link.order_id as string);

      if (orderError) {
        throw new BadRequestException(
          `Failed to update order payment status: ${orderError.message}`,
        );
      }
    }

    // Optionally, a proper financial transaction entry can be created
    // here in the transactions table / direct-deposit clearing flows.

    return { success: true };
  }
}
