import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { OrganizationStatus } from '../common/enums/organization-status.enum';
import { SellerBusinessType } from '../common/enums/seller-business-type.enum';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponseDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  AcceptOrderDto,
  RejectOrderDto,
  OrderQueryDto,
  OrderResponseDto,
  TransactionQueryDto,
  TransactionResponseDto,
  TransactionSummaryDto,
  CreateScheduledPostDto,
  UpdateScheduledPostDto,
  PostQueryDto,
  ScheduledPostResponseDto,
  DashboardMetricsDto,
  SalesAnalyticsDto,
  ProductAnalyticsDto,
  AnalyticsQueryDto,
  ProductImageDto,
  BuyerReviewDto,
} from './dto';
import { SellerStatusUpdateRequestDto } from './dto/order-status-request.dto';
import { SellerCatalogProductDto } from './dto/product.dto';
import { SellerHomeResponseDto, BuyerRequestSummaryDto } from './dto/home.dto';
import {
  CreateFarmVisitRequestDto,
  FarmVisitRequestDto,
} from './dto/farm-visit.dto';
import {
  CreateSellerHarvestDto,
  HarvestRequestResponseDto,
  HarvestFeedItemDto,
  SellerHarvestCommentDto,
  CreateSellerHarvestCommentDto,
  CreateHarvestBuyerRequestDto,
  HarvestBuyerRequestDto,
  AcknowledgeHarvestBuyerRequestDto,
} from './dto/harvest.dto';
import {
  DatabaseProduct,
  DatabaseOrder,
  DatabaseTransaction,
  DatabaseScheduledPost,
  CreateProductData,
  UpdateProductData,
  CreateOrderData,
  UpdateOrderData,
  CreateScheduledPostData,
} from '../database/types/database.types';
import { EventsService } from '../events/events.service';
import { EventTypes, AggregateTypes } from '../events/event-types';

