import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
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
} from './dto';
import { SellerHomeResponseDto, BuyerRequestSummaryDto } from './dto/home.dto';
import {
  CreateHarvestRequestDto,
  HarvestRequestResponseDto,
  HarvestFeedItemDto,
  HarvestCommentDto,
  CreateHarvestCommentDto,
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

@Injectable()
export class SellersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ==================== PRODUCT MANAGEMENT ====================

  async createProduct(
    sellerOrgId: string,
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    const client = this.supabaseService.getClient();

    // Generate slug if not provided
    const slug = await this.generateProductSlug(createProductDto.name);

    const { images, ...productCore } = createProductDto as any;

    const productData: CreateProductData = {
      seller_org_id: sellerOrgId,
      ...(productCore as any),
      created_by: userId,
      slug,
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

  async getProductById(
    sellerOrgId: string,
    productId: string,
  ): Promise<ProductResponseDto> {
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
    const client = this.supabaseService.getClient();

    // Check if product exists and belongs to seller
    await this.getProductById(sellerOrgId, productId);

    const updateData: UpdateProductData = {
      ...updateProductDto,
      updated_by: userId,
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

    return this.mapProductToResponse(data);
  }

  async deleteProduct(sellerOrgId: string, productId: string): Promise<void> {
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
  }

  async addProductImage(
    sellerOrgId: string,
    productId: string,
    imageDto: ProductImageDto,
  ): Promise<void> {
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
        order_items(*),
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
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('orders')
      .select(
        `
        *,
        order_items(*),
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
        order_items(*),
        order_timeline(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException(`Failed to accept order: ${error.message}`);
    }

    return this.mapOrderToResponse(data);
  }

  async rejectOrder(
    sellerOrgId: string,
    orderId: string,
    rejectOrderDto: RejectOrderDto,
    userId: string,
  ): Promise<OrderResponseDto> {
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
        order_items(*),
        order_timeline(*),
        organizations!buyer_org_id(name, business_name)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException(`Failed to reject order: ${error.message}`);
    }

    return this.mapOrderToResponse(data);
  }

  async updateOrderStatus(
    sellerOrgId: string,
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    userId: string,
  ): Promise<OrderResponseDto> {
    const client = this.supabaseService.getClient();

    // Check if order exists and belongs to seller
    await this.getOrderById(sellerOrgId, orderId);

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
        order_items(*),
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

    return this.mapOrderToResponse(data);
  }

  async getOrderTimeline(sellerOrgId: string, orderId: string): Promise<any[]> {
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
    const { period_start, period_end } = this.getPeriodDates(
      query.period,
      query.start_date,
      query.end_date,
    );

    // This would involve multiple database queries to gather all metrics
    // For brevity, I'm providing a simplified implementation
    const client = this.supabaseService.getClient();

    // Get orders data
    const { data: orders } = await client
      .from('orders')
      .select('total_amount, status, created_at')
      .eq('seller_org_id', sellerOrgId)
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    // Get products data
    const { data: products } = await client
      .from('products')
      .select('status, stock_quantity, min_stock_level')
      .eq('seller_org_id', sellerOrgId);

    return this.calculateDashboardMetrics(
      orders || [],
      products || [],
      period_start,
      period_end,
    );
  }

  // ==================== HELPER METHODS ====================

  private async generateProductSlug(
    name: string,
    productId?: string,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    // Create base slug from name
    let baseSlug = name
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
    let period_start: Date;
    let period_end: Date = now;

    if (period === 'custom' && startDate && endDate) {
      period_start = new Date(startDate);
      period_end = new Date(endDate);
    } else {
      switch (period) {
        case 'today':
          period_start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case 'yesterday':
          period_start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
          );
          period_end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
            23,
            59,
            59,
          );
          break;
        case 'last_7_days':
          period_start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_30_days':
        default:
          period_start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    return {
      period_start: period_start.toISOString(),
      period_end: period_end.toISOString(),
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
    const totalRevenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.total_amount),
      0,
    );
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const pendingOrders = orders.filter(
      (order) => order.status === 'pending',
    ).length;
    const activeProducts = products.filter(
      (product) => product.status === 'active',
    ).length;
    const lowStockProducts = products.filter(
      (product) =>
        product.stock_quantity <= product.min_stock_level &&
        product.stock_quantity > 0,
    ).length;
    const outOfStockProducts = products.filter(
      (product) => product.stock_quantity === 0,
    ).length;

    return {
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      total_products_sold: orders.reduce((sum, order) => sum + 1, 0), // Simplified
      average_order_value: averageOrderValue,
      pending_orders: pendingOrders,
      active_products: activeProducts,
      low_stock_products: lowStockProducts,
      out_of_stock_products: outOfStockProducts,
      revenue_growth: 0, // Would need previous period data
      orders_growth: 0, // Would need previous period data
      top_selling_product: {
        id: '',
        name: 'N/A',
        quantity_sold: 0,
        revenue: 0,
      },
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
        id, request_number, product_name, quantity, unit_of_measurement, date_needed, budget_range, status, buyer_org_id, expires_at,
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
        budget_range_text: r.budget_range
          ? `${r.budget_range.min}-${r.budget_range.max} ${r.budget_range.currency || 'USD'}`
          : undefined,
        buyer_name: r.organizations?.name || 'Buyer',
        location: undefined,
        priority: r.status === 'open' ? 'high' : 'normal',
      }),
    );

    return {
      metrics,
      featured_products: featured,
      inventory,
      recent_orders: orders,
      buyer_requests: requests,
    };
  }

  // ==================== HARVEST REQUESTS ====================

  async createHarvestRequest(
    sellerOrgId: string,
    dto: CreateHarvestRequestDto,
    userId: string,
  ): Promise<HarvestRequestResponseDto> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('harvest_requests')
      .insert({
        seller_org_id: sellerOrgId,
        crop: dto.crop,
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

  async getHarvestFeed(sellerOrgId: string): Promise<HarvestFeedItemDto[]> {
    const client = this.supabaseService.getClient();

    const { data: harvests, error } = await client
      .from('harvest_requests')
      .select('*')
      .eq('seller_org_id', sellerOrgId)
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

    return (harvests || []).map((h: any) => ({
      id: h.id,
      seller_org_id: h.seller_org_id,
      crop: h.crop,
      expected_harvest_window: h.expected_harvest_window,
      quantity: h.quantity,
      unit: h.unit,
      notes: h.notes,
      created_at: h.created_at,
      comments_count: h.comments_count || 0,
      requests_count: h.requests_count || 0,
      comments: (commentsByHarvest.get(h.id) || []).map(
        (c: any): HarvestCommentDto => ({
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
    }));
  }

  async addHarvestComment(
    buyerOrgId: string,
    buyerUserId: string,
    harvestId: string,
    dto: CreateHarvestCommentDto,
  ): Promise<HarvestCommentDto> {
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
}