@Injectable()
export class SellersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Load platform fee configuration (shared settings controlled in the admin panel).
   * For seller receipts/invoices, we use `seller_delivery_share` to show what the
   * seller covers for delivery (distinct from `orders.shipping_amount`, which is
   * the buyer-facing delivery share).
   */
  async getPlatformFeesConfig(): Promise<{
    platformFeePercent: number;
    deliveryFlatFee: number;
    buyerDeliveryShare: number;
    sellerDeliveryShare: number;
    currency: string;
  }> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('platform_fees_config')
      .select(
        'platform_fee_percent, delivery_flat_fee, buyer_delivery_share, seller_delivery_share, currency',
      )
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Fail-open: keep seller flows working with sensible defaults.
      return {
        platformFeePercent: 5,
        deliveryFlatFee: 20,
        buyerDeliveryShare: 0,
        sellerDeliveryShare: 0,
        currency: 'XCD',
      };
    }

    const row = data as {
      platform_fee_percent: number | string | null;
      delivery_flat_fee: number | string | null;
      buyer_delivery_share: number | string | null;
      seller_delivery_share: number | string | null;
      currency: string | null;
    };

    return {
      platformFeePercent: Number(row.platform_fee_percent ?? 0) || 0,
      deliveryFlatFee: Number(row.delivery_flat_fee ?? 0) || 0,
      buyerDeliveryShare: Number(row.buyer_delivery_share ?? 0) || 0,
      sellerDeliveryShare: Number(row.seller_delivery_share ?? 0) || 0,
      currency: (row.currency as string | null) ?? 'XCD',
    };
  }

  /**
   * Ensure the seller organization is allowed to sell / earn on the platform.
   * - Organization must exist and be a seller
   * - Organization status must be ACTIVE (not pending_verification / suspended)
   * - For farmer sellers, both farmers_id_verified and farm_verified must be true
   *
   * NOTE: This method is intentionally kept private so that external
   * callers go through the public ensureSellerVerified(...) helper
   * below. This keeps the verification rules centralized while still
   * allowing other modules (e.g. payment links) to reuse them.
   */
  private async assertSellerVerified(sellerOrgId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: org, error } = await client
      .from('organizations')
      .select(
        'id, account_type, business_type, status, farmers_id_verified, farm_verified',
      )
      .eq('id', sellerOrgId)
      .single();

    if (error || !org) {
      throw new ForbiddenException(
        'Seller organization not found. Please contact support.',
      );
    }

    if ((org.account_type as string) !== 'seller') {
      throw new ForbiddenException(
        'Only seller organizations can access seller features.',
      );
    }

    const status = org.status as OrganizationStatus | string;
    if (status === OrganizationStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your seller account is suspended. Please contact support.',
      );
    }

    if (status !== OrganizationStatus.ACTIVE) {
      // Includes pending_verification or any other non-active state
      throw new ForbiddenException(
        'Your seller account is pending admin review. An administrator must activate your business before you can sell on Procur.',
      );
    }

    const businessType = org.business_type as
      | SellerBusinessType
      | string
      | null;
    if (businessType === SellerBusinessType.FARMERS) {
      const farmersIdVerified = Boolean(
        (org as any).farmers_id_verified ?? false,
      );
      const farmVerified = Boolean((org as any).farm_verified ?? false);

      if (!farmersIdVerified || !farmVerified) {
        const missing: string[] = [];
        if (!farmersIdVerified) missing.push('farmer ID');
        if (!farmVerified) missing.push('farm');
        const label = missing.join(' and ');
        throw new ForbiddenException(
          `Your ${label} must be verified by an admin before you can list products, accept orders, or receive payments.`,
        );
      }
    }
  }

  /**
   * Public wrapper so other modules (e.g. payment links) can enforce
   * the same verification rules before allowing sensitive actions
   * like creating payment links or accepting payments.
   */
  async ensureSellerVerified(sellerOrgId: string): Promise<void> {
    await this.assertSellerVerified(sellerOrgId);
  }

  // ==================== PRODUCT MANAGEMENT ====================

  async createProduct(
    sellerOrgId: string,
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // If linked to an admin catalog product, enforce configured price range
    if (createProductDto.admin_product_id) {
      const { data: adminProduct, error: adminError } = await client
        .from('admin_products')
        .select('id, is_active, min_seller_price, max_seller_price')
        .eq('id', createProductDto.admin_product_id)
        .single();

      if (adminError || !adminProduct || adminProduct.is_active === false) {
        throw new BadRequestException(
          'Invalid or inactive admin catalog product reference',
        );
      }

      const price = createProductDto.base_price;
      const minSellerPrice = adminProduct.min_seller_price as number | null;
      const maxSellerPrice = adminProduct.max_seller_price as number | null;

      if (minSellerPrice != null && price < Number(minSellerPrice)) {
        throw new BadRequestException(
          `Price must be at least ${Number(minSellerPrice).toFixed(
            2,
          )} for this catalog product`,
        );
      }

      if (maxSellerPrice != null && price > Number(maxSellerPrice)) {
        throw new BadRequestException(
          `Price must be at most ${Number(maxSellerPrice).toFixed(
            2,
          )} for this catalog product`,
        );
      }
    }

    // Generate slug if not provided
    const slug = await this.generateProductSlug(createProductDto.name);

    const { images, ...productCore } = createProductDto as any;

    const productData: CreateProductData = {
      seller_org_id: sellerOrgId,
      ...productCore,
      created_by: userId,
      slug,
      admin_product_id: createProductDto.admin_product_id,
    };

    const { data, error } = await client
      .from('products')
      .insert(productData)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create product: ${error.message}`,
      );
    }

    // If images were provided, insert them
    if (images && Array.isArray(images) && images.length > 0) {
      const payload = images.map((img: ProductImageDto, idx: number) => ({
        product_id: data.id,
        image_url: img.image_url,
        alt_text: img.alt_text ?? `${data.name} - Image ${idx + 1}`,
        display_order: img.display_order ?? idx,
        is_primary: img.is_primary ?? idx === 0,
      }));

      const { error: imgError } = await client
        .from('product_images')
        .insert(payload);

      if (imgError) {
        // Non-fatal: product is created but image insert failed
        // Optionally log or track this
      }
    }

    // Fetch with images to return full response
    const { data: withImages } = await client
      .from('products')
      .select('*, product_images(*)')
      .eq('id', data.id)
      .single();

    // Emit product created event
    await this.eventsService.emit({
      type: EventTypes.Product.CREATED,
      aggregateType: AggregateTypes.PRODUCT,
      aggregateId: data.id,
      actorId: userId,
      organizationId: sellerOrgId,
      payload: {
        name: data.name,
        price: data.base_price,
        category: data.category,
        adminProductId: data.admin_product_id,
      },
    });

    return this.mapProductToResponse(withImages ?? data);
  }

  async getProducts(
    sellerOrgId: string,
    query: ProductQueryDto,
  ): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      is_featured,
      is_organic,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    let queryBuilder = client
      .from('products')
      .select('*, product_images(*)', { count: 'exact' })
      .eq('seller_org_id', sellerOrgId);

    // Apply filters
    if (search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    if (is_featured !== undefined) {
      queryBuilder = queryBuilder.eq('is_featured', is_featured);
    }

    if (is_organic !== undefined) {
      queryBuilder = queryBuilder.eq('is_organic', is_organic);
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(sort_by, {
      ascending: sort_order === 'asc',
    });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch products: ${error.message}`,
      );
    }

    const products =
      data?.map((product) => this.mapProductToResponse(product)) || [];

    return {
      products,
      total: count || 0,
      page,
      limit,
    };
  }

  async listCatalogProducts(
    sellerOrgId: string,
  ): Promise<SellerCatalogProductDto[]> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('admin_products')
      .select(
        'id, name, category, unit, base_price, min_seller_price, max_seller_price, short_description',
      )
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new BadRequestException(
        `Failed to load catalog products: ${error.message}`,
      );
    }

    return (
      data?.map(
        (p: any): SellerCatalogProductDto => ({
          id: p.id as string,
          name: p.name as string,
          category: (p.category as string | null) ?? null,
          unit: p.unit as string,
          basePrice: Number(p.base_price ?? 0),
          minSellerPrice:
            p.min_seller_price != null ? Number(p.min_seller_price) : null,
          maxSellerPrice:
            p.max_seller_price != null ? Number(p.max_seller_price) : null,
          shortDescription: (p.short_description as string | null) ?? null,
        }),
      ) ?? []
    );
  }

  async getProductById(
    sellerOrgId: string,
    productId: string,
  ): Promise<ProductResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('products')
      .select('*, product_images(*)')
      .eq('id', productId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductToResponse(data);
  }

  async updateProduct(
    sellerOrgId: string,
    productId: string,
    updateProductDto: UpdateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if product exists and belongs to seller, and load current admin_product_id / base_price
    const { data: existing, error: existingError } = await client
      .from('products')
      .select('id, seller_org_id, admin_product_id, base_price')
      .eq('id', productId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (existingError || !existing) {
      throw new NotFoundException('Product not found');
    }

    // Determine which admin_product_id to validate against (existing or updated)
    const nextAdminProductId =
      updateProductDto.admin_product_id !== undefined
        ? updateProductDto.admin_product_id
        : ((existing.admin_product_id as string | null) ?? null);

    // If there is an admin catalog mapping and price is being changed, enforce range
    if (nextAdminProductId && updateProductDto.base_price !== undefined) {
      const { data: adminProduct, error: adminError } = await client
        .from('admin_products')
        .select('id, is_active, min_seller_price, max_seller_price')
        .eq('id', nextAdminProductId)
        .single();

      if (adminError || !adminProduct || adminProduct.is_active === false) {
        throw new BadRequestException(
          'Invalid or inactive admin catalog product reference',
        );
      }

      const price = updateProductDto.base_price;
      const minSellerPrice = adminProduct.min_seller_price as number | null;
      const maxSellerPrice = adminProduct.max_seller_price as number | null;

      if (minSellerPrice != null && price < Number(minSellerPrice)) {
        throw new BadRequestException(
          `Price must be at least ${Number(minSellerPrice).toFixed(
            2,
          )} for this catalog product`,
        );
      }

      if (maxSellerPrice != null && price > Number(maxSellerPrice)) {
        throw new BadRequestException(
          `Price must be at most ${Number(maxSellerPrice).toFixed(
            2,
          )} for this catalog product`,
        );
      }
    }

    const updateData: UpdateProductData = {
      ...updateProductDto,
      updated_by: userId,
      admin_product_id: nextAdminProductId ?? undefined,
    };

    // Generate new slug if name is being updated
    if (updateProductDto.name) {
      updateData.slug = await this.generateProductSlug(
        updateProductDto.name,
        productId,
      );
    }

    const { data, error } = await client
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('seller_org_id', sellerOrgId)
      .select('*, product_images(*)')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update product: ${error.message}`,
      );
    }

    // Emit product updated event
    await this.eventsService.emit({
      type: EventTypes.Product.UPDATED,
      aggregateType: AggregateTypes.PRODUCT,
      aggregateId: productId,
      actorId: userId,
      organizationId: sellerOrgId,
      payload: { changedFields: Object.keys(updateProductDto) },
    });

    return this.mapProductToResponse(data);
  }

  async deleteProduct(sellerOrgId: string, productId: string): Promise<void> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if product exists and belongs to seller
    await this.getProductById(sellerOrgId, productId);

    const { error } = await client
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('seller_org_id', sellerOrgId);

    if (error) {
      throw new BadRequestException(
        `Failed to delete product: ${error.message}`,
      );
    }

    // Emit product deleted event
    await this.eventsService.emit({
      type: EventTypes.Product.DELETED,
      aggregateType: AggregateTypes.PRODUCT,
      aggregateId: productId,
      organizationId: sellerOrgId,
      payload: { productId },
    });
  }

  async addProductImage(
    sellerOrgId: string,
    productId: string,
    imageDto: ProductImageDto,
  ): Promise<void> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if product exists and belongs to seller
    await this.getProductById(sellerOrgId, productId);

    const { error } = await client.from('product_images').insert({
      product_id: productId,
      ...imageDto,
    });

    if (error) {
      throw new BadRequestException(
        `Failed to add product image: ${error.message}`,
      );
    }
  }

  async deleteProductImage(
    sellerOrgId: string,
    productId: string,
    imageId: string,
  ): Promise<void> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if product exists and belongs to seller
    await this.getProductById(sellerOrgId, productId);

    const { error } = await client
      .from('product_images')
      .delete()
      .eq('id', imageId)
      .eq('product_id', productId);

    if (error) {
      throw new BadRequestException(
        `Failed to delete product image: ${error.message}`,
      );
    }
  }

  // ==================== ORDER MANAGEMENT ====================

  async getOrders(
    sellerOrgId: string,
    query: OrderQueryDto,
  ): Promise<{
    orders: OrderResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();
    const {
      page = 1,
      limit = 20,
      status,
      payment_status,
      buyer_org_id,
      order_number,
      from_date,
      to_date,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    let queryBuilder = client
      .from('orders')
      .select(
        `
        *,
        order_items(*, products:products(id, product_images(id, image_url, is_primary, display_order))),
        organizations!buyer_org_id(name, business_name)
      `,
        { count: 'exact' },
      )
      .eq('seller_org_id', sellerOrgId);

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    if (payment_status) {
      queryBuilder = queryBuilder.eq('payment_status', payment_status);
    }

    if (buyer_org_id) {
      queryBuilder = queryBuilder.eq('buyer_org_id', buyer_org_id);
    }

    if (order_number) {
      queryBuilder = queryBuilder.ilike('order_number', `%${order_number}%`);
    }

    if (from_date) {
      queryBuilder = queryBuilder.gte('created_at', from_date);
    }

    if (to_date) {
      queryBuilder = queryBuilder.lte('created_at', to_date);
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(sort_by, {
      ascending: sort_order === 'asc',
    });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(`Failed to fetch orders: ${error.message}`);
    }

    const orders = data?.map((order) => this.mapOrderToResponse(order)) || [];

    return {
      orders,
      total: count || 0,
      page,
      limit,
    };
  }

  async getOrderById(
    sellerOrgId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('orders')
      .select(
        `
        *,
        order_items(*, products:products(id, product_images(id, image_url, is_primary, display_order))),
        order_timeline(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .eq('id', orderId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderToResponse(data);
  }

  async acceptOrder(
    sellerOrgId: string,
    orderId: string,
    acceptOrderDto: AcceptOrderDto,
    userId: string,
  ): Promise<OrderResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if order exists and belongs to seller
    const order = await this.getOrderById(sellerOrgId, orderId);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        'Order can only be accepted when in pending status',
      );
    }

    const updateData: UpdateOrderData = {
      status: 'accepted',
      seller_notes: acceptOrderDto.seller_notes,
      estimated_delivery_date: acceptOrderDto.estimated_delivery_date,
      shipping_method: acceptOrderDto.shipping_method,
    };

    const { data, error } = await client
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('seller_org_id', sellerOrgId)
      .select(
        `
        *,
        order_items(*, products:products(id, product_images(id, image_url, is_primary, display_order))),
        order_timeline(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException(`Failed to accept order: ${error.message}`);
    }

    // Emit order accepted event
    await this.eventsService.emit({
      type: EventTypes.Order.ACCEPTED,
      aggregateType: AggregateTypes.ORDER,
      aggregateId: orderId,
      actorId: userId,
      organizationId: sellerOrgId,
      payload: {
        orderNumber: order.order_number,
        estimatedDeliveryDate: acceptOrderDto.estimated_delivery_date,
      },
    });

    return this.mapOrderToResponse(data);
  }

  async rejectOrder(
    sellerOrgId: string,
    orderId: string,
    rejectOrderDto: RejectOrderDto,
    userId: string,
  ): Promise<OrderResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if order exists and belongs to seller
    const order = await this.getOrderById(sellerOrgId, orderId);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        'Order can only be rejected when in pending status',
      );
    }

    const updateData: UpdateOrderData = {
      status: 'rejected',
      seller_notes: `${rejectOrderDto.reason}${rejectOrderDto.seller_notes ? ` - ${rejectOrderDto.seller_notes}` : ''}`,
    };

    const { data, error } = await client
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('seller_org_id', sellerOrgId)
      .select(
        `
        *,
        order_items(*, products:products(id, product_images(id, image_url, is_primary, display_order))),
        order_timeline(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException(`Failed to reject order: ${error.message}`);
    }

    // Emit order rejected event
    await this.eventsService.emit({
      type: EventTypes.Order.REJECTED,
      aggregateType: AggregateTypes.ORDER,
      aggregateId: orderId,
      actorId: userId,
      organizationId: sellerOrgId,
      payload: {
        orderNumber: order.order_number,
        reason: rejectOrderDto.reason,
      },
    });

    return this.mapOrderToResponse(data);
  }

  async updateOrderStatus(
    sellerOrgId: string,
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    userId: string,
  ): Promise<OrderResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if order exists and belongs to seller
    const existingOrder = await this.getOrderById(sellerOrgId, orderId);
    const previousStatus = existingOrder.status;

    const updateData: UpdateOrderData = {
      ...updateOrderStatusDto,
    };

    const { data, error } = await client
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('seller_org_id', sellerOrgId)
      .select(
        `
        *,
        order_items(*, products:products(id, product_images(id, image_url, is_primary, display_order))),
        order_timeline(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update order status: ${error.message}`,
      );
    }

    // If order is being marked as delivered, credit the seller's balance
    if (
      updateOrderStatusDto.status === 'delivered' &&
      previousStatus !== 'delivered'
    ) {
      const totalAmountCents = Math.round(
        Number(existingOrder.total_amount || 0) * 100,
      );

      if (totalAmountCents > 0) {
        // Check if seller already has a balance record
        const { data: existingBalance } = await client
          .from('seller_balances')
          .select('id, available_amount_cents')
          .eq('seller_org_id', sellerOrgId)
          .maybeSingle();

        if (existingBalance) {
          // Update existing balance
          await client
            .from('seller_balances')
            .update({
              available_amount_cents:
                Number(existingBalance.available_amount_cents || 0) +
                totalAmountCents,
              updated_at: new Date().toISOString(),
            })
            .eq('seller_org_id', sellerOrgId);
        } else {
          // Create new balance record
          await client.from('seller_balances').insert({
            seller_org_id: sellerOrgId,
            available_amount_cents: totalAmountCents,
            pending_amount_cents: 0,
            credit_amount_cents: 0,
            currency: existingOrder.currency || 'XCD',
          });
        }

        // Add timeline event
        await client.from('order_timeline').insert({
          order_id: orderId,
          event_type: 'balance_credited',
          title: 'Amount added to your balance',
          description: `$${(totalAmountCents / 100).toFixed(2)} credited to your account`,
          actor_type: 'system',
          is_visible_to_buyer: false,
          is_visible_to_seller: true,
        });
      }
    }

    // Emit appropriate order status event
    const status = updateOrderStatusDto.status;
    const eventTypeMap: Record<string, typeof EventTypes.Order.PROCESSING | typeof EventTypes.Order.SHIPPED | typeof EventTypes.Order.DELIVERED> = {
      processing: EventTypes.Order.PROCESSING,
      shipped: EventTypes.Order.SHIPPED,
      delivered: EventTypes.Order.DELIVERED,
    };
    const eventType = eventTypeMap[status as string];
    if (eventType) {
      await this.eventsService.emit({
        type: eventType,
        aggregateType: AggregateTypes.ORDER,
        aggregateId: orderId,
        actorId: userId,
        organizationId: sellerOrgId,
        payload: {
          orderNumber: existingOrder.order_number,
          previousStatus,
          newStatus: status,
          trackingNumber: updateOrderStatusDto.tracking_number,
        },
      });
    }

    return this.mapOrderToResponse(data);
  }

  async getOrderTimeline(sellerOrgId: string, orderId: string): Promise<any[]> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if order exists and belongs to seller
    await this.getOrderById(sellerOrgId, orderId);

    const { data, error } = await client
      .from('order_timeline')
      .select('*')
      .eq('order_id', orderId)
      .eq('is_visible_to_seller', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch order timeline: ${error.message}`,
      );
    }

    return data || [];
  }

  async requestOrderStatusUpdate(
    sellerOrgId: string,
    orderId: string,
    dto: SellerStatusUpdateRequestDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Ensure order exists and belongs to seller
    await this.getOrderById(sellerOrgId, orderId);

    const requested = (dto.requested_status || '').toLowerCase().trim();
    if (!requested) {
      throw new BadRequestException('requested_status is required');
    }

    const title = `Seller requested status change to ${requested}`;

    const { error } = await client.from('order_timeline').insert({
      order_id: orderId,
      event_type: 'seller_status_update_request',
      title,
      description: dto.notes ?? null,
      actor_type: 'seller',
      actor_user_id: userId,
      metadata: {
        requested_status: requested,
      },
      is_visible_to_buyer: false,
      is_visible_to_seller: true,
    });

    if (error) {
      throw new BadRequestException(
        `Failed to create status update request: ${error.message}`,
      );
    }

    return { success: true };
  }

  async createBuyerReview(
    sellerOrgId: string,
    orderId: string,
    reviewDto: BuyerReviewDto,
    userId: string,
  ): Promise<void> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Verify order belongs to seller and is delivered
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, status, seller_org_id, buyer_org_id')
      .eq('id', orderId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found');
    }

    if ((order.status as string) !== 'delivered') {
      throw new BadRequestException('Can only review delivered orders');
    }

    // Prevent duplicate reviews for same order/seller
    const { data: existing } = await client
      .from('buyer_reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('seller_org_id', sellerOrgId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Buyer already reviewed for this order');
    }

    const { error: insertError } = await client.from('buyer_reviews').insert({
      order_id: orderId,
      seller_org_id: sellerOrgId,
      buyer_org_id: order.buyer_org_id,
      rating: reviewDto.overall_rating,
      payment_behavior_rating: reviewDto.payment_behavior_rating,
      communication_rating: reviewDto.communication_rating,
      reliability_rating: reviewDto.reliability_rating,
      review_text: reviewDto.comment ?? null,
      created_by_user_id: userId,
    });

    if (insertError) {
      throw new BadRequestException(
        `Failed to create buyer review: ${insertError.message}`,
      );
    }

    // Optional: timeline event visible to both sides
    await client.from('order_timeline').insert({
      order_id: orderId,
      event_type: 'seller_left_buyer_review',
      title: 'Seller left a review for the buyer',
      description: null,
      actor_type: 'seller',
      actor_user_id: userId,
      metadata: {
        overall_rating: reviewDto.overall_rating,
      },
      is_visible_to_buyer: true,
      is_visible_to_seller: true,
    });

    // Emit buyer review created event
    await this.eventsService.emit({
      type: EventTypes.Review.BUYER_CREATED,
      aggregateType: AggregateTypes.REVIEW,
      aggregateId: orderId,
      actorId: userId,
      organizationId: sellerOrgId,
      payload: {
        orderId,
        buyerOrgId: order.buyer_org_id,
        rating: reviewDto.overall_rating,
      },
    });
  }

  // ==================== TRANSACTION MANAGEMENT ====================

  async getTransactions(
    sellerOrgId: string,
    query: TransactionQueryDto,
  ): Promise<{
    transactions: TransactionResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();
    const {
      page = 1,
      limit = 20,
      type,
      status,
      order_id,
      buyer_org_id,
      transaction_number,
      from_date,
      to_date,
      min_amount,
      max_amount,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    let queryBuilder = client
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('seller_org_id', sellerOrgId);

    // Apply filters
    if (type) {
      queryBuilder = queryBuilder.eq('type', type);
    }

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    if (order_id) {
      queryBuilder = queryBuilder.eq('order_id', order_id);
    }

    if (buyer_org_id) {
      queryBuilder = queryBuilder.eq('buyer_org_id', buyer_org_id);
    }

    if (transaction_number) {
      queryBuilder = queryBuilder.ilike(
        'transaction_number',
        `%${transaction_number}%`,
      );
    }

    if (from_date) {
      queryBuilder = queryBuilder.gte('created_at', from_date);
    }

    if (to_date) {
      queryBuilder = queryBuilder.lte('created_at', to_date);
    }

    if (min_amount !== undefined) {
      queryBuilder = queryBuilder.gte('amount', min_amount);
    }

    if (max_amount !== undefined) {
      queryBuilder = queryBuilder.lte('amount', max_amount);
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(sort_by, {
      ascending: sort_order === 'asc',
    });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch transactions: ${error.message}`,
      );
    }

    const transactions =
      data?.map((transaction) => this.mapTransactionToResponse(transaction)) ||
      [];

    return {
      transactions,
      total: count || 0,
      page,
      limit,
    };
  }

  async getTransactionById(
    sellerOrgId: string,
    transactionId: string,
  ): Promise<TransactionResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Transaction not found');
    }

    return this.mapTransactionToResponse(data);
  }

  async getTransactionSummary(
    sellerOrgId: string,
    query: AnalyticsQueryDto,
  ): Promise<TransactionSummaryDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();
    const { period_start, period_end } = this.getPeriodDates(
      query.period,
      query.start_date,
      query.end_date,
    );

    const { data, error } = await client
      .from('transactions')
      .select('type, status, amount, currency')
      .eq('seller_org_id', sellerOrgId)
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (error) {
      throw new BadRequestException(
        `Failed to fetch transaction summary: ${error.message}`,
      );
    }

    const transactions = data || [];
    const summary = this.calculateTransactionSummary(
      transactions,
      period_start,
      period_end,
    );

    return summary;
  }

  // ==================== POST MANAGEMENT ====================

  async createScheduledPost(
    sellerOrgId: string,
    createPostDto: CreateScheduledPostDto,
    userId: string,
  ): Promise<ScheduledPostResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const postData: CreateScheduledPostData = {
      seller_org_id: sellerOrgId,
      ...createPostDto,
      created_by: userId,
    };

    const { data, error } = await client
      .from('scheduled_posts')
      .insert(postData)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create scheduled post: ${error.message}`,
      );
    }

    return this.mapPostToResponse(data);
  }

  async getScheduledPosts(
    sellerOrgId: string,
    query: PostQueryDto,
  ): Promise<{
    posts: ScheduledPostResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();
    const {
      page = 1,
      limit = 20,
      status,
      post_type,
      product_id,
      from_date,
      to_date,
      search,
      sort_by = 'scheduled_for',
      sort_order = 'desc',
    } = query;

    let queryBuilder = client
      .from('scheduled_posts')
      .select('*', { count: 'exact' })
      .eq('seller_org_id', sellerOrgId);

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    if (post_type) {
      queryBuilder = queryBuilder.eq('post_type', post_type);
    }

    if (product_id) {
      queryBuilder = queryBuilder.eq('product_id', product_id);
    }

    if (search) {
      queryBuilder = queryBuilder.or(
        `title.ilike.%${search}%,content.ilike.%${search}%`,
      );
    }

    if (from_date) {
      queryBuilder = queryBuilder.gte('scheduled_for', from_date);
    }

    if (to_date) {
      queryBuilder = queryBuilder.lte('scheduled_for', to_date);
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(sort_by, {
      ascending: sort_order === 'asc',
    });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch scheduled posts: ${error.message}`,
      );
    }

    const posts = data?.map((post) => this.mapPostToResponse(post)) || [];

    return {
      posts,
      total: count || 0,
      page,
      limit,
    };
  }

  async getScheduledPostById(
    sellerOrgId: string,
    postId: string,
  ): Promise<ScheduledPostResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Scheduled post not found');
    }

    return this.mapPostToResponse(data);
  }

  async updateScheduledPost(
    sellerOrgId: string,
    postId: string,
    updatePostDto: UpdateScheduledPostDto,
    userId: string,
  ): Promise<ScheduledPostResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if post exists and belongs to seller
    await this.getScheduledPostById(sellerOrgId, postId);

    const { data, error } = await client
      .from('scheduled_posts')
      .update({
        ...updatePostDto,
        updated_by: userId,
      })
      .eq('id', postId)
      .eq('seller_org_id', sellerOrgId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update scheduled post: ${error.message}`,
      );
    }

    return this.mapPostToResponse(data);
  }

  async deleteScheduledPost(
    sellerOrgId: string,
    postId: string,
  ): Promise<void> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if post exists and belongs to seller
    await this.getScheduledPostById(sellerOrgId, postId);

    const { error } = await client
      .from('scheduled_posts')
      .delete()
      .eq('id', postId)
      .eq('seller_org_id', sellerOrgId);

    if (error) {
      throw new BadRequestException(
        `Failed to delete scheduled post: ${error.message}`,
      );
    }
  }

  async publishPost(
    sellerOrgId: string,
    postId: string,
  ): Promise<ScheduledPostResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if post exists and belongs to seller
    await this.getScheduledPostById(sellerOrgId, postId);

    const { data, error } = await client
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('seller_org_id', sellerOrgId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to publish post: ${error.message}`);
    }

    return this.mapPostToResponse(data);
  }

  // ==================== ANALYTICS ====================

  async getDashboardMetrics(
    sellerOrgId: string,
    query: AnalyticsQueryDto,
  ): Promise<DashboardMetricsDto> {
    await this.assertSellerVerified(sellerOrgId);
    const { period_start, period_end } = this.getPeriodDates(
      query.period,
      query.start_date,
      query.end_date,
    );

    // NOTE: These metrics power both `/seller` (home) and `/seller/analytics`.
    // They must reflect real business definitions:
    // - Revenue: paid orders (exclude cancelled/rejected/failed/refunded)
    // - Orders: active + completed orders (exclude cancelled/rejected)
    // - Pending: orders awaiting seller action (pending + any legacy/extended statuses)
    // - Active products: products in active catalog state

    return this.computeDashboardMetricsForPeriod(
      sellerOrgId,
      period_start,
      period_end,
      query.period,
      query.start_date,
      query.end_date,
    );
  }

  async getSalesAnalytics(
    sellerOrgId: string,
    query: AnalyticsQueryDto,
  ): Promise<SalesAnalyticsDto> {
    await this.assertSellerVerified(sellerOrgId);
    const { period_start, period_end } = this.getPeriodDates(
      query.period,
      query.start_date,
      query.end_date,
    );
    const groupBy = (query.group_by as 'day' | 'week' | 'month' | undefined) || 'day';
    return this.computeSalesAnalyticsForPeriod(
      sellerOrgId,
      period_start,
      period_end,
      groupBy,
    );
  }

  async getProductAnalytics(
    sellerOrgId: string,
    query: AnalyticsQueryDto,
  ): Promise<ProductAnalyticsDto> {
    await this.assertSellerVerified(sellerOrgId);
    const { period_start, period_end } = this.getPeriodDates(
      query.period,
      query.start_date,
      query.end_date,
    );
    return this.computeProductAnalyticsForPeriod(sellerOrgId, period_start, period_end);
  }

  private toDayKeyUtc(iso: string): string {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
  }

  private toMonthKeyUtc(iso: string): string {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private toWeekKeyUtc(iso: string): string {
    // ISO week key like "2026-W03"
    const date = new Date(iso);
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Thursday in current week decides the year.
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  private bucketKey(iso: string, groupBy: 'day' | 'week' | 'month'): string {
    if (groupBy === 'month') return this.toMonthKeyUtc(iso);
    if (groupBy === 'week') return this.toWeekKeyUtc(iso);
    return this.toDayKeyUtc(iso);
  }

  private async computeSalesAnalyticsForPeriod(
    sellerOrgId: string,
    period_start: string,
    period_end: string,
    groupBy: 'day' | 'week' | 'month',
  ): Promise<SalesAnalyticsDto> {
    const client = this.supabaseService.getClient();

    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select(
        'id, buyer_org_id, status, payment_status, total_amount, currency, created_at, accepted_at, delivered_at',
      )
      .eq('seller_org_id', sellerOrgId)
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (ordersError) {
      throw new BadRequestException(
        `Failed to fetch orders for sales analytics: ${ordersError.message}`,
      );
    }

    const orderRows = (orders || []) as Array<{
      id: string;
      buyer_org_id: string | null;
      status: string;
      payment_status: string;
      total_amount: string | number;
      currency?: string | null;
      created_at: string;
      accepted_at?: string | null;
      delivered_at?: string | null;
    }>;

    // Compute revenue from paid orders (created in period)
    const paidOrders = orderRows.filter(
      (o) => String(o.payment_status).toLowerCase() === 'paid',
    );
    const totalRevenue = paidOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0,
    );

    const currency =
      (paidOrders[0]?.currency as string | undefined) ||
      ((orderRows[0]?.currency as string | undefined) ?? 'USD');

    // Sales time series
    const salesAgg = new Map<
      string,
      { date: string; revenue: number; orders_count: number; products_sold: number }
    >();

    // We treat "orders_count" as delivered orders count (matches "fulfilled" mental model).
    orderRows.forEach((o) => {
      const key = this.bucketKey(o.created_at, groupBy);
      const cur = salesAgg.get(key) || {
        date: key,
        revenue: 0,
        orders_count: 0,
        products_sold: 0,
      };
      if (String(o.payment_status).toLowerCase() === 'paid') {
        cur.revenue += Number(o.total_amount) || 0;
      }
      if (String(o.status).toLowerCase() === 'delivered') {
        cur.orders_count += 1;
      }
      salesAgg.set(key, cur);
    });

    // Product sold and category/product breakdown from delivered + paid items
    const { data: items, error: itemsError } = await client
      .from('order_items')
      .select(
        `
        product_id,
        product_name,
        quantity,
        total_price,
        orders!inner(id, created_at, status, payment_status, seller_org_id),
        products:products(id, name, category)
      `,
      )
      .eq('orders.seller_org_id', sellerOrgId)
      .eq('orders.status', 'delivered')
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', period_start)
      .lte('orders.created_at', period_end);

    if (itemsError) {
      throw new BadRequestException(
        `Failed to fetch order items for sales analytics: ${itemsError.message}`,
      );
    }

    // Supabase join shapes can vary (object vs array) depending on relationship metadata.
    // Keep this flexible and normalize as we read fields.
    const itemRows = (items || []) as unknown as Array<any>;

    // Add products_sold to series
    itemRows.forEach((i) => {
      const ordersRel = (i as any)?.orders;
      const createdAt =
        (Array.isArray(ordersRel) ? ordersRel?.[0]?.created_at : ordersRel?.created_at) ??
        undefined;
      if (!createdAt) return;
      const key = this.bucketKey(createdAt, groupBy);
      const cur = salesAgg.get(key) || {
        date: key,
        revenue: 0,
        orders_count: 0,
        products_sold: 0,
      };
      cur.products_sold += Number(i.quantity) || 0;
      salesAgg.set(key, cur);
    });

    const salesData = Array.from(salesAgg.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Sales by category
    const revenueByCategory = new Map<
      string,
      { category: string; revenue: number; ordersIds: Set<string> }
    >();
    itemRows.forEach((i) => {
      const productsRel = (i as any)?.products;
      const category =
        (Array.isArray(productsRel) ? productsRel?.[0]?.category : productsRel?.category) ||
        'Uncategorized';
      const cur = revenueByCategory.get(category) || {
        category,
        revenue: 0,
        ordersIds: new Set<string>(),
      };
      cur.revenue += Number(i.total_price) || 0;
      // order id isn't selected directly; safe fallback: do not count unique orders here
      revenueByCategory.set(category, cur);
    });

    const categoryRows = Array.from(revenueByCategory.values()).map((c) => ({
      category: c.category,
      revenue: c.revenue,
      orders_count: 0,
      percentage: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
    }));
    categoryRows.sort((a, b) => b.revenue - a.revenue);

    // Top products
    const revenueByProduct = new Map<
      string,
      { product_id: string; product_name: string; quantity_sold: number; revenue: number }
    >();
    itemRows.forEach((i) => {
      const id = i.product_id;
      const productsRel = (i as any)?.products;
      const name =
        (Array.isArray(productsRel) ? productsRel?.[0]?.name : productsRel?.name) ||
        i.product_name ||
        'Product';
      const cur = revenueByProduct.get(id) || {
        product_id: id,
        product_name: name,
        quantity_sold: 0,
        revenue: 0,
      };
      cur.quantity_sold += Number(i.quantity) || 0;
      cur.revenue += Number(i.total_price) || 0;
      revenueByProduct.set(id, cur);
    });

    const topProducts = Array.from(revenueByProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 25)
      .map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity_sold: p.quantity_sold,
        revenue: p.revenue,
        percentage: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      }));

    // Order status distribution
    const dist = {
      pending: 0,
      accepted: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      disputed: 0,
    };
    orderRows.forEach((o) => {
      const s = String(o.status).toLowerCase();
      if (s in dist) (dist as any)[s] += 1;
    });

    // Avg processing time (hours): accepted_at -> delivered_at
    const durationsHours: number[] = [];
    orderRows.forEach((o) => {
      if (!o.accepted_at || !o.delivered_at) return;
      const a = new Date(o.accepted_at).getTime();
      const d = new Date(o.delivered_at).getTime();
      if (!Number.isFinite(a) || !Number.isFinite(d) || d <= a) return;
      durationsHours.push((d - a) / 3600000);
    });
    const avgProcessingTime =
      durationsHours.length > 0
        ? durationsHours.reduce((s, x) => s + x, 0) / durationsHours.length
        : 0;

    // Customer acquisition (buyer orgs)
    const buyerIds = Array.from(
      new Set(
        orderRows
          .map((o) => o.buyer_org_id ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    let returningCustomers = 0;
    if (buyerIds.length > 0) {
      const { data: prevBuyerOrders, error: prevBuyerOrdersError } = await client
        .from('orders')
        .select('buyer_org_id, created_at')
        .eq('seller_org_id', sellerOrgId)
        .in('buyer_org_id', buyerIds)
        .lt('created_at', period_start);
      if (prevBuyerOrdersError) {
        throw new BadRequestException(
          `Failed to fetch customer history for sales analytics: ${prevBuyerOrdersError.message}`,
        );
      }
      const prevSet = new Set(
        (prevBuyerOrders || [])
          .map((o: any) => o.buyer_org_id as string | null)
          .filter(Boolean) as string[],
      );
      returningCustomers = buyerIds.filter((id) => prevSet.has(id)).length;
    }
    const newCustomers = Math.max(0, buyerIds.length - returningCustomers);
    const retentionRate =
      buyerIds.length > 0 ? (returningCustomers / buyerIds.length) * 100 : 0;

    return {
      sales_data: salesData,
      sales_by_category: categoryRows,
      top_products: topProducts,
      order_status_distribution: dist,
      avg_processing_time: Number.isFinite(avgProcessingTime) ? avgProcessingTime : 0,
      customer_data: {
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        customer_retention_rate: Number.isFinite(retentionRate) ? retentionRate : 0,
      },
      total_revenue: totalRevenue,
      currency,
      period_start,
      period_end,
    };
  }

  private async computeProductAnalyticsForPeriod(
    sellerOrgId: string,
    period_start: string,
    period_end: string,
  ): Promise<ProductAnalyticsDto> {
    const client = this.supabaseService.getClient();

    const [{ data: products, error: productsError }, { data: items, error: itemsError }] =
      await Promise.all([
        client
          .from('products')
          .select('id, name, category, status, stock_quantity, min_stock_level, base_price')
          .eq('seller_org_id', sellerOrgId),
        client
          .from('order_items')
          .select(
            `
          product_id,
          quantity,
          total_price,
          orders!inner(id, created_at, status, payment_status, seller_org_id)
        `,
          )
          .eq('orders.seller_org_id', sellerOrgId)
          .eq('orders.status', 'delivered')
          .eq('orders.payment_status', 'paid')
          .gte('orders.created_at', period_start)
          .lte('orders.created_at', period_end),
      ]);

    if (productsError) {
      throw new BadRequestException(
        `Failed to fetch products for product analytics: ${productsError.message}`,
      );
    }
    if (itemsError) {
      throw new BadRequestException(
        `Failed to fetch order items for product analytics: ${itemsError.message}`,
      );
    }

    const productRows = (products || []) as Array<{
      id: string;
      name: string;
      category: string | null;
      status: string;
      stock_quantity: number | null;
      min_stock_level: number | null;
      base_price: string | number | null;
    }>;

    const itemRows = (items || []) as Array<{
      product_id: string;
      quantity: number;
      total_price: string | number;
    }>;

    const perfByProduct = new Map<
      string,
      { orders: number; revenue: number; quantity: number }
    >();
    itemRows.forEach((i) => {
      const cur = perfByProduct.get(i.product_id) || { orders: 0, revenue: 0, quantity: 0 };
      cur.orders += 1;
      cur.revenue += Number(i.total_price) || 0;
      cur.quantity += Number(i.quantity) || 0;
      perfByProduct.set(i.product_id, cur);
    });

    const productPerformance = productRows.map((p) => {
      const perf = perfByProduct.get(p.id) || { orders: 0, revenue: 0, quantity: 0 };
      const views = 0; // not yet tracked
      const conversionRate = views > 0 ? (perf.orders / views) * 100 : 0;
      return {
        product_id: p.id,
        product_name: p.name,
        views,
        orders: perf.orders,
        revenue: perf.revenue,
        conversion_rate: conversionRate,
        stock_level: Number(p.stock_quantity ?? 0),
        status: p.status,
      };
    });

    // Category performance
    const byCategory = new Map<
      string,
      {
        category: string;
        products_count: number;
        total_revenue: number;
        total_orders: number;
        base_price_sum: number;
        base_price_count: number;
      }
    >();
    productRows.forEach((p) => {
      const cat = (p.category || 'Uncategorized') as string;
      const cur =
        byCategory.get(cat) || {
          category: cat,
          products_count: 0,
          total_revenue: 0,
          total_orders: 0,
          base_price_sum: 0,
          base_price_count: 0,
        };
      cur.products_count += 1;
      const base = Number(p.base_price);
      if (Number.isFinite(base) && base > 0) {
        cur.base_price_sum += base;
        cur.base_price_count += 1;
      }
      const perf = perfByProduct.get(p.id);
      if (perf) {
        cur.total_revenue += perf.revenue;
        cur.total_orders += perf.orders;
      }
      byCategory.set(cat, cur);
    });

    const categoryPerformance = Array.from(byCategory.values()).map((c) => ({
      category: c.category,
      products_count: c.products_count,
      total_revenue: c.total_revenue,
      avg_price: c.base_price_count > 0 ? c.base_price_sum / c.base_price_count : 0,
      total_orders: c.total_orders,
    }));
    categoryPerformance.sort((a, b) => b.total_revenue - a.total_revenue);

    // Inventory alerts
    const lowStock = productRows
      .filter((p) => {
        const stock = Number(p.stock_quantity ?? 0);
        const min = Number(p.min_stock_level ?? 0);
        return stock > 0 && min > 0 && stock <= min;
      })
      .map((p) => ({
        product_id: p.id,
        product_name: p.name,
        current_stock: Number(p.stock_quantity ?? 0),
        min_stock_level: Number(p.min_stock_level ?? 0),
      }));
    const outOfStock = productRows
      .filter((p) => Number(p.stock_quantity ?? 0) <= 0)
      .map((p) => ({
        product_id: p.id,
        product_name: p.name,
        last_stock_date: '', // not tracked
      }));

    // Price analysis
    const prices = productRows
      .map((p) => Number(p.base_price))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgProductPrice =
      prices.length > 0 ? prices.reduce((s, x) => s + x, 0) / prices.length : 0;

    const ranges = [
      { range: '$0–$10', min: 0, max: 10 },
      { range: '$10–$25', min: 10, max: 25 },
      { range: '$25–$50', min: 25, max: 50 },
      { range: '$50+', min: 50, max: Infinity },
    ];
    const priceRanges = ranges.map((r) => {
      const count = prices.filter((p) => p >= r.min && p < r.max).length;
      return {
        range: r.range,
        products_count: count,
        percentage: prices.length > 0 ? (count / prices.length) * 100 : 0,
      };
    });

    // Lifecycle
    const lifecycle = {
      new_products: productRows.filter((p) => String(p.status).toLowerCase() === 'draft').length,
      active_products: productRows.filter((p) => String(p.status).toLowerCase() === 'active').length,
      discontinued_products: productRows.filter(
        (p) => String(p.status).toLowerCase() === 'inactive' || String(p.status).toLowerCase() === 'archived',
      ).length,
      draft_products: productRows.filter((p) => String(p.status).toLowerCase() === 'draft').length,
    };

    return {
      product_performance: productPerformance,
      category_performance: categoryPerformance,
      inventory_alerts: {
        low_stock: lowStock,
        out_of_stock: outOfStock,
      },
      price_analysis: {
        avg_product_price: avgProductPrice,
        price_ranges: priceRanges,
      },
      product_lifecycle: lifecycle,
      period_start,
      period_end,
    };
  }

  // ==================== HELPER METHODS ====================

  private async generateProductSlug(
    name: string,
    productId?: string,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    // Create base slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    // Check for uniqueness
    while (true) {
      let query = client.from('products').select('id').eq('slug', slug);

      if (productId) {
        query = query.neq('id', productId);
      }

      const { data } = await query;

      if (!data || data.length === 0) {
        break;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  private mapProductToResponse(product: any): ProductResponseDto {
    return {
      id: product.id,
      seller_org_id: product.seller_org_id,
      name: product.name,
      description: product.description,
      short_description: product.short_description,
      sku: product.sku,
      barcode: product.barcode,
      category: product.category,
      subcategory: product.subcategory,
      tags: product.tags,
      base_price: parseFloat(product.base_price),
      sale_price: product.sale_price
        ? parseFloat(product.sale_price)
        : undefined,
      currency: product.currency,
      stock_quantity: product.stock_quantity,
      min_stock_level: product.min_stock_level,
      max_stock_level: product.max_stock_level,
      unit_of_measurement: product.unit_of_measurement,
      weight: product.weight ? parseFloat(product.weight) : undefined,
      dimensions: product.dimensions,
      condition: product.condition,
      brand: product.brand,
      model: product.model,
      color: product.color,
      size: product.size,
      status: product.status,
      is_featured: product.is_featured,
      is_organic: product.is_organic,
      is_local: product.is_local,
      meta_title: product.meta_title,
      meta_description: product.meta_description,
      slug: product.slug,
      created_at: product.created_at,
      updated_at: product.updated_at,
      images: product.product_images?.map((img: any) => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
        is_primary: img.is_primary,
      })),
    };
  }

  private mapOrderToResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      order_number: order.order_number,
      buyer_org_id: order.buyer_org_id,
      seller_org_id: order.seller_org_id,
      buyer_user_id: order.buyer_user_id,
      buyer_info: order.organizations
        ? {
            organization_name: order.organizations.name,
            business_name: order.organizations.business_name,
          }
        : undefined,
      status: order.status,
      payment_status: order.payment_status,
      subtotal: parseFloat(order.subtotal),
      tax_amount: parseFloat(order.tax_amount),
      shipping_amount: parseFloat(order.shipping_amount),
      discount_amount: parseFloat(order.discount_amount),
      total_amount: parseFloat(order.total_amount),
      currency: order.currency,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      estimated_delivery_date: order.estimated_delivery_date,
      actual_delivery_date: order.actual_delivery_date,
      tracking_number: order.tracking_number,
      shipping_method: order.shipping_method,
      buyer_notes: order.buyer_notes,
      seller_notes: order.seller_notes,
      internal_notes: order.internal_notes,
      accepted_at: order.accepted_at,
      rejected_at: order.rejected_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.order_items?.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_image:
          item.product_image ||
          item?.products?.product_images?.find((img: any) => img.is_primary)
            ?.image_url ||
          item?.products?.product_images?.[0]?.image_url ||
          item?.product_snapshot?.product_images?.find((img: any) => img.is_primary)
            ?.image_url ||
          item?.product_snapshot?.product_images?.[0]?.image_url ||
          item?.product_snapshot?.image_url ||
          null,
        unit_price: parseFloat(item.unit_price),
        quantity: item.quantity,
        total_price: parseFloat(item.total_price),
        product_snapshot: item.product_snapshot,
        created_at: item.created_at,
      })),
      timeline: order.order_timeline?.map((timeline: any) => ({
        id: timeline.id,
        event_type: timeline.event_type,
        title: timeline.title,
        description: timeline.description,
        actor_user_id: timeline.actor_user_id,
        actor_type: timeline.actor_type,
        metadata: timeline.metadata,
        is_visible_to_buyer: timeline.is_visible_to_buyer,
        is_visible_to_seller: timeline.is_visible_to_seller,
        created_at: timeline.created_at,
      })),
    };
  }

  private mapTransactionToResponse(transaction: any): TransactionResponseDto {
    return {
      id: transaction.id,
      transaction_number: transaction.transaction_number,
      order_id: transaction.order_id,
      seller_org_id: transaction.seller_org_id,
      buyer_org_id: transaction.buyer_org_id,
      type: transaction.type,
      status: transaction.status,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      payment_method: transaction.payment_method,
      payment_reference: transaction.payment_reference,
      gateway_transaction_id: transaction.gateway_transaction_id,
      platform_fee: parseFloat(transaction.platform_fee),
      payment_processing_fee: parseFloat(transaction.payment_processing_fee),
      net_amount: transaction.net_amount
        ? parseFloat(transaction.net_amount)
        : undefined,
      description: transaction.description,
      metadata: transaction.metadata,
      processed_at: transaction.processed_at,
      settled_at: transaction.settled_at,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
  }

  private mapPostToResponse(post: any): ScheduledPostResponseDto {
    return {
      id: post.id,
      seller_org_id: post.seller_org_id,
      product_id: post.product_id,
      title: post.title,
      content: post.content,
      post_type: post.post_type,
      images: post.images,
      video_url: post.video_url,
      scheduled_for: post.scheduled_for,
      published_at: post.published_at,
      target_audience: post.target_audience,
      platforms: post.platforms,
      status: post.status,
      failure_reason: post.failure_reason,
      views_count: post.views_count,
      likes_count: post.likes_count,
      shares_count: post.shares_count,
      comments_count: post.comments_count,
      created_by: post.created_by,
      updated_by: post.updated_by,
      created_at: post.created_at,
      updated_at: post.updated_at,
    };
  }

  private getPeriodDates(
    period?: string,
    startDate?: string,
    endDate?: string,
  ): { period_start: string; period_end: string } {
    const now = new Date();

    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    let period_start: Date;
    let period_end: Date;

    if (period === 'custom' && startDate && endDate) {
      // Interpret custom inputs as YYYY-MM-DD boundaries
      period_start = startOfDay(new Date(startDate));
      period_end = endOfDay(new Date(endDate));
    } else {
      switch (period) {
        case 'today': {
          period_start = startOfDay(now);
          period_end = now;
          break;
        }
        case 'yesterday': {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          period_start = startOfDay(y);
          period_end = endOfDay(y);
          break;
        }
        case 'last_7_days': {
          period_end = now;
          period_start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        }
        case 'last_30_days': {
          period_end = now;
          period_start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        }
        case 'last_90_days': {
          period_end = now;
          period_start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        }
        case 'this_month': {
          period_start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          period_end = now;
          break;
        }
        case 'last_month': {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          period_start = startOfDay(start);
          period_end = endOfDay(end);
          break;
        }
        case 'this_year': {
          period_start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
          period_end = now;
          break;
        }
        // Some clients may send this even if it's not in the enum yet.
        case 'this_week': {
          // Monday as start of week
          const dow = now.getDay(); // 0=Sun..6=Sat
          const deltaToMon = (dow + 6) % 7;
          const monday = new Date(now);
          monday.setDate(now.getDate() - deltaToMon);
          period_start = startOfDay(monday);
          period_end = now;
          break;
        }
        default: {
          period_end = now;
          period_start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        }
      }
    }

    return {
      period_start: period_start.toISOString(),
      period_end: period_end.toISOString(),
    };
  }

  private getPreviousPeriodDates(
    period_start_iso: string,
    period_end_iso: string,
  ): { prev_start: string; prev_end: string } {
    const start = new Date(period_start_iso);
    const end = new Date(period_end_iso);
    const durationMs = Math.max(1, end.getTime() - start.getTime());
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { prev_start: prevStart.toISOString(), prev_end: prevEnd.toISOString() };
  }

  private async computeDashboardMetricsForPeriod(
    sellerOrgId: string,
    period_start: string,
    period_end: string,
    period?: string,
    start_date?: string,
    end_date?: string,
  ): Promise<DashboardMetricsDto> {
    const client = this.supabaseService.getClient();

    const excludedOrderStatuses = new Set(['cancelled', 'rejected']);
    const pendingLikeStatuses = new Set(['pending', 'confirmed']); // "confirmed" may exist in later migrations

    const [{ data: orders, error: ordersError }, { data: products, error: productsError }] =
      await Promise.all([
        client
          .from('orders')
          .select('id, status, payment_status, total_amount, currency, created_at')
          .eq('seller_org_id', sellerOrgId)
          .gte('created_at', period_start)
          .lte('created_at', period_end),
        client
          .from('products')
          .select('id, status, stock_quantity, min_stock_level')
          .eq('seller_org_id', sellerOrgId),
      ]);

    if (ordersError) {
      throw new BadRequestException(
        `Failed to fetch orders for metrics: ${ordersError.message}`,
      );
    }
    if (productsError) {
      throw new BadRequestException(
        `Failed to fetch products for metrics: ${productsError.message}`,
      );
    }

    const orderRows = (orders || []) as Array<{
      id: string;
      status: string;
      payment_status: string;
      total_amount: string | number;
      currency?: string | null;
      created_at: string;
    }>;

    const activeOrCompletedOrders = orderRows.filter(
      (o) => !excludedOrderStatuses.has(String(o.status).toLowerCase()),
    );
    const deliveredOrders = activeOrCompletedOrders.filter(
      (o) => String(o.status).toLowerCase() === 'delivered',
    );
    const activeOrders = activeOrCompletedOrders.filter((o) => {
      const s = String(o.status).toLowerCase();
      return s !== 'delivered';
    });
    const pendingOrders = orderRows.filter((o) =>
      pendingLikeStatuses.has(String(o.status).toLowerCase()),
    );

    const paidOrders = activeOrCompletedOrders.filter(
      (o) => String(o.payment_status).toLowerCase() === 'paid',
    );

    const totalRevenue = paidOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0,
    );
    // "Orders" metric on dashboards should represent fulfilled volume (delivered),
    // not all in-flight orders.
    const totalOrders = deliveredOrders.length;
    const paidOrdersCount = paidOrders.length;
    const averageOrderValue = paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : 0;

    const productRows = (products || []) as Array<{
      id: string;
      status: string;
      stock_quantity: number | null;
      min_stock_level: number | null;
    }>;

    const activeProducts = productRows.filter(
      (p) => String(p.status).toLowerCase() === 'active',
    );

    const lowStockProducts = activeProducts.filter((p) => {
      const stock = Number(p.stock_quantity ?? 0);
      const min = Number(p.min_stock_level ?? 0);
      return stock > 0 && stock <= min;
    }).length;

    const outOfStockProducts = activeProducts.filter((p) => {
      const stock = Number(p.stock_quantity ?? 0);
      return stock <= 0;
    }).length;

    // Product sales breakdown (delivered + paid only)
    const { data: deliveredItems, error: deliveredItemsError } = await client
      .from('order_items')
      .select(
        `
        product_id,
        product_name,
        quantity,
        total_price,
        orders!inner(created_at, status, payment_status, seller_org_id),
        products:products(id, name)
      `,
      )
      .eq('orders.seller_org_id', sellerOrgId)
      .eq('orders.status', 'delivered')
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', period_start)
      .lte('orders.created_at', period_end);

    if (deliveredItemsError) {
      throw new BadRequestException(
        `Failed to fetch order items for metrics: ${deliveredItemsError.message}`,
      );
    }

    const itemRows = (deliveredItems || []) as unknown as Array<any>;

    const totalProductsSold = itemRows.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0),
      0,
    );

    const byProduct = new Map<
      string,
      { id: string; name: string; quantity: number; revenue: number }
    >();

    itemRows.forEach((i) => {
      const id = i.product_id;
      const productsRel = (i as any)?.products;
      const name =
        (Array.isArray(productsRel) ? productsRel?.[0]?.name : productsRel?.name) ||
        i.product_name ||
        'Product';
      const cur = byProduct.get(id) || { id, name, quantity: 0, revenue: 0 };
      cur.quantity += Number(i.quantity) || 0;
      cur.revenue += Number(i.total_price) || 0;
      byProduct.set(id, cur);
    });

    const top = Array.from(byProduct.values()).sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.quantity - a.quantity;
    })[0];

    // Growth vs previous period (same duration)
    const { prev_start, prev_end } = this.getPreviousPeriodDates(period_start, period_end);
    const { data: prevOrders, error: prevOrdersError } = await client
      .from('orders')
      .select('status, payment_status, total_amount')
      .eq('seller_org_id', sellerOrgId)
      .gte('created_at', prev_start)
      .lte('created_at', prev_end);

    if (prevOrdersError) {
      throw new BadRequestException(
        `Failed to fetch previous-period orders for metrics: ${prevOrdersError.message}`,
      );
    }

    const prevRows = (prevOrders || []) as Array<{
      status: string;
      payment_status: string;
      total_amount: string | number;
    }>;

    const prevActiveOrCompleted = prevRows.filter(
      (o) => !excludedOrderStatuses.has(String(o.status).toLowerCase()),
    );
    const prevDeliveredCount = prevActiveOrCompleted.filter(
      (o) => String(o.status).toLowerCase() === 'delivered',
    ).length;
    const prevPaid = prevActiveOrCompleted.filter(
      (o) => String(o.payment_status).toLowerCase() === 'paid',
    );
    const prevRevenue = prevPaid.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0,
    );
    const prevOrdersCount = prevDeliveredCount;

    const revenueGrowth =
      prevRevenue > 0
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
        : totalRevenue > 0
          ? 100
          : 0;

    const ordersGrowth =
      prevOrdersCount > 0
        ? ((totalOrders - prevOrdersCount) / prevOrdersCount) * 100
        : totalOrders > 0
          ? 100
          : 0;

    const currency =
      (paidOrders[0]?.currency as string | undefined) ||
      ((activeOrCompletedOrders[0]?.currency as string | undefined) ?? undefined) ||
      'USD';

    return {
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      active_orders: activeOrders.length,
      delivered_orders: deliveredOrders.length,
      total_products_sold: totalProductsSold,
      average_order_value: averageOrderValue,
      pending_orders: pendingOrders.length,
      active_products: activeProducts.length,
      low_stock_products: lowStockProducts,
      out_of_stock_products: outOfStockProducts,
      revenue_growth: Number.isFinite(revenueGrowth) ? revenueGrowth : 0,
      orders_growth: Number.isFinite(ordersGrowth) ? ordersGrowth : 0,
      top_selling_product: {
        id: top?.id || '',
        name: top?.name || 'N/A',
        quantity_sold: top?.quantity || 0,
        revenue: top?.revenue || 0,
      },
      currency,
      period_start,
      period_end,
    };
  }

  private calculateTransactionSummary(
    transactions: any[],
    period_start: string,
    period_end: string,
  ): TransactionSummaryDto {
    const summary = {
      total_sales: 0,
      total_refunds: 0,
      total_fees: 0,
      net_earnings: 0,
      pending_count: 0,
      completed_count: 0,
      failed_count: 0,
      disputed_count: 0,
      currency: 'USD',
      period_start,
      period_end,
    };

    transactions.forEach((transaction) => {
      const amount = parseFloat(transaction.amount);

      switch (transaction.type) {
        case 'sale':
          summary.total_sales += amount;
          break;
        case 'refund':
          summary.total_refunds += amount;
          break;
        case 'fee':
          summary.total_fees += amount;
          break;
      }

      switch (transaction.status) {
        case 'pending':
          summary.pending_count++;
          break;
        case 'completed':
          summary.completed_count++;
          break;
        case 'failed':
          summary.failed_count++;
          break;
        case 'disputed':
          summary.disputed_count++;
          break;
      }
    });

    summary.net_earnings =
      summary.total_sales - summary.total_refunds - summary.total_fees;

    return summary;
  }

  private calculateDashboardMetrics(
    orders: any[],
    products: any[],
    period_start: string,
    period_end: string,
  ): DashboardMetricsDto {
    // Kept for backward-compatibility in case other modules still call it.
    // Prefer `computeDashboardMetricsForPeriod()` for correct, DB-backed semantics.
    const totalOrders = Array.isArray(orders) ? orders.length : 0;
    const activeProducts = Array.isArray(products)
      ? products.filter((p) => String(p.status).toLowerCase() === 'active').length
      : 0;

    return {
      total_revenue: 0,
      total_orders: totalOrders,
      active_orders: 0,
      delivered_orders: 0,
      total_products_sold: 0,
      average_order_value: 0,
      pending_orders: 0,
      active_products: activeProducts,
      low_stock_products: 0,
      out_of_stock_products: 0,
      revenue_growth: 0,
      orders_growth: 0,
      top_selling_product: { id: '', name: 'N/A', quantity_sold: 0, revenue: 0 },
      currency: 'USD',
      period_start,
      period_end,
    };
  }

  // ==================== HOME AGGREGATE ====================

  async getSellerHome(
    sellerOrgId: string,
    query: AnalyticsQueryDto,
  ): Promise<SellerHomeResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Metrics
    const metrics = await this.getDashboardMetrics(sellerOrgId, query);

    // Featured products (flagged) limited
    const { data: featuredProducts } = await client
      .from('products')
      .select('*, product_images(*)')
      .eq('seller_org_id', sellerOrgId)
      .eq('is_featured', true)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(4);

    // Inventory sample (low stock first)
    const { data: inventoryProducts } = await client
      .from('products')
      .select('*, product_images(*)')
      .eq('seller_org_id', sellerOrgId)
      .eq('status', 'active')
      .order('stock_quantity', { ascending: true })
      .limit(10);

    // Recent orders
    const { data: recentOrders } = await client
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .eq('seller_org_id', sellerOrgId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Open buyer requests visible to this seller (targeted or open)
    const { data: buyerRequests } = await client
      .from('product_requests')
      .select(
        `
        id, request_number, product_name, quantity, unit_of_measurement, date_needed, budget_min, budget_max, currency, status, buyer_org_id, expires_at,
        organizations!buyer_org_id(name)
      `,
      )
      .in('status', ['open'])
      .or(`target_seller_id.eq.${sellerOrgId},target_seller_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(10);

    const featured = (featuredProducts || []).map((p) =>
      this.mapProductToResponse(p),
    );
    const inventory = (inventoryProducts || []).map((p) =>
      this.mapProductToResponse(p),
    );
    const orders = (recentOrders || []).map((o) => this.mapOrderToResponse(o));

    const requests: BuyerRequestSummaryDto[] = (buyerRequests || []).map(
      (r: any) => ({
        id: r.id,
        request_number: r.request_number,
        product_name: r.product_name,
        quantity: r.quantity,
        unit_of_measurement: r.unit_of_measurement,
        date_needed: r.date_needed,
        budget_range_text:
          r.budget_min != null && r.budget_max != null
            ? `${Number(r.budget_min)}-${Number(r.budget_max)} ${r.currency || 'USD'}`
            : undefined,
        buyer_name: r.organizations?.name || 'Buyer',
        location: undefined,
        priority: r.status === 'open' ? 'high' : 'normal',
      }),
    );

    // Latest farm visit request (if any) to surface on seller dashboard
    const latestFarmVisit = await this.getLatestFarmVisitRequest(sellerOrgId);

    return {
      metrics,
      featured_products: featured,
      inventory,
      recent_orders: orders,
      buyer_requests: requests,
      latest_farm_visit_request: latestFarmVisit,
    };
  }

  // ==================== INSIGHTS ====================

  async getSellerInsights(sellerOrgId: string) {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [featuredCountRes, pendingOrdersRes, recentHarvestsRes] =
      await Promise.all([
        client
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('seller_org_id', sellerOrgId)
          .eq('is_featured', true)
          .eq('status', 'active'),
        client
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_org_id', sellerOrgId)
          .in('status', ['pending', 'accepted', 'processing']),
        client
          .from('harvest_requests')
          .select('id', { count: 'exact', head: true })
          .eq('seller_org_id', sellerOrgId)
          .gte('created_at', sevenDaysAgo.toISOString()),
      ]);

    const insights: Array<{
      id: string;
      title: string;
      sub?: string;
      cta?: string;
      urgent?: boolean;
      actionId?: string;
    }> = [];

    const featuredCount = featuredCountRes.count || 0;
    if (featuredCount === 0) {
      insights.push({
        id: 'feature-a-product',
        title: 'Feature a product to boost catalog visibility',
        sub: 'Pick a best-seller to appear in your featured row',
        cta: 'Feature a product',
        actionId: 'feature_product',
      });
    }

    const pendingOrders = pendingOrdersRes.count || 0;
    if (pendingOrders > 0) {
      insights.push({
        id: 'review-pending-orders',
        title: `You have ${pendingOrders} orders awaiting action`,
        cta: 'Review orders',
        urgent: true,
        actionId: 'open_orders',
      });
    }

    const harvestsLastWeek = recentHarvestsRes.count || 0;
    if (harvestsLastWeek === 0) {
      insights.push({
        id: 'post-harvest-update',
        title: 'Post a harvest update to attract buyers',
        cta: 'Post update',
        actionId: 'new_harvest',
      });
    }

    return insights;
  }

  async executeSellerInsight(sellerOrgId: string, insightId: string) {
    // For MVP, we do not perform complex actions. We can expand later to
    // auto-flag featured products, generate tasks, etc.
    // Returning success allows the UI to optimistically remove the insight.
    return { success: true };
  }

  // ==================== HARVEST REQUESTS ====================

  async createHarvestRequest(
    sellerOrgId: string,
    dto: CreateSellerHarvestDto,
    userId: string,
  ): Promise<HarvestRequestResponseDto> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    let linkedProduct:
      | { id: string; name: string }
      | null = null;
    if (dto.product_id) {
      const { data: product, error: productError } = await client
        .from('products')
        .select('id, name')
        .eq('id', dto.product_id)
        .eq('seller_org_id', sellerOrgId)
        .maybeSingle();

      if (productError) {
        throw new BadRequestException(
          `Failed to validate linked product: ${productError.message}`,
        );
      }

      if (!product) {
        throw new BadRequestException(
          'Invalid product_id (product not found for this seller)',
        );
      }

      linkedProduct = { id: product.id as string, name: product.name as string };
    }

    const cropToUse = linkedProduct?.name ?? dto.crop;

    const { data, error } = await client
      .from('harvest_requests')
      .insert({
        seller_org_id: sellerOrgId,
        product_id: linkedProduct?.id ?? dto.product_id ?? null,
        crop: cropToUse,
        expected_harvest_window: dto.expected_harvest_window,
        quantity: dto.quantity,
        unit: dto.unit,
        notes: dto.notes,
        next_planting_crop: dto.next_planting_crop,
        next_planting_date: dto.next_planting_date,
        next_planting_area: dto.next_planting_area,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create harvest request: ${error.message}`,
      );
    }

    return {
      id: data.id,
      seller_org_id: data.seller_org_id,
      product_id: (data as any).product_id ?? null,
      crop: data.crop,
      expected_harvest_window: data.expected_harvest_window,
      quantity: data.quantity,
      unit: data.unit,
      notes: data.notes,
      next_planting_crop: data.next_planting_crop,
      next_planting_date: data.next_planting_date,
      next_planting_area: data.next_planting_area,
      created_at: data.created_at,
      created_by: data.created_by,
    };
  }

  // ==================== FARM VISIT REQUESTS ====================

  /**
   * Create a farm visit request so an admin can verify the seller's farm.
   * Note: this endpoint is intentionally allowed BEFORE full seller verification,
   * so we do NOT call assertSellerVerified here.
   */
  async createFarmVisitRequest(
    sellerOrgId: string,
    userId: string,
    dto: CreateFarmVisitRequestDto,
  ): Promise<FarmVisitRequestDto> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('farm_visit_requests')
      .insert({
        seller_org_id: sellerOrgId,
        requested_by_user_id: userId,
        preferred_date: dto.preferred_date ?? null,
        preferred_time_window: dto.preferred_time_window ?? null,
        notes: dto.notes ?? null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to create farm visit request: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return this.mapFarmVisitToDto(data);
  }

  /**
   * Get the latest farm visit request for this seller (if any).
   * This is used on the seller dashboard so they can see current status.
   */
  async getLatestFarmVisitRequest(
    sellerOrgId: string,
  ): Promise<FarmVisitRequestDto | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('farm_visit_requests')
      .select('*')
      .eq('seller_org_id', sellerOrgId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new BadRequestException(
        `Failed to load farm visit requests: ${error.message}`,
      );
    }

    const row = data?.[0];
    if (!row) return null;

    return this.mapFarmVisitToDto(row);
  }

  async getHarvestFeed(
    sellerOrgId: string,
    sellerUserId: string,
  ): Promise<HarvestFeedItemDto[]> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    const { data: harvests, error } = await client
      .from('harvest_requests')
      .select(
        `
        *,
        product:products(
          id,
          name,
          product_images(id, image_url, is_primary, display_order)
        )
      `,
      )
      .eq('seller_org_id', sellerOrgId)
      .eq('created_by', sellerUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new BadRequestException(
        `Failed to fetch harvest feed: ${error.message}`,
      );
    }

    const harvestIds = (harvests || []).map((h: any) => h.id);
    if (harvestIds.length === 0) return [];

    const [{ data: comments }, { data: requests }] = await Promise.all([
      client
        .from('harvest_comments')
        .select('*')
        .in('harvest_id', harvestIds)
        .order('created_at', { ascending: true }),
      client
        .from('harvest_buyer_requests')
        .select('*')
        .in('harvest_id', harvestIds)
        .order('created_at', { ascending: true }),
    ]);

    const commentsByHarvest = new Map<string, any[]>();
    (comments || []).forEach((c: any) => {
      const list = commentsByHarvest.get(c.harvest_id) || [];
      list.push(c);
      commentsByHarvest.set(c.harvest_id, list);
    });

    const requestsByHarvest = new Map<string, any[]>();
    (requests || []).forEach((r: any) => {
      const list = requestsByHarvest.get(r.harvest_id) || [];
      list.push(r);
      requestsByHarvest.set(r.harvest_id, list);
    });

    return (harvests || []).map((h: any) => {
      const product = (h as any).product as
        | { id?: string; name?: string; product_images?: any[] }
        | null
        | undefined;
      const primaryImage =
        product?.product_images?.find?.((img: any) => img?.is_primary) ??
        product?.product_images?.[0] ??
        null;

      return {
      id: h.id,
      seller_org_id: h.seller_org_id,
      product_id: h.product_id ?? product?.id ?? null,
      product_name: product?.name ?? null,
      product_image_url: primaryImage?.image_url ?? null,
      crop: h.crop,
      expected_harvest_window: h.expected_harvest_window,
      quantity: h.quantity,
      unit: h.unit,
      notes: h.notes,
      created_at: h.created_at,
      comments_count: h.comments_count || 0,
      requests_count: h.requests_count || 0,
      comments: (commentsByHarvest.get(h.id) || []).map(
        (c: any): SellerHarvestCommentDto => ({
          id: c.id,
          harvest_id: c.harvest_id,
          buyer_org_id: c.buyer_org_id,
          buyer_user_id: c.buyer_user_id,
          content: c.content,
          created_at: c.created_at,
        }),
      ),
      requests: (requestsByHarvest.get(h.id) || []).map(
        (r: any): HarvestBuyerRequestDto => ({
          id: r.id,
          harvest_id: r.harvest_id,
          seller_org_id: r.seller_org_id,
          buyer_org_id: r.buyer_org_id,
          buyer_user_id: r.buyer_user_id,
          requested_quantity: parseFloat(r.requested_quantity),
          unit: r.unit,
          requested_date: r.requested_date,
          notes: r.notes,
          status: r.status,
          acknowledged_at: r.acknowledged_at,
          acknowledged_by: r.acknowledged_by,
          seller_message: r.seller_message,
          created_at: r.created_at,
        }),
      ),
      };
    });
  }

  async addHarvestComment(
    buyerOrgId: string,
    buyerUserId: string,
    harvestId: string,
    dto: CreateSellerHarvestCommentDto,
  ): Promise<SellerHarvestCommentDto> {
    const client = this.supabaseService.getClient();

    // Ensure harvest exists
    const { data: harvest } = await client
      .from('harvest_requests')
      .select('id, seller_org_id')
      .eq('id', harvestId)
      .single();
    if (!harvest) throw new NotFoundException('Harvest update not found');

    const { data, error } = await client
      .from('harvest_comments')
      .insert({
        harvest_id: harvestId,
        buyer_org_id: buyerOrgId,
        buyer_user_id: buyerUserId,
        content: dto.content,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to add comment: ${error.message}`);
    }

    return {
      id: data.id,
      harvest_id: data.harvest_id,
      buyer_org_id: data.buyer_org_id,
      buyer_user_id: data.buyer_user_id,
      content: data.content,
      created_at: data.created_at,
    };
  }

  async createHarvestBuyerRequest(
    buyerOrgId: string,
    buyerUserId: string,
    harvestId: string,
    dto: CreateHarvestBuyerRequestDto,
  ): Promise<HarvestBuyerRequestDto> {
    const client = this.supabaseService.getClient();

    // Verify harvest exists
    const { data: harvest } = await client
      .from('harvest_requests')
      .select('id, seller_org_id')
      .eq('id', harvestId)
      .single();
    if (!harvest) throw new NotFoundException('Harvest update not found');

    const { data, error } = await client
      .from('harvest_buyer_requests')
      .insert({
        harvest_id: harvestId,
        seller_org_id: harvest.seller_org_id,
        buyer_org_id: buyerOrgId,
        buyer_user_id: buyerUserId,
        requested_quantity: dto.quantity,
        unit: dto.unit,
        requested_date: dto.requested_date ?? null,
        notes: dto.notes ?? null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create request: ${error.message}`,
      );
    }

    return {
      id: data.id,
      harvest_id: data.harvest_id,
      seller_org_id: data.seller_org_id,
      buyer_org_id: data.buyer_org_id,
      buyer_user_id: data.buyer_user_id,
      requested_quantity: parseFloat(data.requested_quantity),
      unit: data.unit,
      requested_date: data.requested_date,
      notes: data.notes,
      status: data.status,
      acknowledged_at: data.acknowledged_at,
      acknowledged_by: data.acknowledged_by,
      seller_message: data.seller_message,
      created_at: data.created_at,
    };
  }

  async acknowledgeHarvestBuyerRequest(
    sellerOrgId: string,
    requestId: string,
    userId: string,
    dto: AcknowledgeHarvestBuyerRequestDto,
  ): Promise<HarvestBuyerRequestDto> {
    const client = this.supabaseService.getClient();

    // Ensure request belongs to seller
    const { data: existing } = await client
      .from('harvest_buyer_requests')
      .select('*')
      .eq('id', requestId)
      .eq('seller_org_id', sellerOrgId)
      .single();
    if (!existing) throw new NotFoundException('Request not found');

    const status = dto.can_fulfill ? 'acknowledged_yes' : 'acknowledged_no';
    const { data, error } = await client
      .from('harvest_buyer_requests')
      .update({
        status,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
        seller_message: dto.seller_message ?? null,
      })
      .eq('id', requestId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to acknowledge request: ${error.message}`,
      );
    }

    return {
      id: data.id,
      harvest_id: data.harvest_id,
      seller_org_id: data.seller_org_id,
      buyer_org_id: data.buyer_org_id,
      buyer_user_id: data.buyer_user_id,
      requested_quantity: parseFloat(data.requested_quantity),
      unit: data.unit,
      requested_date: data.requested_date,
      notes: data.notes,
      status: data.status,
      acknowledged_at: data.acknowledged_at,
      acknowledged_by: data.acknowledged_by,
      seller_message: data.seller_message,
      created_at: data.created_at,
    };
  }

  // ==================== PAYOUTS & BALANCE ====================

  /**
   * Get seller's current balance (available and pending amounts)
   */
  async getSellerBalance(sellerOrgId: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('seller_balances')
      .select('*')
      .eq('seller_org_id', sellerOrgId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    const balance = data || {
      available_amount_cents: 0,
      pending_amount_cents: 0,
      credit_amount_cents: 0,
      currency: 'USD',
    };

    const minPayoutCents = 10000; // $100 minimum
    const creditCents = Number(balance.credit_amount_cents || 0);

    return {
      available_amount: Number(balance.available_amount_cents || 0) / 100,
      available_amount_cents: Number(balance.available_amount_cents || 0),
      pending_amount: Number(balance.pending_amount_cents || 0) / 100,
      pending_amount_cents: Number(balance.pending_amount_cents || 0),
      // Credits: positive means seller owes Procur, negative means Procur owes seller
      credit_amount: creditCents / 100,
      credit_amount_cents: creditCents,
      has_credit_balance: creditCents !== 0,
      credit_type: creditCents > 0 ? 'owes_procur' : creditCents < 0 ? 'owed_by_procur' : 'none',
      currency: balance.currency || 'USD',
      minimum_payout_amount: minPayoutCents / 100,
      minimum_payout_cents: minPayoutCents,
      can_request_payout:
        Number(balance.available_amount_cents || 0) >= minPayoutCents,
    };
  }

  /**
   * Get seller's payout history (from transactions with leg: 'farmer_payout')
   * This matches what the admin sees in the payments page.
   */
  async getSellerPayouts(
    sellerOrgId: string,
    query: { page?: number; limit?: number; status?: string },
  ) {
    const client = this.supabaseService.getClient();
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const from = (page - 1) * limit;

    // Query transactions that are farmer payouts for this seller
    let dbQuery = client
      .from('transactions')
      .select(
        'id, transaction_number, order_id, amount, currency, status, metadata, processed_at, settled_at, created_at',
        { count: 'exact' },
      )
      .eq('seller_org_id', sellerOrgId)
      .contains('metadata', {
        flow: 'direct_deposit_clearing',
        leg: 'farmer_payout',
      })
      .order('created_at', { ascending: false });

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, error, count } = await dbQuery.range(from, from + limit - 1);

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Map to a consistent format
    const payouts = (data || []).map((tx: any) => {
      const meta = (tx.metadata || {}) as {
        phase?: string;
        payout_proof_url?: string;
      };
      return {
        id: tx.id,
        transaction_number: tx.transaction_number,
        order_id: tx.order_id,
        amount: Number(tx.amount || 0),
        amount_cents: Math.round(Number(tx.amount || 0) * 100),
        currency: tx.currency || 'XCD',
        status: tx.status,
        phase: meta.phase || null,
        proof_url: meta.payout_proof_url || null,
        processed_at: tx.processed_at,
        paid_at: tx.settled_at,
        created_at: tx.created_at,
      };
    });

    return {
      payouts,
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Get seller's credit transaction history
   */
  async getSellerCreditTransactions(
    sellerOrgId: string,
    query: { page?: number; limit?: number },
  ) {
    const client = this.supabaseService.getClient();
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const from = (page - 1) * limit;

    const { data, error, count } = await client
      .from('seller_credit_transactions')
      .select(
        `
        id,
        amount_cents,
        balance_after_cents,
        type,
        reason,
        note,
        reference,
        order_id,
        created_at
      `,
        { count: 'exact' },
      )
      .eq('seller_org_id', sellerOrgId)
      .range(from, from + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const transactions = (data || []).map((row: any) => ({
      id: row.id,
      amount_cents: Number(row.amount_cents || 0),
      amount: Number(row.amount_cents || 0) / 100,
      balance_after_cents: Number(row.balance_after_cents || 0),
      balance_after: Number(row.balance_after_cents || 0) / 100,
      type: row.type,
      reason: row.reason,
      note: row.note,
      reference: row.reference,
      order_id: row.order_id,
      created_at: row.created_at,
    }));

    return {
      transactions,
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Get payout settings (minimum threshold, schedule, next payout date)
   */
  async getPayoutSettings(sellerOrgId: string) {
    const client = this.supabaseService.getClient();

    // Find the most recent scheduled payout for this seller
    const { data: lastScheduledPayout } = await client
      .from('transactions')
      .select('created_at, updated_at, metadata')
      .eq('seller_org_id', sellerOrgId)
      .eq('status', 'scheduled')
      .contains('metadata', {
        flow: 'direct_deposit_clearing',
        leg: 'farmer_payout',
      })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextPayoutDate: string;

    if (lastScheduledPayout) {
      // Calculate 2 weeks from when the payout was scheduled
      const scheduledDate = new Date(
        lastScheduledPayout.updated_at || lastScheduledPayout.created_at,
      );
      const twoWeeksLater = new Date(scheduledDate);
      twoWeeksLater.setDate(scheduledDate.getDate() + 14);
      nextPayoutDate = twoWeeksLater.toISOString().split('T')[0];
    } else {
      // No scheduled payouts - use the next bi-weekly Friday
      nextPayoutDate = this.calculateNextBiweeklyFriday();
    }

    return {
      minimum_payout_amount: 100,
      minimum_payout_cents: 10000,
      currency: 'USD',
      payout_frequency_days: 14,
      payout_frequency_label: 'Every 2 weeks',
      next_payout_date: nextPayoutDate,
    };
  }

  /**
   * Calculate the next bi-weekly payout date (every other Friday)
   * Used as a fallback when no scheduled payouts exist
   */
  private calculateNextBiweeklyFriday(): string {
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Find next Friday (day 5)
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0) daysUntilFriday = 7; // If today is Friday, next Friday

    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);

    // Use a reference date (a Friday) to determine bi-weekly cycle
    const referenceDate = new Date('2026-01-03'); // A known Friday
    const diffDays = Math.floor(
      (nextFriday.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weekNumber = Math.floor(diffDays / 7);

    if (weekNumber % 2 !== 0) {
      // Not a payout week, add 7 days
      nextFriday.setDate(nextFriday.getDate() + 7);
    }

    return nextFriday.toISOString().split('T')[0];
  }

  // ==================== PRODUCT REQUESTS (SELLER VIEW) ====================

  async getProductRequests(
    sellerOrgId: string,
    query: any,
  ): Promise<{
    requests: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertSellerVerified(sellerOrgId);
    const { page = 1, limit = 20, status, search, category } = query;
    const offset = (page - 1) * limit;

    const client = this.supabaseService.getClient();

    // Build query - get all buyer product requests (open marketplace view)
    let queryBuilder = client.from('product_requests').select(
      `
        *,
        buyer_org:organizations!buyer_org_id(name),
        quotes:request_quotes!request_id(id, seller_org_id, status)
      `,
      { count: 'exact' },
    );
    // all sellers should see all requests, regardless of targeting
    // Apply filters
    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (category) queryBuilder = queryBuilder.eq('category', category);
    if (search) {
      queryBuilder = queryBuilder.or(
        `product_name.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    // Pagination and sorting
    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: requests, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch product requests: ${error.message}`,
      );
    }

    const rows = requests || [];

    // Pre-compute buyer ratings from buyer_reviews
    const buyerIds = Array.from(
      new Set(
        rows
          .map((r: any) => (r.buyer_org_id as string | null) ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let buyerRatingsByOrg: Record<string, number> = {};
    if (buyerIds.length > 0) {
      const { data: reviews } = await client
        .from('buyer_reviews')
        .select('buyer_org_id, rating')
        .in('buyer_org_id', buyerIds);

      const agg = new Map<string, { sum: number; count: number }>();
      (reviews || []).forEach((r: any) => {
        const bid = r.buyer_org_id as string;
        const rating = Number(r.rating) || 0;
        const cur = agg.get(bid) || { sum: 0, count: 0 };
        cur.sum += rating;
        cur.count += 1;
        agg.set(bid, cur);
      });

      buyerRatingsByOrg = Object.fromEntries(
        Array.from(agg.entries()).map(([bid, a]) => [
          bid,
          a.count > 0 ? Number((a.sum / a.count).toFixed(2)) : 0,
        ]),
      );
    }

    // Map to response DTO
    const mapped = rows.map((req) => {
      const myQuote = req.quotes?.find(
        (q: any) => q.seller_org_id === sellerOrgId,
      );

      return {
        id: req.id,
        request_number: req.request_number,
        buyer_org_id: req.buyer_org_id,
        buyer_user_id: req.buyer_user_id,
        buyer_name: req.buyer_org?.name || 'Unknown Buyer',
        product_name: req.product_name,
        description: req.description,
        category: req.category,
        quantity: req.quantity,
        unit_of_measurement: req.unit_of_measurement,
        budget_range:
          req.budget_min != null && req.budget_max != null
            ? {
                min_price: Number(req.budget_min),
                max_price: Number(req.budget_max),
                currency: req.currency,
              }
            : undefined,
        date_needed: req.date_needed,
        delivery_location: req.delivery_location,
        status: req.status,
        expires_at: req.expires_at,
        quote_count: req.quotes?.length || 0,
        my_quote: myQuote
          ? {
              id: myQuote.id,
              status: myQuote.status,
            }
          : undefined,
        buyer_rating: buyerRatingsByOrg[req.buyer_org_id as string],
        created_at: req.created_at,
      };
    });

    return {
      requests: mapped,
      total: count || 0,
      page,
      limit,
    };
  }

  async getProductRequestDetail(
    sellerOrgId: string,
    requestId: string,
  ): Promise<any> {
    const client = this.supabaseService.getClient();

    const { data: request, error } = await client
      .from('product_requests')
      .select(
        `
        *,
        buyer_org:organizations!buyer_org_id(name, country, logo_url),
        quotes:request_quotes!request_id(
          id, seller_org_id, unit_price, total_price, currency,
          available_quantity, delivery_date, notes, status, created_at
        )
      `,
      )
      .eq('id', requestId)
      .single();

    if (error || !request) {
      throw new NotFoundException('Product request not found');
    }

    // All sellers are allowed to view any request details

    const myQuote = request.quotes?.find(
      (q: any) => q.seller_org_id === sellerOrgId,
    );

    // Buyer rating from buyer_reviews
    let buyerRating: number | undefined;
    if (request.buyer_org_id) {
      const { data: reviews } = await client
        .from('buyer_reviews')
        .select('rating')
        .eq('buyer_org_id', request.buyer_org_id);
      if (reviews && reviews.length > 0) {
        const sum = reviews.reduce(
          (acc: number, r: any) => acc + Number(r.rating || 0),
          0,
        );
        buyerRating = Number((sum / reviews.length).toFixed(2));
      }
    }

    return {
      id: request.id,
      request_number: request.request_number,
      buyer_org_id: request.buyer_org_id,
      buyer_user_id: request.buyer_user_id,
      buyer_name: request.buyer_org?.name || 'Unknown Buyer',
      buyer_country: request.buyer_org?.country,
      buyer_logo_url: request.buyer_org?.logo_url,
      product_name: request.product_name,
      description: request.description,
      category: request.category,
      quantity: request.quantity,
      unit_of_measurement: request.unit_of_measurement,
      budget_range:
        request.budget_min != null && request.budget_max != null
          ? {
              min_price: Number(request.budget_min),
              max_price: Number(request.budget_max),
              currency: request.currency,
            }
          : undefined,
      date_needed: request.date_needed,
      delivery_location: request.delivery_location,
      specifications: request.specifications,
      certifications_required: request.certifications_required,
      status: request.status,
      expires_at: request.expires_at,
      quote_count: request.quotes?.length || 0,
      my_quote: myQuote,
      buyer_rating: buyerRating,
      created_at: request.created_at,
    };
  }

  async createQuote(
    sellerOrgId: string,
    requestId: string,
    createDto: any,
    userId: string,
  ): Promise<any> {
    await this.assertSellerVerified(sellerOrgId);
    const client = this.supabaseService.getClient();

    // Check if request exists and is still open
    const { data: request, error: requestError } = await client
      .from('product_requests')
      .select('id, status, target_seller_id')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new NotFoundException('Product request not found');
    }

    const acceptingStatuses = ['open', 'active'];
    if (!acceptingStatuses.includes(request.status)) {
      throw new BadRequestException(
        'This request is no longer accepting quotes',
      );
    }

    // Check if seller has access
    if (request.target_seller_id && request.target_seller_id !== sellerOrgId) {
      throw new ForbiddenException('Access denied to this request');
    }

    // Check if seller already submitted a quote
    const { data: existingQuote } = await client
      .from('request_quotes')
      .select('id')
      .eq('request_id', requestId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (existingQuote) {
      throw new BadRequestException(
        'You have already submitted a quote for this request',
      );
    }

    // Calculate total price
    const totalPrice = createDto.unit_price * createDto.available_quantity;

    // Create quote
    const { data: quote, error: createError } = await client
      .from('request_quotes')
      .insert({
        request_id: requestId,
        seller_org_id: sellerOrgId,
        seller_user_id: userId,
        unit_price: createDto.unit_price,
        total_price: totalPrice,
        currency: createDto.currency,
        available_quantity: createDto.available_quantity,
        delivery_date: createDto.delivery_date,
        notes: createDto.notes,
        offered_product_id: createDto.offered_product_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (createError) {
      throw new BadRequestException(
        `Failed to create quote: ${createError.message}`,
      );
    }

    return {
      id: quote.id,
      message: 'Quote submitted successfully',
    };
  }

  private mapFarmVisitToDto(row: any): FarmVisitRequestDto {
    return {
      id: row.id as string,
      seller_org_id: row.seller_org_id as string,
      requested_by_user_id: row.requested_by_user_id as string,
      preferred_date: (row.preferred_date as string | null) ?? null,
      preferred_time_window:
        (row.preferred_time_window as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      status: (row.status as string) ?? 'pending',
      scheduled_for: (row.scheduled_for as string | null) ?? null,
      admin_notes: (row.admin_notes as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  // ==================== PAYOUT REQUESTS ====================

  /**
   * Request a payout from the available balance
   */
  async requestPayout(
    sellerOrgId: string,
    dto: { amount?: number; note?: string },
  ) {
    const client = this.supabaseService.getClient();

    // Get current balance
    const balance = await this.getSellerBalance(sellerOrgId);

    if (!balance.can_request_payout) {
      throw new BadRequestException(
        `Minimum payout amount is $${balance.minimum_payout_amount}. Your available balance is $${balance.available_amount.toFixed(2)}.`,
      );
    }

    // Check for pending payout requests
    const { data: pendingRequest } = await client
      .from('payout_requests')
      .select('id')
      .eq('seller_org_id', sellerOrgId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (pendingRequest) {
      throw new BadRequestException(
        'You already have a pending payout request. Please wait for it to be processed.',
      );
    }

    // Use full available balance if no amount specified
    const requestedAmountCents = dto.amount
      ? Math.round(dto.amount * 100)
      : balance.available_amount_cents;

    if (requestedAmountCents > balance.available_amount_cents) {
      throw new BadRequestException(
        `Requested amount exceeds available balance of $${balance.available_amount.toFixed(2)}.`,
      );
    }

    if (requestedAmountCents < balance.minimum_payout_cents) {
      throw new BadRequestException(
        `Minimum payout amount is $${balance.minimum_payout_amount}.`,
      );
    }

    // Create payout request
    const { data: request, error } = await client
      .from('payout_requests')
      .insert({
        seller_org_id: sellerOrgId,
        amount_cents: requestedAmountCents,
        currency: balance.currency || 'XCD',
        status: 'pending',
        note: dto.note || null,
      })
      .select('id, amount_cents, currency, status, requested_at')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create payout request: ${error.message}`);
    }

    return {
      id: request.id,
      amount: requestedAmountCents / 100,
      amount_cents: requestedAmountCents,
      currency: request.currency,
      status: request.status,
      requested_at: request.requested_at,
      message: 'Payout request submitted successfully',
    };
  }

  /**
   * Get payout requests for a seller
   */
  async getPayoutRequests(
    sellerOrgId: string,
    query: { page?: number; limit?: number; status?: string },
  ) {
    const client = this.supabaseService.getClient();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let queryBuilder = client
      .from('payout_requests')
      .select('*', { count: 'exact' })
      .eq('seller_org_id', sellerOrgId)
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(error.message);
    }

    const requests = (data || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount_cents || 0) / 100,
      amount_cents: Number(row.amount_cents || 0),
      currency: row.currency,
      status: row.status,
      requested_at: row.requested_at,
      processed_at: row.processed_at,
      completed_at: row.completed_at,
      rejection_reason: row.rejection_reason,
      note: row.note,
      admin_note: row.admin_note,
    }));

    return {
      requests,
      total: count || 0,
      page,
      limit,
    };
  }

  /**
   * Cancel a pending payout request
   */
  async cancelPayoutRequest(sellerOrgId: string, requestId: string) {
    const client = this.supabaseService.getClient();

    const { data: request, error: fetchError } = await client
      .from('payout_requests')
      .select('id, status')
      .eq('id', requestId)
      .eq('seller_org_id', sellerOrgId)
      .single();

    if (fetchError || !request) {
      throw new NotFoundException('Payout request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        'Can only cancel pending payout requests',
      );
    }

    const { error: updateError } = await client
      .from('payout_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      throw new BadRequestException(`Failed to cancel request: ${updateError.message}`);
    }

    return { success: true, message: 'Payout request cancelled' };
  }
}
