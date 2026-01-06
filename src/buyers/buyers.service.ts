import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateService } from '../whatsapp/templates/template.service';
import { EmailService } from '../email/email.service';
import { SupabaseService } from '../database/supabase.service';
import { ConversationsService } from '../messages/services/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  // Cart DTOs
  AddToCartDto,
  UpdateCartItemDto,
  CartResponseDto,
  CartCalculationDto,
  CartSummaryDto,
  CartSellerGroupDto,
  CartItemResponseDto,

  // Marketplace DTOs
  MarketplaceProductQueryDto,
  MarketplaceProductDto,
  MarketplaceProductDetailDto,
  MarketplaceSellerDto,
  MarketplaceSellerQueryDto,
  MarketplaceCategoryDto,
  MarketplaceStatsDto,

  // Request DTOs
  CreateProductRequestDto,
  UpdateProductRequestDto,
  ProductRequestQueryDto,
  ProductRequestResponseDto,
  CreateQuoteDto,
  QuoteResponseDto,
  AcceptQuoteDto,

  // Order DTOs
  CreateOrderDto,
  BuyerOrderQueryDto,
  BuyerOrderResponseDto,
  CancelOrderDto,
  OrderReviewDto,
  OrderTimelineEventDto,
  OrderSummaryDto,

  // Profile DTOs
  CreateAddressDto,
  UpdateAddressDto,
  AddressResponseDto,
  UpdatePreferencesDto,
  PreferencesResponseDto,
  BuyerProfileResponseDto,
  FavoriteProductDto,
  FavoriteSellerDto,

  // Transaction DTOs
  BuyerTransactionQueryDto,
  BuyerTransactionResponseDto,
  BuyerTransactionSummaryDto,
  CreateDisputeDto,
  DisputeResponseDto,

  // Harvest Updates DTOs
  HarvestUpdatesQueryDto,
  HarvestUpdateDto,
  HarvestUpdateDetailDto,
  BuyerHarvestCommentDto,
  CreateBuyerHarvestCommentDto,
  ToggleHarvestLikeDto,
  CreateBuyerHarvestRequestDto,
} from './dto';

@Injectable()
export class BuyersService {
  private readonly logger = new Logger(BuyersService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly conversationsService: ConversationsService,
    private readonly waTemplates: TemplateService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getVisibleMarketplaceSellerOrgIds(): Promise<string[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('organizations')
      .select('id')
      .eq('account_type', 'seller')
      .eq('status', 'active')
      .eq('is_hidden_from_marketplace', false);

    if (error) {
      throw new BadRequestException(
        `Failed to load marketplace sellers: ${error.message}`,
      );
    }

    return (data || []).map((r: any) => r.id as string).filter(Boolean);
  }

  private async isSellerHiddenFromMarketplace(sellerOrgId: string): Promise<{
    hidden: boolean;
    status: string | null;
  }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('organizations')
      .select('id, status, is_hidden_from_marketplace')
      .eq('id', sellerOrgId)
      .eq('account_type', 'seller')
      .maybeSingle();

    if (error || !data) {
      return { hidden: true, status: null };
    }

    const status = (data as any).status as string | null;
    const hidden = Boolean((data as any).is_hidden_from_marketplace ?? false);
    return { hidden, status };
  }

  // ==================== MARKETPLACE METHODS ====================

  async browseProducts(
    query: MarketplaceProductQueryDto,
    buyerOrgId?: string,
  ): Promise<{
    products: MarketplaceProductDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      subcategory,
      seller_id,
      min_price,
      max_price,
      is_organic,
      is_local,
      is_featured,
      in_stock,
      tags,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    const offset = (page - 1) * limit;

    const visibleSellerIds = await this.getVisibleMarketplaceSellerOrgIds();
    if (visibleSellerIds.length === 0) {
      return { products: [], total: 0, page, limit };
    }

    if (seller_id && !visibleSellerIds.includes(seller_id)) {
      // Seller exists but is hidden (or not an active seller org) => show nothing in marketplace
      return { products: [], total: 0, page, limit };
    }

    let queryBuilder = this.supabase
      .getClient()
      .from('products')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(id, name, logo_url, business_type, country),
        product_images(image_url, is_primary, display_order)
      `,
        { count: 'exact' },
      )
      .eq('status', 'active')
      .in('seller_org_id', visibleSellerIds)
      .gte('stock_quantity', in_stock ? 1 : 0);

    // Apply filters
    if (search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${search}%, description.ilike.%${search}%, tags.cs.{${search}}`,
      );
    }
    if (category) queryBuilder = queryBuilder.eq('category', category);
    if (subcategory) queryBuilder = queryBuilder.eq('subcategory', subcategory);
    if (seller_id) queryBuilder = queryBuilder.eq('seller_org_id', seller_id);
    if (min_price !== undefined)
      queryBuilder = queryBuilder.gte('base_price', min_price);
    if (max_price !== undefined)
      queryBuilder = queryBuilder.lte('base_price', max_price);
    if (is_organic !== undefined)
      queryBuilder = queryBuilder.eq('is_organic', is_organic);
    if (is_local !== undefined)
      queryBuilder = queryBuilder.eq('is_local', is_local);
    if (is_featured !== undefined)
      queryBuilder = queryBuilder.eq('is_featured', is_featured);
    if (tags && tags.length > 0)
      queryBuilder = queryBuilder.overlaps('tags', tags);

    // Apply sorting
    const sortField = sort_by === 'price' ? 'base_price' : sort_by;
    queryBuilder = queryBuilder.order(sortField, {
      ascending: sort_order === 'asc',
    });

    // Get paginated results
    const { data: products, error, count } = await queryBuilder.range(
      offset,
      offset + limit - 1,
    );

    if (error)
      throw new BadRequestException(
        `Failed to fetch products: ${error.message}`,
      );

    const rawProducts = (products || []) as any[];

    // Pre-compute seller rating aggregates for all sellers represented in this page
    const sellerIds = Array.from(
      new Set(
        rawProducts
          .map((p) => (p.seller_org_id as string | null) ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let sellerRatingsById: Record<string, { avg: number; count: number }> = {};
    if (sellerIds.length > 0) {
      const { data: reviews } = await this.supabase
        .getClient()
        .from('order_reviews')
        .select('seller_org_id, rating')
        .in('seller_org_id', sellerIds);

      const agg = new Map<string, { sum: number; count: number }>();
      (reviews || []).forEach((r: any) => {
        const sid = r.seller_org_id as string;
        const rating = Number(r.rating) || 0;
        const cur = agg.get(sid) || { sum: 0, count: 0 };
        cur.sum += rating;
        cur.count += 1;
        agg.set(sid, cur);
      });

      sellerRatingsById = Object.fromEntries(
        Array.from(agg.entries()).map(([sid, a]) => [
          sid,
          {
            avg: a.count > 0 ? Number((a.sum / a.count).toFixed(2)) : 0,
            count: a.count,
          },
        ]),
      );
    }

    // Transform data
    const transformedProducts: MarketplaceProductDto[] =
      (await Promise.all(
        rawProducts?.map(async (product) => {
          const sellerId = product.seller_org_id as string;
          const sellerRating = sellerRatingsById[sellerId];
          return {
            id: product.id,
            name: product.name,
            short_description: product.short_description,
            category: product.category,
            subcategory: product.subcategory,
            current_price: product.sale_price || product.base_price,
            base_price: product.base_price,
            sale_price: product.sale_price,
            currency: product.currency,
            stock_quantity: product.stock_quantity,
            unit_of_measurement: product.unit_of_measurement,
            condition: product.condition,
            brand: product.brand,
            image_url:
              product.product_images?.find((img) => img.is_primary)
                ?.image_url || product.product_images?.[0]?.image_url,
            images:
              product.product_images
                ?.sort((a, b) => a.display_order - b.display_order)
                .map((img) => img.image_url) || [],
            tags: product.tags,
            is_organic: product.is_organic,
            is_local: product.is_local,
            is_featured: product.is_featured,
            average_rating: undefined, // Product-level ratings could be added later
            review_count: 0,
            seller: {
              id: product.seller_organization.id,
              name: product.seller_organization.name,
              description: undefined,
              logo_url: product.seller_organization.logo_url,
              location: product.seller_organization.country,
              average_rating: sellerRating?.avg,
              review_count: sellerRating?.count ?? 0,
              product_count: 0, // TODO: Count seller products
              is_verified: true, // TODO: Add verification logic
            },
            is_favorited: buyerOrgId
              ? await this.isProductFavorited(buyerOrgId, product.id)
              : false,
          };
        }),
      )) || [];

    return {
      products: transformedProducts,
      total: count || 0,
      page,
      limit,
    };
  }

  async getProductDetail(
    productId: string,
    buyerOrgId?: string,
  ): Promise<MarketplaceProductDetailDto> {
    const client = this.supabase.getClient();

    const { data: product, error } = await client
      .from('products')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(id, name, logo_url, business_type, country),
        product_images(image_url, alt_text, is_primary, display_order)
      `,
      )
      .eq('id', productId)
      .eq('status', 'active')
      .single();

    if (error || !product) {
      throw new NotFoundException('Product not found');
    }

    // If the seller is hidden from marketplace (or not active), treat as not found.
    {
      const sellerOrgId = product.seller_org_id as string;
      const { hidden, status } =
        await this.isSellerHiddenFromMarketplace(sellerOrgId);
      if (hidden || status !== 'active') {
        throw new NotFoundException('Product not found');
      }
    }

    const visibleSellerIds = await this.getVisibleMarketplaceSellerOrgIds();

    // Get related products (same category, different seller or same seller)
    const { data: relatedProducts } = await client
      .from('products')
      .select(
        `
        id, name, short_description, category, base_price, sale_price, currency,
        stock_quantity, unit_of_measurement, condition, brand,
        seller_organization:organizations!seller_org_id(id, name),
        product_images(image_url, is_primary, display_order)
      `,
      )
      .eq('category', product.category)
      .neq('id', productId)
      .eq('status', 'active')
      .in('seller_org_id', visibleSellerIds)
      .limit(6);

    // Compute seller rating aggregate
    let sellerAverageRating: number | undefined;
    let sellerReviewCount = 0;
    {
      const { data: reviews } = await client
        .from('order_reviews')
        .select('rating')
        .eq('seller_org_id', product.seller_org_id);
      if (reviews && reviews.length > 0) {
        const sum = reviews.reduce(
          (acc: number, r: any) => acc + Number(r.rating || 0),
          0,
        );
        sellerReviewCount = reviews.length;
        sellerAverageRating = Number((sum / reviews.length).toFixed(2));
      }
    }

    const transformedProduct: MarketplaceProductDetailDto = {
      id: product.id,
      name: product.name,
      description: product.description,
      short_description: product.short_description,
      sku: product.sku,
      category: product.category,
      subcategory: product.subcategory,
      current_price: product.sale_price || product.base_price,
      base_price: product.base_price,
      sale_price: product.sale_price,
      currency: product.currency,
      stock_quantity: product.stock_quantity,
      min_stock_level: product.min_stock_level,
      unit_of_measurement: product.unit_of_measurement,
      weight: product.weight,
      dimensions: product.dimensions,
      condition: product.condition,
      brand: product.brand,
      color: product.color,
      size: product.size,
      model: product.model,
      image_url:
        product.product_images?.find((img) => img.is_primary)?.image_url ||
        product.product_images?.[0]?.image_url,
      images:
        product.product_images
          ?.sort((a, b) => a.display_order - b.display_order)
          .map((img) => img.image_url) || [],
      tags: product.tags,
      is_organic: product.is_organic,
      is_local: product.is_local,
      is_featured: product.is_featured,
      average_rating: undefined,
      review_count: 0,
      seller: {
        id: product.seller_organization.id,
        name: product.seller_organization.name,
        description: undefined,
        logo_url: product.seller_organization.logo_url,
        location: product.seller_organization.country,
        average_rating: sellerAverageRating,
        review_count: sellerReviewCount,
        product_count: 0, // TODO: Count seller products
        is_verified: true, // TODO: Add verification logic
      },
      is_favorited: buyerOrgId
        ? await this.isProductFavorited(buyerOrgId, productId)
        : false,
      recent_reviews: [], // TODO: Get recent reviews
      related_products:
        relatedProducts?.map((rp) => ({
          id: rp.id,
          name: rp.name,
          short_description: rp.short_description,
          category: rp.category,
          current_price: rp.sale_price || rp.base_price,
          base_price: rp.base_price,
          sale_price: rp.sale_price,
          currency: rp.currency,
          stock_quantity: rp.stock_quantity,
          unit_of_measurement: rp.unit_of_measurement,
          condition: rp.condition,
          brand: rp.brand,
          image_url:
            rp.product_images?.find((img) => img.is_primary)?.image_url ||
            rp.product_images?.[0]?.image_url,
          images:
            rp.product_images
              ?.sort((a, b) => a.display_order - b.display_order)
              .map((img) => img.image_url) || [],
          tags: [],
          is_organic: false,
          is_local: false,
          is_featured: false,
          average_rating: undefined,
          review_count: 0,
          seller: {
            id: (rp.seller_organization as any)?.id || 'unknown',
            name: (rp.seller_organization as any)?.name || 'Unknown Seller',
            average_rating: undefined,
            review_count: 0,
            product_count: 0,
            is_verified: true,
          },
        })) || [],
    };

    return transformedProduct;
  }

  async getSellers(query?: MarketplaceSellerQueryDto): Promise<{
    sellers: MarketplaceSellerDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      business_type,
      location,
      is_verified,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query || {};

    const offset = (page - 1) * limit;

    let queryBuilder = this.supabase
      .getClient()
      .from('organizations')
      .select(
        `
        id, name, logo_url, header_image_url, created_at, business_type, country,
        products:products!seller_org_id(id, status)
      `,
        { count: 'exact' },
      )
      .eq('account_type', 'seller')
      .eq('status', 'active')
      .eq('is_hidden_from_marketplace', false);

    // Apply filters
    if (search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${search}%, business_type.ilike.%${search}%, country.ilike.%${search}%`,
      );
    }
    if (business_type) {
      queryBuilder = queryBuilder.eq('business_type', business_type);
    }
    if (location) {
      queryBuilder = queryBuilder.ilike('country', `%${location}%`);
    }
    // Note: is_verified filter would need a verification field in the database
    // For now, we'll skip this filter

    // Apply sorting
    const sortField = sort_by === 'product_count' ? 'created_at' : sort_by; // We'll sort by product count in memory
    queryBuilder = queryBuilder.order(sortField, {
      ascending: sort_order === 'asc',
    });

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data: sellers, error, count } = await queryBuilder;

    if (error)
      throw new BadRequestException(
        `Failed to fetch sellers: ${error.message}`,
      );

    const mappedSellers =
      sellers?.map((seller) => ({
        id: seller.id,
        name: seller.name,
        description: undefined,
        business_type: seller.business_type,
        header_image_url: (seller as any).header_image_url ?? undefined,
        logo_url: seller.logo_url,
        location: seller.country,
        average_rating: 0, // Will be calculated from reviews below
        review_count: 0, // TODO: Count reviews
        product_count:
          (seller.products || []).filter((p: any) => p.status === 'active')
            .length || 0,
        years_in_business:
          new Date().getFullYear() - new Date(seller.created_at).getFullYear(),
        is_verified: true, // TODO: Add verification logic
        specialties: [], // TODO: Add specialties
      })) || [];

    // Compute average rating and review count from order_reviews for these sellers
    if (mappedSellers.length > 0) {
      const sellerIds = mappedSellers.map((s) => s.id);
      const { data: reviews } = await this.supabase
        .getClient()
        .from('order_reviews')
        .select('seller_org_id, rating')
        .in('seller_org_id', sellerIds);

      const agg = new Map<string, { sum: number; count: number }>();
      (reviews || []).forEach((r) => {
        const id = r.seller_org_id as string;
        const rating = Number(r.rating) || 0;
        const cur = agg.get(id) || { sum: 0, count: 0 };
        cur.sum += rating;
        cur.count += 1;
        agg.set(id, cur);
      });

      mappedSellers.forEach((s) => {
        const a = agg.get(s.id);
        if (a && a.count > 0) {
          s.average_rating = Number((a.sum / a.count).toFixed(2));
          s.review_count = a.count;
        }
      });
    }

    // Sort by product count if requested (since we can't do this in the database query easily)
    if (sort_by === 'product_count') {
      mappedSellers.sort((a, b) => {
        const comparison = a.product_count - b.product_count;
        return sort_order === 'asc' ? comparison : -comparison;
      });
    }

    return {
      sellers: mappedSellers,
      total: count || 0,
      page,
      limit,
    };
  }

  async getSellerById(sellerId: string): Promise<MarketplaceSellerDto | null> {
    const { sellers } = await this.getSellers({
      page: 1,
      limit: 100,
    });

    const found = sellers.find((s) => s.id === sellerId);
    return found ?? null;
  }

  async getMarketplaceStats(): Promise<MarketplaceStatsDto> {
    const visibleSellerIds = await this.getVisibleMarketplaceSellerOrgIds();
    if (visibleSellerIds.length === 0) {
      return {
        total_products: 0,
        total_sellers: 0,
        total_categories: 0,
        featured_products: 0,
        new_products_this_week: 0,
        popular_categories: [],
      };
    }

    // Get total counts
    const [productsResult, sellersResult, categoriesResult] = await Promise.all(
      [
        this.supabase
          .getClient()
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .in('seller_org_id', visibleSellerIds),
        this.supabase
          .getClient()
          .from('organizations')
          .select('*', { count: 'exact', head: true })
          .eq('account_type', 'seller')
          .eq('status', 'active')
          .eq('is_hidden_from_marketplace', false),
        this.supabase
          .getClient()
          .from('products')
          .select('category')
          .eq('status', 'active')
          .in('seller_org_id', visibleSellerIds),
      ],
    );

    // Get featured products count
    const { count: featuredCount } = await this.supabase
      .getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_featured', true)
      .in('seller_org_id', visibleSellerIds);

    // Get new products this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { count: newProductsCount } = await this.supabase
      .getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .in('seller_org_id', visibleSellerIds)
      .gte('created_at', oneWeekAgo.toISOString());

    // Calculate popular categories
    const categoryMap = new Map<string, number>();
    categoriesResult.data?.forEach((product) => {
      const count = categoryMap.get(product.category) || 0;
      categoryMap.set(product.category, count + 1);
    });

    const popularCategories: MarketplaceCategoryDto[] = Array.from(
      categoryMap.entries(),
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, product_count]) => ({ name, product_count }));

    return {
      total_products: productsResult.count || 0,
      total_sellers: sellersResult.count || 0,
      total_categories: categoryMap.size,
      featured_products: featuredCount || 0,
      new_products_this_week: newProductsCount || 0,
      popular_categories: popularCategories,
    };
  }

  // ==================== CART METHODS ====================

  /**
   * Load platform fee configuration used to estimate buyer-facing delivery fees.
   * Buyer apps should use `buyer_delivery_share` (not an implicit 50/50 split).
   */
  private async getPlatformFeesConfig(): Promise<{
    platformFeePercent: number;
    deliveryFlatFee: number;
    buyerDeliveryShare: number;
    sellerDeliveryShare: number;
    currency: string;
  }> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('platform_fees_config')
      .select(
        'platform_fee_percent, delivery_flat_fee, buyer_delivery_share, seller_delivery_share, currency',
      )
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Fail-open: keep buyer flows working with sensible defaults.
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

  async getCart(
    buyerOrgId: string,
    buyerUserId: string,
  ): Promise<CartResponseDto> {
    // Get or create cart
    const { data: cartResult } = await this.supabase
      .getClient()
      .rpc('get_or_create_cart', {
        p_buyer_org_id: buyerOrgId,
        p_buyer_user_id: buyerUserId,
      });

    const cartId = cartResult;

    // Get cart items with product details
    const { data: cartItems, error } = await this.supabase
      .getClient()
      .from('cart_items')
      .select(
        `
        id, quantity, added_at,
        product:products(
          id, name, sku, base_price, sale_price, currency, stock_quantity, 
          unit_of_measurement, seller_org_id,
          seller_organization:organizations!seller_org_id(id, name, is_hidden_from_marketplace),
          product_images(image_url, is_primary)
        )
      `,
      )
      .eq('cart_id', cartId);

    if (error)
      throw new BadRequestException(`Failed to fetch cart: ${error.message}`);

    if (!cartItems || cartItems.length === 0) {
      return {
        id: cartId,
        seller_groups: [],
        total_items: 0,
        unique_products: 0,
        subtotal: 0,
        estimated_shipping: 0,
        estimated_tax: 0,
        total: 0,
        currency: 'USD',
        updated_at: new Date().toISOString(),
      };
    }

    const visibleSellerIds = await this.getVisibleMarketplaceSellerOrgIds();

    const visibleCartItems = (cartItems || []).filter((item: any) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      const sellerId = product?.seller_org_id as string | undefined;
      return sellerId ? visibleSellerIds.includes(sellerId) : false;
    });

    if (visibleCartItems.length === 0) {
      return {
        id: cartId,
        seller_groups: [],
        total_items: 0,
        unique_products: 0,
        subtotal: 0,
        estimated_shipping: 0,
        estimated_tax: 0,
        total: 0,
        currency: 'USD',
        updated_at: new Date().toISOString(),
      };
    }

    const feesConfig = await this.getPlatformFeesConfig();
    const configuredBuyerShare = Number(feesConfig.buyerDeliveryShare ?? 0);
    const configuredSellerShare = Number(feesConfig.sellerDeliveryShare ?? 0);
    const configuredFlatDelivery = Number(feesConfig.deliveryFlatFee ?? 0);
    const totalDeliveryFee =
      configuredBuyerShare + configuredSellerShare || configuredFlatDelivery;
    // Cart is an estimate (no route/address-based shipping yet). Use buyer share
    // from config; if not configured, fall back to an even split.
    const estimatedBuyerShipping = configuredBuyerShare
      ? Number(configuredBuyerShare.toFixed(2))
      : Number((totalDeliveryFee / 2).toFixed(2));

    // Group items by seller
    const sellerGroups = new Map<string, CartSellerGroupDto>();
    let totalItems = 0;
    let subtotal = 0;

    visibleCartItems.forEach((item: any) => {
      const product = Array.isArray(item.product)
        ? item.product[0]
        : item.product;
      const sellerId = product.seller_org_id;
      const currentPrice = product.sale_price || product.base_price;
      const itemTotal = currentPrice * item.quantity;

      totalItems += item.quantity;
      subtotal += itemTotal;

      if (!sellerGroups.has(sellerId)) {
        sellerGroups.set(sellerId, {
          seller_org_id: sellerId,
          seller_name:
            (product.seller_organization as any)?.name || 'Unknown Seller',
          items: [],
          subtotal: 0,
          estimated_shipping: estimatedBuyerShipping,
          total: 0,
        });
      }

      const group = sellerGroups.get(sellerId)!;
      group.items.push({
        id: item.id,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        unit_price: product.base_price,
        sale_price: product.sale_price,
        quantity: item.quantity,
        total_price: itemTotal,
        currency: product.currency,
        image_url: product.product_images?.find((img) => img.is_primary)
          ?.image_url,
        stock_quantity: product.stock_quantity,
        unit_of_measurement: product.unit_of_measurement,
        seller_org_id: sellerId,
        seller_name:
          (product.seller_organization as any)?.name || 'Unknown Seller',
        added_at: item.added_at,
      });
      group.subtotal += itemTotal;
      group.total = group.subtotal + group.estimated_shipping;
    });

    const estimatedShipping = Array.from(sellerGroups.values()).reduce(
      (sum, group) => sum + group.estimated_shipping,
      0,
    );
    const estimatedTax = subtotal * 0.08; // TODO: Calculate actual tax

    return {
      id: cartId,
      seller_groups: Array.from(sellerGroups.values()),
      total_items: totalItems,
      unique_products: visibleCartItems.length,
      subtotal,
      estimated_shipping: estimatedShipping,
      estimated_tax: estimatedTax,
      total: subtotal + estimatedShipping + estimatedTax,
      currency: 'USD',
      updated_at: new Date().toISOString(),
    };
  }

  async addToCart(
    buyerOrgId: string,
    buyerUserId: string,
    addToCartDto: AddToCartDto,
  ): Promise<void> {
    const { product_id, quantity } = addToCartDto;

    // Verify product exists and is available
    const { data: product, error: productError } = await this.supabase
      .getClient()
      .from('products')
      .select('id, stock_quantity, status, seller_org_id')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== 'active') {
      throw new BadRequestException('Product is not available');
    }

    // Block adding products from hidden (or inactive) sellers
    {
      const sellerOrgId = (product as any).seller_org_id as string | undefined;
      if (sellerOrgId) {
        const { hidden, status } =
          await this.isSellerHiddenFromMarketplace(sellerOrgId);
        if (hidden || status !== 'active') {
          throw new NotFoundException('Product not found');
        }
      }
    }

    if (product.stock_quantity < quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Get or create cart
    const { data: cartId } = await this.supabase
      .getClient()
      .rpc('get_or_create_cart', {
        p_buyer_org_id: buyerOrgId,
        p_buyer_user_id: buyerUserId,
      });

    // Check if product already in cart
    const { data: existingItem } = await this.supabase
      .getClient()
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product_id)
      .single();

    if (existingItem) {
      // Update existing item
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock_quantity) {
        throw new BadRequestException('Total quantity exceeds available stock');
      }

      const { error } = await this.supabase
        .getClient()
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', existingItem.id);

      if (error)
        throw new BadRequestException(
          `Failed to update cart: ${error.message}`,
        );
    } else {
      // Add new item
      const { error } = await this.supabase
        .getClient()
        .from('cart_items')
        .insert({
          cart_id: cartId,
          product_id,
          quantity,
        });

      if (error)
        throw new BadRequestException(
          `Failed to add to cart: ${error.message}`,
        );
    }

    // Update cart timestamp
    await this.supabase
      .getClient()
      .from('shopping_carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cartId);
  }

  async updateCartItem(
    buyerOrgId: string,
    buyerUserId: string,
    itemId: string,
    updateDto: UpdateCartItemDto,
  ): Promise<void> {
    const { quantity } = updateDto;

    // Verify cart item belongs to buyer
    const { data: cartItem, error } = await this.supabase
      .getClient()
      .from('cart_items')
      .select(
        `
        id, product_id, cart_id,
        cart:shopping_carts!inner(buyer_org_id, buyer_user_id),
        product:products(stock_quantity)
      `,
      )
      .eq('id', itemId)
      .single();

    if (error || !cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    const cart = Array.isArray(cartItem.cart)
      ? cartItem.cart[0]
      : cartItem.cart;
    const product = Array.isArray(cartItem.product)
      ? cartItem.product[0]
      : cartItem.product;

    if (
      cart.buyer_org_id !== buyerOrgId ||
      cart.buyer_user_id !== buyerUserId
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (quantity > product.stock_quantity) {
      throw new BadRequestException('Quantity exceeds available stock');
    }

    // Update quantity
    const { error: updateError } = await this.supabase
      .getClient()
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId);

    if (updateError)
      throw new BadRequestException(
        `Failed to update cart item: ${updateError.message}`,
      );

    // Update cart timestamp
    await this.supabase
      .getClient()
      .from('shopping_carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cartItem.cart_id);
  }

  async removeFromCart(
    buyerOrgId: string,
    buyerUserId: string,
    itemId: string,
  ): Promise<void> {
    // Verify cart item belongs to buyer
    const { data: cartItem, error } = await this.supabase
      .getClient()
      .from('cart_items')
      .select(
        `
        id, cart_id,
        shopping_carts!inner(buyer_org_id, buyer_user_id)
      `,
      )
      .eq('id', itemId)
      .single();

    if (error || !cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    const cart = Array.isArray(cartItem.shopping_carts)
      ? cartItem.shopping_carts[0]
      : cartItem.shopping_carts;
    if (
      cart.buyer_org_id !== buyerOrgId ||
      cart.buyer_user_id !== buyerUserId
    ) {
      throw new ForbiddenException('Access denied');
    }

    // Remove item
    const { error: deleteError } = await this.supabase
      .getClient()
      .from('cart_items')
      .delete()
      .eq('id', itemId);

    if (deleteError)
      throw new BadRequestException(
        `Failed to remove cart item: ${deleteError.message}`,
      );

    // Update cart timestamp
    await this.supabase
      .getClient()
      .from('shopping_carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cartItem.cart_id);
  }

  async clearCart(buyerOrgId: string, buyerUserId: string): Promise<void> {
    // Get cart
    const { data: cart } = await this.supabase
      .getClient()
      .from('shopping_carts')
      .select('id')
      .eq('buyer_org_id', buyerOrgId)
      .eq('buyer_user_id', buyerUserId)
      .single();

    if (!cart) return; // No cart to clear

    // Remove all items
    const { error } = await this.supabase
      .getClient()
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    if (error)
      throw new BadRequestException(`Failed to clear cart: ${error.message}`);

    // Update cart timestamp
    await this.supabase
      .getClient()
      .from('shopping_carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cart.id);
  }

  async getCartSummary(
    buyerOrgId: string,
    buyerUserId: string,
  ): Promise<CartSummaryDto> {
    const cart = await this.getCart(buyerOrgId, buyerUserId);

    return {
      total_items: cart.total_items,
      unique_products: cart.unique_products,
      seller_count: cart.seller_groups.length,
      subtotal: cart.subtotal,
      currency: cart.currency,
    };
  }

  // ==================== PRODUCT REQUEST METHODS ====================

  async createProductRequest(
    buyerOrgId: string,
    buyerUserId: string,
    createDto: CreateProductRequestDto,
  ): Promise<ProductRequestResponseDto> {
    const insertPayload: any = {
      buyer_org_id: buyerOrgId,
      buyer_user_id: buyerUserId,
      product_name: createDto.product_name,
      product_type: createDto.product_type,
      category: createDto.category,
      description: createDto.description,
      quantity: createDto.quantity,
      unit_of_measurement: createDto.unit_of_measurement,
      date_needed: createDto.date_needed,
      target_seller_id: createDto.target_seller_id,
      expires_at: createDto.expires_at,
      status: 'draft',
    };

    if (createDto.budget_range) {
      insertPayload.budget_min = createDto.budget_range.min;
      insertPayload.budget_max = createDto.budget_range.max;
      insertPayload.currency = createDto.budget_range.currency;
    }

    const { error, data } = await this.supabase
      .getClient()
      .from('product_requests')
      .insert(insertPayload)
      .select(
        `
        *,
        target_seller:organizations!target_seller_id(name)
      `,
      )
      .single();

    if (error)
      throw new BadRequestException(
        `Failed to create request: ${error.message}`,
      );

    return {
      id: data.id,
      request_number: data.request_number,
      product_name: data.product_name,
      product_type: data.product_type,
      category: data.category,
      description: data.description,
      quantity: data.quantity,
      unit_of_measurement: data.unit_of_measurement,
      date_needed: data.date_needed,
      budget_range:
        data.budget_min != null && data.budget_max != null
          ? {
              min: Number(data.budget_min),
              max: Number(data.budget_max),
              currency: data.currency,
            }
          : undefined,
      target_seller_id: data.target_seller_id,
      target_seller_name: data.target_seller?.name,
      status: data.status,
      response_count: data.response_count,
      expires_at: data.expires_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async getProductRequests(
    buyerOrgId: string,
    query: ProductRequestQueryDto,
  ): Promise<{
    requests: ProductRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;
    const offset = (page - 1) * limit;

    let queryBuilder = this.supabase
      .getClient()
      .from('product_requests')
      .select(
        `
        *,
        target_seller:organizations!target_seller_id(name)
      `,
        { count: 'exact' },
      )
      .eq('buyer_org_id', buyerOrgId);

    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (category) queryBuilder = queryBuilder.eq('category', category);
    if (search)
      queryBuilder = queryBuilder.or(
        `product_name.ilike.%${search}%, description.ilike.%${search}%`,
      );

    queryBuilder = queryBuilder
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: requests, error, count } = await queryBuilder;

    if (error)
      throw new BadRequestException(
        `Failed to fetch requests: ${error.message}`,
      );

    const transformedRequests: ProductRequestResponseDto[] =
      requests?.map((request) => ({
        id: request.id,
        request_number: request.request_number,
        product_name: request.product_name,
        product_type: request.product_type,
        category: request.category,
        description: request.description,
        quantity: request.quantity,
        unit_of_measurement: request.unit_of_measurement,
        date_needed: request.date_needed,
        budget_range:
          request.budget_min != null && request.budget_max != null
            ? {
                min: Number(request.budget_min),
                max: Number(request.budget_max),
                currency: request.currency,
              }
            : undefined,
        target_seller_id: request.target_seller_id,
        target_seller_name: request.target_seller?.name,
        status: request.status,
        response_count: request.response_count,
        expires_at: request.expires_at,
        created_at: request.created_at,
        updated_at: request.updated_at,
      })) || [];

    return {
      requests: transformedRequests,
      total: count || 0,
      page,
      limit,
    };
  }

  async getProductRequestById(
    buyerOrgId: string,
    requestId: string,
  ): Promise<ProductRequestResponseDto> {
    const { data: request, error } = await this.supabase
      .getClient()
      .from('product_requests')
      .select(
        `
        *,
        target_seller:organizations!target_seller_id(name)
      `,
      )
      .eq('id', requestId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (error || !request) {
      throw new NotFoundException('Product request not found');
    }

    return {
      id: request.id,
      request_number: request.request_number,
      product_name: request.product_name,
      product_type: request.product_type,
      category: request.category,
      description: request.description,
      quantity: request.quantity,
      unit_of_measurement: request.unit_of_measurement,
      date_needed: request.date_needed,
      budget_range:
        request.budget_min != null && request.budget_max != null
          ? {
              min: Number(request.budget_min),
              max: Number(request.budget_max),
              currency: request.currency,
            }
          : undefined,
      target_seller_id: request.target_seller_id,
      target_seller_name: request.target_seller?.name,
      status: request.status,
      response_count: request.response_count,
      expires_at: request.expires_at,
      created_at: request.created_at,
      updated_at: request.updated_at,
    };
  }

  async updateProductRequest(
    buyerOrgId: string,
    requestId: string,
    updateDto: UpdateProductRequestDto,
  ): Promise<ProductRequestResponseDto> {
    // Verify ownership
    const { data: existing } = await this.supabase
      .getClient()
      .from('product_requests')
      .select('id, status')
      .eq('id', requestId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!existing) {
      throw new NotFoundException('Product request not found');
    }

    if (existing.status === 'closed' || existing.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot update closed or cancelled request',
      );
    }

    const updatePayload: any = { ...updateDto };

    if (updateDto.budget_range) {
      updatePayload.budget_min = updateDto.budget_range.min;
      updatePayload.budget_max = updateDto.budget_range.max;
      updatePayload.currency = updateDto.budget_range.currency;
      delete updatePayload.budget_range;
    }

    const { data: request, error } = await this.supabase
      .getClient()
      .from('product_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select(
        `
        *,
        target_seller:organizations!target_seller_id(name)
      `,
      )
      .single();

    if (error)
      throw new BadRequestException(
        `Failed to update request: ${error.message}`,
      );

    return {
      id: request.id,
      request_number: request.request_number,
      product_name: request.product_name,
      product_type: request.product_type,
      category: request.category,
      description: request.description,
      quantity: request.quantity,
      unit_of_measurement: request.unit_of_measurement,
      date_needed: request.date_needed,
      budget_range:
        request.budget_min != null && request.budget_max != null
          ? {
              min: Number(request.budget_min),
              max: Number(request.budget_max),
              currency: request.currency,
            }
          : undefined,
      target_seller_id: request.target_seller_id,
      target_seller_name: request.target_seller?.name,
      status: request.status,
      response_count: request.response_count,
      expires_at: request.expires_at,
      created_at: request.created_at,
      updated_at: request.updated_at,
    };
  }

  async deleteProductRequest(
    buyerOrgId: string,
    requestId: string,
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .getClient()
      .from('product_requests')
      .select('id, status')
      .eq('id', requestId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!existing) {
      throw new NotFoundException('Product request not found');
    }

    if (existing.status === 'closed') {
      throw new BadRequestException('Cannot delete closed request');
    }

    const { error } = await this.supabase
      .getClient()
      .from('product_requests')
      .delete()
      .eq('id', requestId);

    if (error)
      throw new BadRequestException(
        `Failed to delete request: ${error.message}`,
      );
  }

  async getRequestQuotes(
    buyerOrgId: string,
    requestId: string,
  ): Promise<QuoteResponseDto[]> {
    // Verify request ownership
    const { data: request } = await this.supabase
      .getClient()
      .from('product_requests')
      .select('id')
      .eq('id', requestId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!request) {
      throw new NotFoundException('Product request not found');
    }

    const { data: quotes, error } = await this.supabase
      .getClient()
      .from('request_quotes')
      .select(
        `
        *,
        seller:organizations!seller_org_id(name),
        offered_product:products!offered_product_id(id, name, description, base_price, currency)
      `,
      )
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error)
      throw new BadRequestException(`Failed to fetch quotes: ${error.message}`);

    return (
      quotes?.map((quote) => ({
        id: quote.id,
        request_id: quote.request_id,
        seller_org_id: quote.seller_org_id,
        seller_name: quote.seller?.name || 'Unknown Seller',
        unit_price: quote.unit_price,
        total_price: quote.total_price,
        currency: quote.currency,
        available_quantity: quote.available_quantity,
        delivery_date: quote.delivery_date,
        notes: quote.notes,
        offered_product_id: quote.offered_product_id,
        offered_product: quote.offered_product,
        status: quote.status,
        seller_rating: undefined, // TODO: Calculate seller rating
        seller_review_count: 0, // TODO: Count seller reviews
        created_at: quote.created_at,
      })) || []
    );
  }

  async acceptQuote(
    buyerOrgId: string,
    requestId: string,
    quoteId: string,
    acceptDto: AcceptQuoteDto,
  ): Promise<BuyerOrderResponseDto> {
    // Verify request ownership and quote validity
    const { data: request } = await this.supabase
      .getClient()
      .from('product_requests')
      .select('id, status, quantity, product_name')
      .eq('id', requestId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!request) {
      throw new NotFoundException('Product request not found');
    }

    if (request.status !== 'open') {
      throw new BadRequestException('Request is not open for quotes');
    }

    const { data: quote } = await this.supabase
      .getClient()
      .from('request_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('request_id', requestId)
      .eq('status', 'pending')
      .single();

    if (!quote) {
      throw new NotFoundException('Quote not found or no longer available');
    }

    // Determine accepted quantity
    const acceptedQuantity =
      acceptDto.accepted_quantity || quote.available_quantity;
    if (acceptedQuantity > quote.available_quantity) {
      throw new BadRequestException(
        'Accepted quantity exceeds available quantity',
      );
    }

    // Calculate pricing
    const unitPrice = quote.unit_price;
    const subtotal = unitPrice * acceptedQuantity;
    const taxAmount = subtotal * 0.08; // TODO: Calculate actual tax
    // Buyer-facing delivery fee should come from platform fees config (buyer_delivery_share).
    const feesConfig = await this.getPlatformFeesConfig();
    const configuredBuyerShare = Number(feesConfig.buyerDeliveryShare ?? 0);
    const configuredSellerShare = Number(feesConfig.sellerDeliveryShare ?? 0);
    const configuredFlatDelivery = Number(feesConfig.deliveryFlatFee ?? 0);
    const totalDeliveryFee =
      configuredBuyerShare + configuredSellerShare || configuredFlatDelivery;
    const shippingAmount = configuredBuyerShare
      ? Number(configuredBuyerShare.toFixed(2))
      : Number((totalDeliveryFee / 2).toFixed(2));
    const totalAmount = subtotal + taxAmount + shippingAmount;

    // Get shipping address
    let shippingAddress;
    if (acceptDto.shipping_address_id) {
      const { data: address } = await this.supabase
        .getClient()
        .from('buyer_addresses')
        .select('*')
        .eq('id', acceptDto.shipping_address_id)
        .eq('buyer_org_id', buyerOrgId)
        .single();

      if (!address) {
        throw new NotFoundException('Shipping address not found');
      }
      shippingAddress = address;
    } else {
      // Get default address
      const { data: defaultAddress } = await this.supabase
        .getClient()
        .from('buyer_addresses')
        .select('*')
        .eq('buyer_org_id', buyerOrgId)
        .eq('is_default', true)
        .single();

      if (!defaultAddress) {
        throw new BadRequestException(
          'No shipping address provided and no default address found',
        );
      }
      shippingAddress = defaultAddress;
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await this.supabase
      .getClient()
      .from('orders')
      .insert({
        order_number: orderNumber,
        buyer_org_id: buyerOrgId,
        seller_org_id: quote.seller_org_id,
        buyer_user_id: quote.seller_user_id, // This should be buyer_user_id from context
        status: 'pending',
        payment_status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        discount_amount: 0,
        total_amount: totalAmount,
        currency: quote.currency,
        shipping_address: shippingAddress,
        billing_address: shippingAddress, // Use same as shipping for now
        buyer_notes: acceptDto.notes,
        estimated_delivery_date: quote.delivery_date,
      })
      .select()
      .single();

    if (orderError) {
      throw new BadRequestException(
        `Failed to create order: ${orderError.message}`,
      );
    }

    // Create order item
    const { error: itemError } = await this.supabase
      .getClient()
      .from('order_items')
      .insert({
        order_id: order.id,
        product_id: quote.offered_product_id || null,
        product_name: request.product_name,
        product_sku: null,
        unit_price: unitPrice,
        quantity: acceptedQuantity,
        total_price: subtotal,
        product_snapshot: {
          quote_id: quoteId,
          original_request: request,
          quote_details: quote,
        },
      });

    if (itemError) {
      throw new BadRequestException(
        `Failed to create order item: ${itemError.message}`,
      );
    }

    // Update quote status
    await this.supabase
      .getClient()
      .from('request_quotes')
      .update({ status: 'accepted' })
      .eq('id', quoteId);

    // Update request status to closed
    await this.supabase
      .getClient()
      .from('product_requests')
      .update({ status: 'closed' })
      .eq('id', requestId);

    // Create order timeline entry
    await this.supabase
      .getClient()
      .from('order_timeline')
      .insert({
        order_id: order.id,
        event_type: 'order_created',
        description: 'Order created from accepted quote',
        metadata: { quote_id: quoteId, request_id: requestId },
        created_by: buyerOrgId,
      });

    return this.transformOrderToResponse(order, [
      {
        id: 'temp',
        product_id: quote.offered_product_id,
        product_name: request.product_name,
        product_sku: null,
        unit_price: unitPrice,
        quantity: acceptedQuantity,
        total_price: subtotal,
        product_snapshot: { quote_id: quoteId },
      },
    ]);
  }

  // ==================== ORDER METHODS ====================

  async createOrder(
    buyerOrgId: string,
    buyerUserId: string,
    createDto: CreateOrderDto,
  ): Promise<BuyerOrderResponseDto> {
    this.logger.log(
      `createOrder start buyer_org=${buyerOrgId} buyer_user=${buyerUserId} items=${createDto.items?.length || 0}`,
    );
    // Validate shipping address
    const { data: shippingAddress } = await this.supabase
      .getClient()
      .from('buyer_addresses')
      .select('*')
      .eq('id', createDto.shipping_address_id)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!shippingAddress) {
      throw new NotFoundException('Shipping address not found');
    }

    // Get billing address if specified
    let billingAddress = shippingAddress;
    if (createDto.billing_address_id) {
      const { data: billing } = await this.supabase
        .getClient()
        .from('buyer_addresses')
        .select('*')
        .eq('id', createDto.billing_address_id)
        .eq('buyer_org_id', buyerOrgId)
        .single();

      if (!billing) {
        throw new NotFoundException('Billing address not found');
      }
      billingAddress = billing;
    }

    // Validate products and calculate totals
    const orderItems: any[] = [];
    let subtotal = 0;
    const sellerGroups = new Map<string, any[]>();

    for (const item of createDto.items) {
      this.logger.debug(
        `Validating product ${item.product_id} quantity=${item.quantity}`,
      );
      const { data: product } = await this.supabase
        .getClient()
        .from('products')
        .select(
          `
          *,
          product_images(image_url, is_primary, display_order)
        `,
        )
        .eq('id', item.product_id)
        .eq('status', 'active')
        .single();

      if (!product) {
        throw new NotFoundException(`Product ${item.product_id} not found`);
      }

      // Prevent checkout against hidden (or inactive) sellers
      {
        const sellerOrgId = product.seller_org_id as string;
        const { hidden, status } =
          await this.isSellerHiddenFromMarketplace(sellerOrgId);
        if (hidden || status !== 'active') {
          throw new NotFoundException(`Product ${item.product_id} not found`);
        }
      }

      if (product.stock_quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}`,
        );
      }

      const unitPrice = product.sale_price || product.base_price;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        product_id: item.product_id,
        product_name: product.name,
        product_sku: product.sku,
        unit_price: unitPrice,
        quantity: item.quantity,
        total_price: totalPrice,
        product_snapshot: product,
      });

      // Group by seller for separate orders
      if (!sellerGroups.has(product.seller_org_id)) {
        sellerGroups.set(product.seller_org_id, []);
      }
      sellerGroups.get(product.seller_org_id)?.push({
        ...orderItems[orderItems.length - 1],
        seller_org_id: product.seller_org_id,
      });
    }

    // Create separate orders for each seller
    const createdOrders: any[] = [];

    const feesConfig = await this.getPlatformFeesConfig();
    const configuredBuyerShare = Number(feesConfig.buyerDeliveryShare ?? 0);
    const configuredSellerShare = Number(feesConfig.sellerDeliveryShare ?? 0);
    const configuredFlatDelivery = Number(feesConfig.deliveryFlatFee ?? 0);
    const totalDeliveryFee =
      configuredBuyerShare + configuredSellerShare || configuredFlatDelivery;
    const buyerDeliveryForOrder = configuredBuyerShare
      ? Number(configuredBuyerShare.toFixed(2))
      : Number((totalDeliveryFee / 2).toFixed(2));

    for (const [sellerOrgId, items] of sellerGroups) {
      this.logger.log(
        `Creating order for seller ${sellerOrgId} with ${items.length} item(s)`,
      );
      const orderSubtotal = items.reduce(
        (sum, item) => sum + item.total_price,
        0,
      );
      // Buyer-facing delivery fee should come from platform fees config (buyer_delivery_share).
      // Note: This is per-seller order (the cart is split into multiple orders by seller).
      const shippingAmount = buyerDeliveryForOrder;
      const taxAmount = orderSubtotal * 0.08; // TODO: Calculate actual tax
      const totalAmount = orderSubtotal + shippingAmount + taxAmount;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const { data: order, error } = await this.supabase
        .getClient()
        .from('orders')
        .insert({
          order_number: orderNumber,
          buyer_org_id: buyerOrgId,
          seller_org_id: sellerOrgId,
          buyer_user_id: buyerUserId,
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'offline',
          subtotal: orderSubtotal,
          tax_amount: taxAmount,
          shipping_amount: shippingAmount,
          discount_amount: 0,
          total_amount: totalAmount,
          currency: 'XCD',
          shipping_address: shippingAddress,
          billing_address: billingAddress,
          buyer_notes: createDto.buyer_notes,
          estimated_delivery_date: createDto.preferred_delivery_date,
        })
        .select()
        .single();

      if (error)
        throw new BadRequestException(
          `Failed to create order: ${error.message}`,
        );

      // Create order items
      for (const item of items) {
        this.logger.debug(
          `Inserting order_item product=${item.product_id} qty=${item.quantity} unit=${item.unit_price}`,
        );
        const { error: itemError } = await this.supabase
          .getClient()
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            unit_price: item.unit_price,
            quantity: item.quantity,
            total_price: item.total_price,
            product_snapshot: item.product_snapshot,
          });

        if (itemError)
          throw new BadRequestException(
            `Failed to create order item: ${itemError.message}`,
          );

        // Update product stock
        this.logger.debug(
          `Updating stock for product ${item.product_id} -${item.quantity}`,
        );
        await this.supabase
          .getClient()
          .from('products')
          .update({
            stock_quantity:
              item.product_snapshot.stock_quantity - item.quantity,
          })
          .eq('id', item.product_id);
      }

      // Create order timeline entry
      this.logger.debug(`Creating order timeline entry for order ${order.id}`);
      await this.supabase
        .getClient()
        .from('order_timeline')
        .insert({
          order_id: order.id,
          event_type: 'order_created',
          description: 'Order created from cart',
          metadata: { items_count: items.length },
          created_by: buyerUserId,
        });

      // Auto-create conversation for this order
      try {
        this.logger.debug(`Auto-creating conversation for order ${order.id}`);
        await this.conversationsService.createOrGetConversation({
          type: 'contextual',
          contextType: 'order',
          contextId: order.id,
          currentUserId: buyerUserId,
          currentOrgId: buyerOrgId,
          otherUserId: undefined, // We don't have seller user ID, just org
          title: `Order ${orderNumber}`,
        });
      } catch (convError) {
        // Log but don't fail the order creation
        console.error('Failed to create conversation for order:', convError);
      }

      // Emit in-app notification asking seller to accept the order
      try {
        const client = this.supabase.getClient();
        const { data: sellerUsers } = await client
          .from('organization_users')
          .select('user_id')
          .eq('organization_id', sellerOrgId);
        const recipients = (sellerUsers || []).map((r: any) => r.user_id);
        if (recipients.length) {
          this.logger.log(
            `Emitting order_created notification to ${recipients.length} user(s) for seller_org=${sellerOrgId}`,
          );
          await this.notifications.emitEvent({
            eventType: 'order_created',
            organizationId: sellerOrgId,
            payload: {
              title: `New order received`,
              body: `You have a new order ${orderNumber}. Review the order details, accept the order, then prepare and pack the items for shipment.`,
              order_id: order.id,
              order_number: orderNumber,
              recipients,
              category: 'orders',
              priority: 'high',
              cta_url:
                (this.config.get<string>('frontend.url') ||
                  process.env.FRONTEND_URL ||
                  'http://localhost:3001') + `/seller/orders/${order.id}`,
            },
          });
        }
      } catch (notifyErr) {
        this.logger.error(
          `Failed to emit order_created notification: ${String(
            (notifyErr as any)?.message || notifyErr,
          )}`,
        );
      }

      // Notify the specific seller via WhatsApp if they are paired (signed up using WhatsApp)
      try {
        const client = this.supabase.getClient();
        // Deep link to manage this order
        const frontend =
          this.config.get<string>('frontend.url') ||
          process.env.FRONTEND_URL ||
          'http://localhost:3001';
        const manageUrl = `${frontend}/seller/orders/${order.id}`;

        // Prefer product creator as the target seller user
        const creatorId =
          (items.find((it: any) => it?.product_snapshot?.created_by)
            ?.product_snapshot?.created_by as string | undefined) || undefined;

        let targetSellerUserId: string | null = creatorId ?? null;

        // Fallback to an org member (e.g., earliest joined) if creator not available
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
            .select('id, fullname, phone_number')
            .eq('id', targetSellerUserId)
            .not('phone_number', 'is', null)
            .single();

          if (sellerUser?.phone_number) {
            const orderNum = String(order.order_number || order.id);
            const buyerName =
              (shippingAddress as any)?.name ||
              (billingAddress as any)?.name ||
              'Buyer';
            const currency = String(order.currency || 'USD');
            const totalAmt = Number(order.total_amount || 0);

            const to = String(sellerUser.phone_number).replace(/^\+/, '');
            const firstItem = items[0];
            const unit =
              (firstItem?.product_snapshot as any)?.unit_of_measurement || '';
            const qty = firstItem?.quantity ?? 0;
            const productName = firstItem?.product_name || 'items';
            const summary =
              qty && unit
                ? `${qty} ${unit} of ${productName} for ${currency} ${totalAmt.toFixed(
                    2,
                  )}`
                : `${items.length} item(s) for ${currency} ${totalAmt.toFixed(2)}`;
            await this.waTemplates.sendNewOrderToSeller(
              to,
              orderNum,
              buyerName,
              totalAmt,
              currency,
              manageUrl,
              'en',
            );
            // Send interactive Accept/Reject buttons
            await this.waTemplates.sendOrderAcceptButtons(
              String(sellerUser.phone_number),
              String(order.id),
              summary,
            );
          }
        }
      } catch (waErr) {
        // Do not block order creation on WhatsApp issues
        console.warn('WA notify seller (new order) failed:', waErr);
      }

      // Notify seller users via Email (all available emails in the seller organization)
      try {
        const client = this.supabase.getClient();
        const frontend =
          this.config.get<string>('frontend.url') ||
          process.env.FRONTEND_URL ||
          'http://localhost:3001';
        const manageUrl = `${frontend}/seller/orders/${order.id}`;
        const orderNum = String(order.order_number || order.id);
        const currency = String(order.currency || 'USD');
        const totalAmt = Number(order.total_amount || 0);
        const buyerName =
          (shippingAddress as any)?.contact_name ||
          (shippingAddress as any)?.name ||
          (billingAddress as any)?.contact_name ||
          (billingAddress as any)?.name ||
          'Buyer';

        // Fetch all members of the seller organization
        const { data: orgUsers } = await client
          .from('organization_users')
          .select('user_id')
          .eq('organization_id', sellerOrgId);
        const userIds = (orgUsers || []).map((ou: any) => ou.user_id);
        if (userIds.length > 0) {
          const { data: users } = await client
            .from('users')
            .select('id, email, fullname')
            .in('id', userIds);
          const recipients =
            (users || [])
              .filter((u: any) => !!u.email)
              .map((u: any) => ({
                email: u.email as string,
                name: u.fullname as string,
              })) || [];

          if (recipients.length > 0) {
            const subject = `New order ${orderNum} received`;
            const link = manageUrl;
            const html = `
                <h2>New order received</h2>
                <p>You have a new order <strong>${orderNum}</strong> from <strong>${buyerName}</strong>.</p>
                <p>Total: <strong>${currency} ${totalAmt.toFixed(2)}</strong></p>
                <p style="margin-top: 16px;">
                  <a href="${link}" class="button">Review and manage this order</a>
                </p>
            `;
            const text = `You have a new order ${orderNum} from ${buyerName}.
Total: ${currency} ${totalAmt.toFixed(2)}
Manage this order: ${link}`;

            // Send to each recipient (non-blocking failures)
            await Promise.all(
              recipients.map((r) =>
                this.emailService.sendBrandedEmail(
                  r.email,
                  subject,
                  `New order ${orderNum} received`,
                  html,
                  text,
                ),
              ),
            );
          }
        }
      } catch (emailErr) {
        // Do not block order creation on email issues
        console.warn('Email notify seller (new order) failed:', emailErr);
      }

      createdOrders.push(order);
    }

    // Clear cart after successful order creation
    this.logger.log(
      `Clearing cart for buyer_org=${buyerOrgId} buyer_user=${buyerUserId}`,
    );
    await this.clearCart(buyerOrgId, buyerUserId);

    // Return the first order (or combine if needed)
    const firstOrder = createdOrders[0];
    const firstOrderItems = sellerGroups.get(firstOrder.seller_org_id) || [];

    // Email receipt to buyer (non-card path)
    try {
      const { data: buyer } = await this.supabase
        .getClient()
        .from('users')
        .select('email, fullname')
        .eq('id', buyerUserId)
        .single();

      if (buyer?.email) {
        const frontendUrl =
          this.config.get<string>('frontend.url') ||
          process.env.FRONTEND_URL ||
          'http://localhost:3001';
        const link = `${frontendUrl}/buyer/order-confirmation/${firstOrder.id}`;
        const html = `
            <h2>Thanks for your order</h2>
            <p>Thanks for your order on Procur.</p>
            <p>You can view your full order receipt and track updates here:</p>
            <p style="margin-top: 16px;">
              <a href="${link}" class="button">View order receipt</a>
            </p>
        `;
        await this.emailService.sendBrandedEmail(
          buyer.email,
          'Your order receipt',
          'Your order receipt',
          html,
          `Thanks for your order! View your receipt: ${link}`,
        );
      }
    } catch (emailErr) {
      this.logger.warn(
        `Buyer receipt email failed for order ${firstOrder?.id}: ${String(
          (emailErr as any)?.message || emailErr,
        )}`,
      );
    }

    this.logger.log(
      `createOrder complete. first_order=${firstOrder?.id} items=${firstOrderItems?.length || 0}`,
    );
    return this.transformOrderToResponse(firstOrder, firstOrderItems);
  }

  async getOrders(
    buyerOrgId: string,
    query: BuyerOrderQueryDto,
  ): Promise<{
    orders: BuyerOrderResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      seller_id,
      start_date,
      end_date,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;
    const offset = (page - 1) * limit;

    const client = this.supabase.getClient();

    let queryBuilder = client
      .from('orders')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(name),
        order_items(*)
      `,
        { count: 'exact' },
      )
      .eq('buyer_org_id', buyerOrgId);

    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (seller_id) queryBuilder = queryBuilder.eq('seller_org_id', seller_id);
    if (start_date) queryBuilder = queryBuilder.gte('created_at', start_date);
    if (end_date) queryBuilder = queryBuilder.lte('created_at', end_date);
    if (search) {
      queryBuilder = queryBuilder.or(
        `order_number.ilike.%${search}%,buyer_notes.ilike.%${search}%`,
      );
    }

    queryBuilder = queryBuilder
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(`Failed to fetch orders: ${error.message}`);
    }

    const orderList = orders || [];
    const orderIds = orderList.map((o: any) => o?.id).filter(Boolean);
    const sellerOrgIdByOrderId = new Map<string, string>();
    for (const o of orderList) {
      if (o?.id && o?.seller_org_id) {
        sellerOrgIdByOrderId.set(o.id, o.seller_org_id);
      }
    }

    // Load order items in a single query (more reliable than embedded relationships)
    const itemsByOrderId = new Map<string, any[]>();

    if (orderIds.length > 0) {
      const { data: items, error: itemsError } = await client
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) {
        throw new BadRequestException(
          `Failed to load order items: ${itemsError.message}`,
        );
      }

      for (const item of items || []) {
        const oid = (item as any).order_id as string | undefined;
        if (!oid) continue;
        const arr = itemsByOrderId.get(oid) || [];
        arr.push(item);
        itemsByOrderId.set(oid, arr);
      }

      // Fallback for offline/payment-link orders that store line items in payment_links.meta
      const { data: links, error: linksError } = await client
        .from('payment_links')
        .select('order_id, meta')
        .in('order_id', orderIds);

      if (linksError) {
        throw new BadRequestException(
          `Failed to load payment links for orders: ${linksError.message}`,
        );
      }

      for (const link of links || []) {
        const oid = (link as any).order_id as string | undefined;
        if (!oid) continue;
        const existing = itemsByOrderId.get(oid) || [];
        if (existing.length > 0) continue;

        const meta = (link as any)?.meta as any;
        const fromMeta = this.mapPaymentLinkMetaToOrderItems(meta);
        if (fromMeta.length > 0) {
          itemsByOrderId.set(oid, fromMeta);
        }
      }
    }

    // Best-effort: hydrate images for items (works for both normal + offline orders)
    await this.hydrateOrderItemsImagesForOrders(
      client,
      sellerOrgIdByOrderId,
      itemsByOrderId,
    );

    const transformedOrders: BuyerOrderResponseDto[] = await Promise.all(
      orderList.map(async (order: any) => {
        const explicit = itemsByOrderId.get(order.id) || [];
        const embedded = Array.isArray(order.order_items) ? order.order_items : [];
        const finalItems = explicit.length > 0 ? explicit : embedded;
        return this.transformOrderToResponse(order, finalItems);
      }),
    );

    return {
      orders: transformedOrders,
      total: count || 0,
      page,
      limit,
    };
  }

  async getOrderById(
    buyerOrgId: string,
    orderId: string,
  ): Promise<BuyerOrderResponseDto> {
    const client = this.supabase.getClient();

    const { data: order, error } = await client
      .from('orders')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(name),
        order_timeline(*)
      `,
      )
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (error || !order) {
      throw new NotFoundException('Order not found');
    }

    // If shipping address is only an id placeholder, hydrate it from buyer_addresses
    if (
      order.shipping_address &&
      typeof order.shipping_address === 'object' &&
      order.shipping_address.id &&
      !order.shipping_address.city &&
      !order.shipping_address.street_address &&
      !order.shipping_address.address_line1
    ) {
      const { data: addr } = await this.supabase
        .getClient()
        .from('buyer_addresses')
        .select('*')
        .eq('id', order.shipping_address.id)
        .single();
      if (addr) {
        order.shipping_address = addr;
      }
    }

    // Load order items explicitly rather than relying on embedded relationships.
    // In some environments, embedded `order_items(*)` may return [] due to missing
    // relationship metadata or RLS behavior on the embedded resource.
    const { data: orderItemsData, error: itemsError } = await client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      throw new BadRequestException(
        `Failed to load order items: ${itemsError.message}`,
      );
    }

    let orderItems = Array.isArray(orderItemsData) ? orderItemsData : [];

    // Fallback: some offline/payment-link flows store line items in payment_links.meta
    // and may not have `order_items` rows (or they may fail to insert).
    if (orderItems.length === 0) {
      const { data: link } = await client
        .from('payment_links')
        .select('meta')
        .eq('order_id', orderId)
        .maybeSingle();

      const meta = (link as any)?.meta as any;
      const fromMeta = this.mapPaymentLinkMetaToOrderItems(meta);
      if (fromMeta.length > 0) {
        orderItems = fromMeta;
      }
    }

    // Best-effort: hydrate images for items on the detail page as well
    orderItems = await this.hydrateOrderItemsImagesForSingleOrder(
      client,
      order?.seller_org_id,
      orderItems,
    );
    return this.transformOrderToResponse(order, orderItems);
  }

  /**
   * Some offline flows store line items in payment_links.meta rather than in order_items.
   * This helper normalizes that shape into an order_items-like array.
   */
  private mapPaymentLinkMetaToOrderItems(meta: any): any[] {
    const metaLineItems = Array.isArray(meta?.line_items) ? meta.line_items : [];
    const metaLineItem = meta?.line_item as any | undefined;

    const itemsForDisplay =
      metaLineItems.length > 0 ? metaLineItems : metaLineItem ? [metaLineItem] : [];

    if (!itemsForDisplay.length) return [];

    return itemsForDisplay.map((li: any, idx: number) => ({
      id: li.id || `offline-line-item-${idx}`,
      product_id: li.product_id || null,
      product_name: li.product_name || li.name || 'Item',
      product_sku: li.product_sku || null,
      quantity: Number(li.quantity || 0),
      unit_price: Number(li.unit_price || li.price || 0),
      total_price:
        li.total_price != null
          ? Number(li.total_price)
          : Number(li.unit_price || li.price || 0) * Number(li.quantity || 0),
      product_snapshot:
        li.unit != null
          ? { unit_of_measurement: li.unit }
          : (li.product_snapshot ?? null),
    }));
  }

  private async hydrateOrderItemsImagesForSingleOrder(
    client: any,
    sellerOrgId: string | undefined,
    orderItems: any[],
  ): Promise<any[]> {
    const items = Array.isArray(orderItems) ? orderItems : [];
    if (items.length === 0) return items;

    const map = new Map<string, any[]>();
    // Use a synthetic order id bucket for reuse of the batch hydrator
    map.set('__single__', items);
    const sellerMap = new Map<string, string>();
    if (sellerOrgId) sellerMap.set('__single__', sellerOrgId);
    await this.hydrateOrderItemsImagesForOrders(client, sellerMap, map);
    return map.get('__single__') || items;
  }

  /**
   * Attach product thumbnail URLs to order items when:
   * - the item references a real product_id, or
   * - older offline/meta-only items can be matched by name to a seller product.
   *
   * This is best-effort; it never throws.
   */
  private async hydrateOrderItemsImagesForOrders(
    client: any,
    sellerOrgIdByOrderId: Map<string, string>,
    itemsByOrderId: Map<string, any[]>,
  ): Promise<void> {
    try {
      const allItems: { orderId: string; item: any }[] = [];
      for (const [orderId, items] of itemsByOrderId.entries()) {
        for (const item of items || []) {
          allItems.push({ orderId, item });
        }
      }
      if (allItems.length === 0) return;

      // Helper to check if we already have an image
      const hasImage = (it: any) =>
        Boolean(
          it?.product_image ||
            it?.image_url ||
            it?.product_snapshot?.image_url ||
            (it?.product_snapshot?.product_images || []).find?.(
              (img: any) => img?.is_primary && img?.image_url,
            )?.image_url,
        );

      // 1) First: fill from product_snapshot if present (no DB calls)
      for (const { item } of allItems) {
        if (hasImage(item)) continue;
        const snap = item?.product_snapshot;
        const primaryFromSnapshot = (snap?.product_images || []).find?.(
          (img: any) => img?.is_primary,
        )?.image_url;
        if (primaryFromSnapshot) {
          item.product_snapshot = { ...(snap || {}), image_url: primaryFromSnapshot };
        }
      }

      // 2) Next: fetch primary images for real product_id references
      const productIds = Array.from(
        new Set(
          allItems
            .map(({ item }) => item?.product_id)
            .filter((id) => typeof id === 'string' && id.length > 0),
        ),
      );

      const urlByProductId = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: images, error } = await client
          .from('product_images')
          .select('product_id, image_url, is_primary')
          .in('product_id', productIds)
          .eq('is_primary', true);

        if (!error) {
          for (const row of images || []) {
            const pid = (row as any).product_id as string | undefined;
            const url = (row as any).image_url as string | undefined;
            if (pid && url && !urlByProductId.has(pid)) urlByProductId.set(pid, url);
          }
        } else {
          this.logger.warn(`Failed to hydrate product images: ${error.message}`);
        }
      }

      for (const { item } of allItems) {
        if (hasImage(item)) continue;
        const pid = item?.product_id as string | undefined;
        if (!pid) continue;
        const url = urlByProductId.get(pid);
        if (!url) continue;
        const snap = item?.product_snapshot || {};
        item.product_snapshot = { ...snap, image_url: url };
      }

      // 3) Finally: older offline/meta-only items with no product_id.
      // Best-effort match by exact name within seller org, then fetch image.
      const needNameMatch = allItems.filter(
        ({ orderId, item }) =>
          !hasImage(item) &&
          !item?.product_id &&
          typeof item?.product_name === 'string' &&
          item.product_name.trim().length > 0 &&
          sellerOrgIdByOrderId.has(orderId),
      );

      if (needNameMatch.length === 0) return;

      const sellerIds = Array.from(
        new Set(
          needNameMatch
            .map(({ orderId }) => sellerOrgIdByOrderId.get(orderId))
            .filter(Boolean) as string[],
        ),
      );

      // For each seller, fetch a bounded catalog slice and map by normalized name.
      const matchedProductIds: string[] = [];
      for (const sellerOrgId of sellerIds) {
        const { data: products, error } = await client
          .from('products')
          .select('id, name')
          .eq('seller_org_id', sellerOrgId)
          .limit(500);
        if (error) continue;

        const byName = new Map<string, string>();
        for (const p of products || []) {
          const name = String((p as any).name || '').trim().toLowerCase();
          const id = (p as any).id as string | undefined;
          if (name && id && !byName.has(name)) byName.set(name, id);
        }

        for (const { orderId, item } of needNameMatch) {
          if (sellerOrgIdByOrderId.get(orderId) !== sellerOrgId) continue;
          const key = String(item.product_name || '').trim().toLowerCase();
          const pid = byName.get(key);
          if (pid) {
            matchedProductIds.push(pid);
            // don't set product_id (avoid mutating meaning), just keep for image hydration
            item.__matched_product_id = pid;
          }
        }
      }

      const uniqueMatched = Array.from(new Set(matchedProductIds));
      if (uniqueMatched.length > 0) {
        const { data: images } = await client
          .from('product_images')
          .select('product_id, image_url, is_primary')
          .in('product_id', uniqueMatched)
          .eq('is_primary', true);

        const urlByMatched = new Map<string, string>();
        for (const row of images || []) {
          const pid = (row as any).product_id as string | undefined;
          const url = (row as any).image_url as string | undefined;
          if (pid && url && !urlByMatched.has(pid)) urlByMatched.set(pid, url);
        }

        for (const { item } of needNameMatch) {
          if (hasImage(item)) continue;
          const pid = item.__matched_product_id as string | undefined;
          if (!pid) continue;
          const url = urlByMatched.get(pid);
          if (!url) continue;
          const snap = item?.product_snapshot || {};
          item.product_snapshot = { ...snap, image_url: url };
        }
      }

      // Clean up internal field
      for (const { item } of allItems) {
        if (item && '__matched_product_id' in item) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete item.__matched_product_id;
        }
      }
    } catch (e) {
      this.logger.warn(
        `hydrateOrderItemsImagesForOrders failed: ${String((e as any)?.message || e)}`,
      );
    }
  }

  async generateOrderInvoicePdf(
    buyerOrgId: string,
    orderId: string,
    options?: {
      /**
       * Allows callers (e.g. seller invoice download) to explicitly set the
       * buyer company name shown under "BILLED TO" rather than relying on a lookup.
       */
      billedToCompanyName?: string;
      /**
       * Allows callers (e.g. seller receipts) to override the delivery fee line
       * amount used in totals calculations.
       */
      deliveryFeeAmountOverride?: number;
      /**
       * Controls totals rendering. "buyer" keeps existing invoice math.
       * "seller" renders a seller-facing payout view:
       *  - Subtotal
       *  - Minus delivery fee (seller share from admin config)
       *  - No platform fee line
       *  - "Amount received" label
       */
      totalsMode?: 'buyer' | 'seller';
    },
  ): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const order = await this.getOrderById(buyerOrgId, orderId);

    // Resolve buyer company name (used in "BILLED TO") BEFORE entering the PDF render Promise.
    // The PDF rendering path must stay synchronous (no `await` inside the Promise executor).
    let resolvedBuyerCompanyName = (options?.billedToCompanyName || '').trim();
    try {
      if (!resolvedBuyerCompanyName) {
        const client = this.supabase.getClient();
        const { data: buyerOrg } = await client
          .from('organizations')
          .select('name, business_name')
          .eq('id', buyerOrgId)
          .single();
        resolvedBuyerCompanyName =
          (buyerOrg as any)?.business_name || (buyerOrg as any)?.name || '';
      }
    } catch {
      // Non-fatal: fall back to shipping/company fields in the renderer
    }

    // Dynamically require pdfkit to avoid ESM/CJS interop issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    // The PDF is our single source of truth for invoice formatting.
    // Keep this in sync with the "ClassicInvoice" concept in the UI.
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    const invoiceNumber =
      (order as any).invoice_number || order.order_number || order.id;

    return await new Promise<{ buffer: Buffer; invoiceNumber: string }>(
      (resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({ buffer: Buffer.concat(chunks), invoiceNumber }),
      );
      doc.on('error', (err) => reject(err));

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const pageWidth = pageRight - pageLeft;

      // Match procur-ui ClassicInvoice palette (see CSS vars in procur-ui/src/app/globals.css)
      const colors = {
        pageBg: '#F2EFE6', // --primary-background
        text: '#000809', // --secondary-black
        muted: '#6C715D', // --primary-base
        accent: '#CB5927', // --primary-accent2
        softHighlight: '#C0D1C7', // --secondary-soft-highlight
        border: '#E5E7EB', // close to ClassicInvoice borders
        bg: '#FFFFFF',
        soft: '#F2EFE6', // use primary background for soft bands
        footerBg: '#FAFAFA',
      };

      // Paint page background like the UI (ClassicInvoice sits on --primary-background)
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.pageBg);
      doc.restore();

      const currencyCode = order.currency || 'USD';
      const formatCurrency = (value: number) =>
        `${currencyCode} ${Number(value || 0).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

      const formatDate = (raw?: string | null, locale: 'en-GB' | 'en-US' = 'en-GB') => {
        if (!raw) return '';
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return '';
        // Match UI ClassicInvoice: en-GB "03 Dec 2025"
        return d.toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      const issueDate = formatDate(order.created_at, 'en-GB');
      const dueDate = order.estimated_delivery_date
        ? formatDate(order.estimated_delivery_date as any, 'en-GB')
        : '';

      // --- Brand header (like ClassicInvoice BrandHeader) ---
      const brandHeaderH = 52;
      const brandHeaderY = doc.y;
      doc
        .roundedRect(pageLeft, doc.y, pageWidth, brandHeaderH, 12)
        .lineWidth(1)
        .strokeColor(colors.border)
        .fillColor(colors.bg)
        .fillAndStroke();
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require('path');
        const tryRenderSvgLogo = (svgSource: string) => {
          // Very small, purpose-built SVG renderer for our logo:
          // - Supports <svg viewBox> + <path d fill>
          // - Renders paths using PDFKit's SVG path parser
          const viewBoxMatch = svgSource.match(/viewBox="([^"]+)"/i);
          const viewBox = viewBoxMatch?.[1]
            ? viewBoxMatch[1].trim().split(/\s+/).map(Number)
            : [0, 0, 368, 96];
          const vbW = Number(viewBox[2] || 368);
          const vbH = Number(viewBox[3] || 96);

          const targetW = 170;
          const targetH = 30;
          const scale = Math.min(targetW / vbW, targetH / vbH);
          const drawW = vbW * scale;
          const drawH = vbH * scale;
          const x = pageLeft + (pageWidth - drawW) / 2;
          const y = brandHeaderY + (brandHeaderH - drawH) / 2;

          // Extract path tags
          const pathRegex = /<path\b[^>]*\sd="([^"]+)"[^>]*>/gi;
          let match: RegExpExecArray | null;
          doc.save();
          doc.translate(x, y);
          doc.scale(scale);
          // normalize to viewBox origin if any
          doc.translate(-Number(viewBox[0] || 0), -Number(viewBox[1] || 0));
          while ((match = pathRegex.exec(svgSource))) {
            const d = match[1];
            doc.path(d).fill(colors.text);
          }
          doc.restore();
        };
        const candidates = [
          // monorepo dev (prefer SVG so logo is black)
          path.resolve(
            process.cwd(),
            '../procur-ui/public/images/logos/procur-logo.svg',
          ),
          path.resolve(
            process.cwd(),
            '../procur-ui/public/images/logos/procur_logo.png',
          ),
          path.resolve(
            process.cwd(),
            '../procur-ui/public/images/logos/procur-logo.png',
          ),
          // if assets are copied into api at runtime
          path.resolve(process.cwd(), 'public/images/logos/procur-logo.svg'),
          path.resolve(process.cwd(), 'public/images/logos/procur_logo.png'),
          path.resolve(process.cwd(), 'public/images/logos/procur-logo.png'),
        ];
        const logoPath = candidates.find((p) => fs.existsSync(p));
        if (logoPath) {
          if (String(logoPath).toLowerCase().endsWith('.svg')) {
            const svg = fs.readFileSync(logoPath, 'utf8');
            tryRenderSvgLogo(svg);
          } else {
            const logoBoxW = 160;
            const logoBoxH = 28;
            const logoX = pageLeft + (pageWidth - logoBoxW) / 2;
            const logoY = brandHeaderY + (brandHeaderH - logoBoxH) / 2;
            doc.image(logoPath, logoX, logoY, {
              fit: [logoBoxW, logoBoxH],
              align: 'center',
              valign: 'center',
            });
          }
        } else {
          // Fallback: text (should not happen in monorepo dev)
          doc
            .fillColor(colors.text)
            .font('Helvetica-Bold')
            .fontSize(18)
            .text('Procur', pageLeft, brandHeaderY + 16, {
              width: pageWidth,
              align: 'center',
            });
        }
      } catch {
        // ignore; keep PDF generation resilient
      }
      // Move cursor below header with consistent spacing
      doc.y = brandHeaderY + brandHeaderH + 24;

      // --- Main card container (like ClassicInvoice main box) ---
      const cardX = pageLeft;
      const cardY = doc.y + 8;
      const cardW = pageWidth;
      // Target: keep invoices to ONE page for normal orders.
      // We'll keep the card compact; if there are many items, we can paginate later.
      const cardH = 570;
      doc
        .roundedRect(cardX, cardY, cardW, cardH, 24)
        .lineWidth(1)
        .strokeColor(colors.border)
        .fillColor(colors.bg)
        .fillAndStroke();

      // Top meta row
      const topPad = 26;
      const leftColX = cardX + topPad;
      const rightColW = 220;
      const rightColX = cardX + cardW - topPad - rightColW;
      const metaTopY = cardY + topPad;

      // Top-left labels: keep clean (user requested removing "Procur marketplace" label)
      doc
        .fillColor(colors.text)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Invoice', leftColX, metaTopY + 6);
      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(10)
        .text('Official summary of your order on Procur.', leftColX, metaTopY + 30);

      // Top-right label: remove "Payment ..." chip per request (invoice still includes totals)
      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(`Invoice`, rightColX, metaTopY + 18, { width: rightColW, align: 'right' })
        .fillColor(colors.text)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`${invoiceNumber}`, rightColX, metaTopY + 30, {
          width: rightColW,
          align: 'right',
        });
      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(`Issued`, rightColX, metaTopY + 48, { width: rightColW, align: 'right' })
        .fillColor(colors.text)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(issueDate || '', rightColX, metaTopY + 60, {
          width: rightColW,
          align: 'right',
        });
      if (dueDate) {
        doc
          .fillColor(colors.muted)
          .font('Helvetica')
          .fontSize(9)
          .text(`Due`, rightColX, metaTopY + 78, {
            width: rightColW,
            align: 'right',
          })
          .fillColor(colors.text)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(dueDate, rightColX, metaTopY + 90, {
            width: rightColW,
            align: 'right',
          });
      }

      // Divider under meta
      const dividerY = metaTopY + 112;
      doc
        .moveTo(cardX + topPad, dividerY)
        .lineTo(cardX + cardW - topPad, dividerY)
        .strokeColor('#F1F5F9')
        .lineWidth(1)
        .stroke();

      // Parties section
      const partiesTopY = dividerY + 18;
      const colGap = 28;
      const partiesColW = (cardW - topPad * 2 - colGap) / 2;
      const billedX = cardX + topPad;
      const refX = billedX + partiesColW + colGap;

      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(9)
        .text('BILLED TO', billedX, partiesTopY, { width: partiesColW });

      const shipping = order.shipping_address as any;
      // Include company/organization name (not just address), then contact person (Attn) if available.
      // Buyer org name is the most reliable source of truth for "Billed To".
      const buyerCompanyName = resolvedBuyerCompanyName;

      const buyerContactName =
        shipping?.contact_name ||
        (buyerCompanyName ? shipping?.name : shipping?.name || '') ||
        (order as any)?.buyer_name ||
        '';

      const buyerName =
        buyerCompanyName ||
        shipping?.company ||
        shipping?.organization_name ||
        shipping?.name ||
        shipping?.contact_name ||
        (order as any)?.buyer_name ||
        '';
      const buyerContact =
        buyerCompanyName && buyerContactName && buyerContactName !== buyerName
          ? buyerContactName
          : shipping?.contact_name && shipping?.name
            ? shipping?.contact_name
            : '';
      const buyerAddr1 =
        shipping?.address_line1 ||
        shipping?.street_address ||
        shipping?.line1 ||
        '';
      const buyerAddr2 = shipping?.address_line2 || shipping?.line2 || '';
      const buyerCityLine = [shipping?.city, shipping?.state, shipping?.postal_code]
        .filter(Boolean)
        .join(' ');
      const buyerCountry = shipping?.country || '';

      let billedY = partiesTopY + 14;
      doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(11).text(buyerName, billedX, billedY, {
        width: partiesColW,
      });
      billedY += 14;
      if (buyerContact) {
        doc.fillColor(colors.muted).font('Helvetica').fontSize(10).text(`Attn: ${buyerContact}`, billedX, billedY, {
          width: partiesColW,
        });
        billedY += 13;
      }
      [buyerAddr1, buyerAddr2, buyerCityLine, buyerCountry]
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
        .forEach((line) => {
          doc.fillColor(colors.muted).font('Helvetica').fontSize(10).text(line, billedX, billedY, {
            width: partiesColW,
          });
          billedY += 13;
        });

      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(9)
        .text('ORDER REFERENCE', refX, partiesTopY, { width: partiesColW });
      const refLines: string[] = [`Order: ${order.order_number}`];
      if (order.estimated_delivery_date) {
        const eta = formatDate(order.estimated_delivery_date as any, 'en-GB');
        if (eta) refLines.push(`Estimated delivery: ${eta}`);
      }
      let refY = partiesTopY + 14;
      refLines.forEach((line) => {
        doc.fillColor(colors.muted).font('Helvetica').fontSize(10).text(line, refX, refY, {
          width: partiesColW,
        });
        refY += 13;
      });

      // Line items "table" (classic style)
      const tableBoxY = partiesTopY + 96;
      const tableX = cardX + topPad;
      const tableW = cardW - topPad * 2;
      const tableH = 210;
      doc
        .roundedRect(tableX, tableBoxY, tableW, tableH, 16)
        .lineWidth(1)
        .strokeColor('#F3F4F6')
        .fillColor(colors.bg)
        .fillAndStroke();

      // Table header band
      doc
        .rect(tableX, tableBoxY, tableW, 26)
        .fillColor(colors.soft)
        .fill();

      // Compute columns relative to available width so we never overflow A4.
      const tablePadX = 12;
      const contentX = tableX + tablePadX;
      const contentW = tableW - tablePadX * 2;

      // Classic invoice columns: Item | Details | Qty | Unit price | Line total
      const itemW = Math.floor(contentW * 0.36);
      const detailsW = Math.floor(contentW * 0.30);
      const qtyW = Math.floor(contentW * 0.10);
      const unitPriceW = Math.floor(contentW * 0.12);
      const lineTotalW = contentW - itemW - detailsW - qtyW - unitPriceW;

      const colItemX = contentX;
      const colDetailsX = colItemX + itemW;
      const colQtyX = colDetailsX + detailsW;
      const colUnitPriceX = colQtyX + qtyW;
      const colTotalX = colUnitPriceX + unitPriceW;

      doc
        .fillColor(colors.muted)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Item', colItemX, tableBoxY + 8, { width: itemW - 6 })
        .text('Details', colDetailsX, tableBoxY + 8, { width: detailsW - 6 })
        .text('Qty', colQtyX, tableBoxY + 8, { width: qtyW, align: 'right' })
        .text('Unit price', colUnitPriceX, tableBoxY + 8, {
          width: unitPriceW,
          align: 'right',
        })
        .text('Line total', colTotalX, tableBoxY + 8, {
          width: lineTotalW,
          align: 'right',
        });

      // Rows
      const maxRows = 7;
      const rowStartY = tableBoxY + 34;
      const rowH = 24;
      const items = Array.isArray(order.items) ? order.items : [];
      const rows = items.slice(0, maxRows);

      let lineSubtotal = 0;
      rows.forEach((item, idx) => {
        const y = rowStartY + idx * rowH;
        const qty = Number((item as any).quantity || 0);
        const unitPrice = Number((item as any).unit_price || 0);
        const lineTotal = Number((item as any).total_price || qty * unitPrice);
        lineSubtotal += lineTotal;

        // zebra background like UI
        if (idx % 2 === 1) {
          doc
            .rect(tableX, y - 4, tableW, rowH)
            .fillColor('#F9FAFB')
            .fill();
        }

        const name = String((item as any).product_name || 'Item');
        const unit =
          String(
            (item as any).unit ||
              (item as any).unit_of_measurement ||
              (item as any)?.product_snapshot?.unit_of_measurement ||
              '',
          ) || '';
        const details = unit ? `Unit: ${unit}` : '';

        doc
          .fillColor(colors.text)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(name, colItemX, y, {
            width: itemW - 10,
            ellipsis: true,
          });
        doc
          .fillColor(colors.muted)
          .font('Helvetica')
          .fontSize(8)
          .text(details, colDetailsX, y, {
            width: detailsW - 10,
            ellipsis: true,
          });
        doc
          .fillColor(colors.text)
          .font('Helvetica')
          .fontSize(9)
          .text(qty.toLocaleString('en-US'), colQtyX, y, {
            width: qtyW,
            align: 'right',
          });
        doc
          .fillColor(colors.text)
          .font('Helvetica')
          .fontSize(9)
          .text(formatCurrency(unitPrice), colUnitPriceX, y, {
            width: unitPriceW,
            align: 'right',
          });
        doc
          .fillColor(colors.text)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(formatCurrency(lineTotal), colTotalX, y, {
            width: lineTotalW,
            align: 'right',
          });
      });

      // If there are more items than we rendered, add a subtle hint row.
      if (items.length > rows.length) {
        const remaining = items.length - rows.length;
        const y = rowStartY + rows.length * rowH;
        doc
          .fillColor(colors.muted)
          .font('Helvetica')
          .fontSize(9)
          .text(`+ ${remaining} more item${remaining === 1 ? '' : 's'}`, colItemX, y, {
            width: itemW + detailsW,
          });
      }

      // Totals & instructions (like ClassicInvoice)
      const totalsTopY = tableBoxY + tableH + 14;
      const instrX = cardX + topPad;
      const instrW = 280;
      const totalsX = cardX + cardW - topPad - 220;
      const totalsW = 220;

      doc
        .fillColor(colors.text)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Payment instructions', instrX, totalsTopY);
      const instructions = [
        'Payment is processed via Procur secure settlement.',
      ];
      let instrY = totalsTopY + 14;
      instructions.forEach((line) => {
        doc.fillColor(colors.muted).font('Helvetica').fontSize(9).text(`• ${line}`, instrX, instrY, {
          width: instrW,
        });
        instrY += 12;
      });

      const subtotalAmount = Number(
        (order as any)?.subtotal ?? order.subtotal ?? 0,
      );
      const delivery = Number((order as any)?.shipping_amount ?? 0);
      const discount = Number((order as any)?.discount_amount ?? 0);
      const taxAmount = Number((order as any)?.tax_amount ?? 0);
      const totalFromApi = Number((order as any)?.total_amount ?? 0);
      const explicitPlatformFee = Number(
        (order as any)?.platform_fee_amount ?? (order as any)?.platform_fee ?? 0,
      );
      // Correct platform fee:
      // - Use explicit platform fee if provided
      // - Otherwise derive from totals to avoid showing 0 when it was included
      const computedPlatformFee =
        totalFromApi - subtotalAmount - delivery - taxAmount + discount;
      const platformFee =
        explicitPlatformFee > 0
          ? explicitPlatformFee
          : Math.max(0, computedPlatformFee);
      const totalAmount =
        totalFromApi ||
        subtotalAmount + delivery + platformFee + taxAmount - discount;

      const totalRow = (
        label: string,
        value: string,
        y: number,
        bold = false,
        color?: string,
      ) => {
        doc
          .fillColor(color || colors.muted)
          .font('Helvetica')
          .fontSize(9)
          .text(label, totalsX, y, { width: totalsW / 2, align: 'left' });
        doc
          .fillColor(color ? color : colors.text)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 12 : 9)
          .text(value, totalsX, y, { width: totalsW, align: 'right' });
      };

      let ty = totalsTopY + 2;
      const totalsMode = options?.totalsMode || 'buyer';
      if (totalsMode === 'seller') {
        // Seller-facing payout view:
        // - Start with subtotal (product revenue)
        // - Subtract delivery fee (seller share from admin config)
        // - No platform fee
        const deliveryFeeAmount =
          typeof options?.deliveryFeeAmountOverride === 'number'
            ? Number(options.deliveryFeeAmountOverride || 0)
            : delivery;
        totalRow('Subtotal', formatCurrency(subtotalAmount), ty);
        ty += 12;
        if (deliveryFeeAmount > 0) {
          totalRow(
            'Delivery fee',
            `-${formatCurrency(deliveryFeeAmount)}`,
            ty,
            false,
            '#6C715D',
          );
          ty += 12;
        }
      } else {
        totalRow('Subtotal', formatCurrency(subtotalAmount), ty);
        ty += 12;
        totalRow('Delivery & handling', formatCurrency(delivery), ty);
        ty += 12;
        totalRow('Platform fee', formatCurrency(platformFee), ty);
        ty += 12;
        if (taxAmount > 0) {
          totalRow('Tax', formatCurrency(taxAmount), ty);
          ty += 12;
        }
        if (discount > 0) {
          doc
            .fillColor('#059669')
            .font('Helvetica')
            .fontSize(9)
            .text('Discount', totalsX, ty, {
              width: totalsW / 2,
              align: 'left',
            });
          doc
            .fillColor('#059669')
            .font('Helvetica')
            .fontSize(9)
            .text(`-${formatCurrency(discount)}`, totalsX, ty, {
              width: totalsW,
              align: 'right',
            });
          ty += 12;
        }
      }

      // divider
      doc
        .moveTo(totalsX, ty + 6)
        .lineTo(totalsX + totalsW, ty + 6)
        .strokeColor('#CBD5E1')
        .lineWidth(1)
        .stroke();
      ty += 14;
      if ((options?.totalsMode || 'buyer') === 'seller') {
        const deliveryFeeAmount =
          typeof options?.deliveryFeeAmountOverride === 'number'
            ? Number(options.deliveryFeeAmountOverride || 0)
            : delivery;
        const amountReceived = subtotalAmount - deliveryFeeAmount;
        totalRow('Amount received', formatCurrency(amountReceived), ty, true);
      } else {
        totalRow('Amount due', formatCurrency(totalAmount), ty, true);
      }

      // Footer note (match UI ClassicInvoice: note sits BELOW the main card)
      const footerNote =
        'Thank you for sourcing fresh produce through Procur. Payments help us keep farmers on the land and buyers fully supplied.';
      // Bottom spacing: keep invoice on ONE page for normal orders.
      // Only allow page-break if there are more items than fit in the table.
      const contentBottomY = Math.max(instrY, ty + 16);
      let footerNoteY = Math.max(cardY + cardH + 12, contentBottomY + 18);

      // If footer would overflow the page, only push to a new page for long item lists.
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      const footerNoteHeightEstimate = doc.heightOfString(footerNote, {
        width: pageWidth,
      });
      const footerYEstimate = footerNoteY + footerNoteHeightEstimate + 12;
      if (items.length > maxRows && footerYEstimate + 40 > pageBottom) {
        doc.addPage();
        // repaint background on the new page
        doc.save();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.pageBg);
        doc.restore();
        footerNoteY = doc.page.margins.top;
      }

      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(footerNote, pageLeft, footerNoteY, {
          width: pageWidth,
          align: 'left',
        });

      const footerNoteHeight = doc.heightOfString(footerNote, { width: pageWidth });

      // Brand footer (like ClassicInvoice BrandFooter) BELOW the note
      const footerY = footerNoteY + footerNoteHeight + 12;
      const footerH = 40;
      doc
        .roundedRect(pageLeft, footerY, pageWidth, footerH, 12)
        .lineWidth(1)
        .strokeColor(colors.border)
        .fillColor(colors.footerBg)
        .fillAndStroke();
      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(`© ${new Date().getFullYear()} Procur Grenada Ltd. All rights reserved.`, pageLeft, footerY + 10, {
          width: pageWidth,
          align: 'center',
        })
        .text(
          'Procur Grenada Ltd. Annandale, St. Georges, Grenada W.I., 473-538-4365',
          pageLeft,
          footerY + 22,
          { width: pageWidth, align: 'center' },
        );

      doc.end();
    },
    );
  }

  async cancelOrder(buyerOrgId: string, orderId: string): Promise<void> {
    const { data: order } = await this.supabase
      .getClient()
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    const { error } = await this.supabase
      .getClient()
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      throw new BadRequestException(`Failed to cancel order: ${error.message}`);
    }

    // Create timeline entry
    await this.supabase.getClient().from('order_timeline').insert({
      order_id: orderId,
      event_type: 'order_cancelled',
      description: 'Order cancelled by buyer',
      created_by: buyerOrgId,
    });
  }

  async createOrderReview(
    buyerOrgId: string,
    orderId: string,
    reviewDto: OrderReviewDto,
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Verify order ownership and completion
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, status, seller_org_id')
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'delivered') {
      throw new BadRequestException('Can only review delivered orders');
    }

    // Prevent duplicate reviews for the same order/buyer
    const { data: existing } = await client
      .from('order_reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Order has already been reviewed');
    }

    const { error } = await client.from('order_reviews').insert({
      order_id: orderId,
      buyer_org_id: buyerOrgId,
      seller_org_id: order.seller_org_id,
      rating: reviewDto.overall_rating,
      review_text: reviewDto.comment || null,
      delivery_rating: reviewDto.delivery_rating,
      product_quality_rating: reviewDto.product_quality_rating,
      service_rating: reviewDto.service_rating,
    });

    if (error) {
      throw new BadRequestException(
        `Failed to create review: ${error.message}`,
      );
    }

    // Optional: add timeline entry so both sides can see that a review was left
    await client.from('order_timeline').insert({
      order_id: orderId,
      event_type: 'buyer_left_review',
      title: 'Buyer left a review',
      description: reviewDto.title || null,
      actor_type: 'buyer',
      metadata: {
        overall_rating: reviewDto.overall_rating,
      },
      is_visible_to_buyer: true,
      is_visible_to_seller: true,
    });
  }

  private transformOrderToResponse(
    order: any,
    orderItems: any[],
  ): BuyerOrderResponseDto {
    const timeline: OrderTimelineEventDto[] =
      order.order_timeline?.map((event: any) => ({
        event_type: event.event_type,
        description: event.description,
        created_at: event.created_at,
        metadata: event.metadata,
      })) || [];

    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      seller_org_id: order.seller_org_id,
      seller_name: order.seller_organization?.name || 'Unknown Seller',
      subtotal: order.subtotal,
      tax_amount: order.tax_amount,
      shipping_amount: order.shipping_amount,
      discount_amount: order.discount_amount,
      total_amount: order.total_amount,
      currency: order.currency,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      buyer_notes: order.buyer_notes,
      seller_notes: order.seller_notes,
      tracking_number: order.tracking_number,
      shipping_method: order.shipping_method,
      estimated_delivery_date: order.estimated_delivery_date,
      actual_delivery_date: order.actual_delivery_date,
      accepted_at: order.accepted_at,
      rejected_at: order.rejected_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      items: orderItems.map((item) => {
        const productImage =
          (item.product_snapshot?.product_images || []).find?.(
            (img: any) => img?.is_primary,
          )?.image_url ||
          item.product_snapshot?.image_url ||
          null;

        const unit =
          item.product_snapshot?.unit_of_measurement ||
          item.unit_of_measurement ||
          null;

        const subtotal =
          typeof item.total_price === 'number'
            ? item.total_price
            : Number(item.total_price ?? 0);

        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          unit_price: item.unit_price,
          quantity: item.quantity,
          total_price: item.total_price,

          // UI-friendly aliases (procur-ui expects these names)
          product_image: productImage,
          image_url: productImage,
          subtotal,
          unit,

          // Helpful extras
          unit_of_measurement: unit,
          product_snapshot: item.product_snapshot,
        };
      }),
      // timeline, // Remove timeline as it's not in the DTO
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  // ==================== PROFILE METHODS ====================

  async getBuyerProfile(buyerOrgId: string): Promise<BuyerProfileResponseDto> {
    const { data: organization, error } = await this.supabase
      .getClient()
      .from('organizations')
      .select('*')
      .eq('id', buyerOrgId)
      .single();

    if (error || !organization) {
      throw new NotFoundException('Buyer profile not found');
    }

    // Get basic stats
    const addresses = await this.getAddresses(buyerOrgId);
    const preferences = await this.getPreferences(buyerOrgId);

    return {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      logo_url: organization.logo_url,
      website: organization.website,
      contact_email: organization.contact_email,
      contact_phone: organization.contact_phone,
      account_type: organization.account_type,
      status: organization.status,
      total_orders: 0, // TODO: Calculate from orders
      total_spent: 0, // TODO: Calculate from transactions
      preferred_currency: preferences.preferred_currency,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
      addresses,
      preferences,
    };
  }

  async getAddresses(buyerOrgId: string): Promise<AddressResponseDto[]> {
    const { data: addresses, error } = await this.supabase
      .getClient()
      .from('buyer_addresses')
      .select('*')
      .eq('buyer_org_id', buyerOrgId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error)
      throw new BadRequestException(
        `Failed to fetch addresses: ${error.message}`,
      );

    return (
      addresses?.map((address) => ({
        id: address.id,
        label: address.label,
        street_address: address.street_address,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
        contact_name: address.contact_name,
        contact_phone: address.contact_phone,
        is_default: address.is_default,
        is_billing: address.is_billing,
        is_shipping: address.is_shipping,
        created_at: address.created_at,
        updated_at: address.updated_at,
      })) || []
    );
  }

  async createAddress(
    buyerOrgId: string,
    createDto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const { error, data } = await this.supabase
      .getClient()
      .from('buyer_addresses')
      .insert({
        buyer_org_id: buyerOrgId,
        ...createDto,
      })
      .select()
      .single();

    if (error)
      throw new BadRequestException(
        `Failed to create address: ${error.message}`,
      );

    return {
      id: data.id,
      label: data.label,
      street_address: data.street_address,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code,
      country: data.country,
      contact_name: data.contact_name,
      contact_phone: data.contact_phone,
      is_default: data.is_default,
      is_billing: data.is_billing,
      is_shipping: data.is_shipping,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async getPreferences(buyerOrgId: string): Promise<PreferencesResponseDto> {
    const client = this.supabase.getClient();

    const { data: preferences } = await client
      .from('buyer_preferences')
      .select('*')
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!preferences) {
      // Create default preferences record if it doesn't exist yet
      const { data: newPreferences, error } = await client
        .from('buyer_preferences')
        .insert({
          buyer_org_id: buyerOrgId,
          email_notifications: true,
          sms_notifications: false,
          order_updates: true,
          price_alerts: false,
          new_product_alerts: false,
          preferred_currency: 'USD',
          auto_reorder: false,
          public_reviews: true,
          share_purchase_history: false,
        })
        .select('*')
        .single();

      if (error || !newPreferences) {
        throw new BadRequestException(
          `Failed to create default preferences: ${error?.message}`,
        );
      }

      return newPreferences as PreferencesResponseDto;
    }

    return preferences as PreferencesResponseDto;
  }

  async updatePreferences(
    buyerOrgId: string,
    updateDto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    const client = this.supabase.getClient();

    // Ensure a preferences row exists and get the current values
    const current = await this.getPreferences(buyerOrgId);

    const updatePayload: Record<string, any> = {};

    if (typeof updateDto.email_notifications === 'boolean') {
      updatePayload.email_notifications = updateDto.email_notifications;
    }
    if (typeof updateDto.sms_notifications === 'boolean') {
      updatePayload.sms_notifications = updateDto.sms_notifications;
    }
    if (typeof updateDto.order_updates === 'boolean') {
      updatePayload.order_updates = updateDto.order_updates;
    }
    if (typeof updateDto.price_alerts === 'boolean') {
      updatePayload.price_alerts = updateDto.price_alerts;
    }
    if (typeof updateDto.new_product_alerts === 'boolean') {
      updatePayload.new_product_alerts = updateDto.new_product_alerts;
    }
    if (typeof updateDto.auto_reorder === 'boolean') {
      updatePayload.auto_reorder = updateDto.auto_reorder;
    }
    if (typeof updateDto.public_reviews === 'boolean') {
      updatePayload.public_reviews = updateDto.public_reviews;
    }
    if (typeof updateDto.share_purchase_history === 'boolean') {
      updatePayload.share_purchase_history = updateDto.share_purchase_history;
    }
    if (typeof updateDto.preferred_currency === 'string') {
      updatePayload.preferred_currency = updateDto.preferred_currency;
    }
    if (typeof updateDto.preferred_delivery_window === 'object') {
      updatePayload.preferred_delivery_window =
        updateDto.preferred_delivery_window;
    }

    if (typeof updateDto.preferences_data === 'object') {
      updatePayload.preferences_data = {
        ...(current.preferences_data || {}),
        ...updateDto.preferences_data,
      };
    }

    // If nothing to update, just return current
    if (Object.keys(updatePayload).length === 0) {
      return current;
    }

    const { data, error } = await client
      .from('buyer_preferences')
      .update(updatePayload)
      .eq('buyer_org_id', buyerOrgId)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to update preferences: ${error?.message}`,
      );
    }

    return data as PreferencesResponseDto;
  }

  // ==================== FAVORITES METHODS ====================

  async getFavoriteProducts(buyerOrgId: string): Promise<FavoriteProductDto[]> {
    const { data: favorites, error } = await this.supabase
      .getClient()
      .from('buyer_favorite_products')
      .select(
        `
        product_id, created_at,
        product:products(
          id, name, base_price, sale_price, currency, stock_quantity,
          seller_organization:organizations!seller_org_id(id, name, status, is_hidden_from_marketplace),
          product_images(image_url, is_primary)
        )
      `,
      )
      .eq('buyer_org_id', buyerOrgId)
      .order('created_at', { ascending: false });

    if (error)
      throw new BadRequestException(
        `Failed to fetch favorite products: ${error.message}`,
      );

    const rows = favorites || [];

    const visibleRows = rows.filter((fav: any) => {
      const product = Array.isArray(fav.product) ? fav.product[0] : fav.product;
      const sellerOrg = Array.isArray(product?.seller_organization)
        ? product.seller_organization[0]
        : product?.seller_organization;
      const hidden = Boolean((sellerOrg as any)?.is_hidden_from_marketplace);
      const status = ((sellerOrg as any)?.status as string | undefined) ?? undefined;
      return !hidden && status === 'active';
    });

    return (
      visibleRows.map((fav: any) => {
        const product = Array.isArray(fav.product)
          ? fav.product[0]
          : fav.product;
        return {
          product_id: fav.product_id,
          product_name: product.name,
          current_price: product.sale_price || product.base_price,
          currency: product.currency,
          image_url: product.product_images?.find((img) => img.is_primary)
            ?.image_url,
          seller_name:
            (product.seller_organization as any)?.name || 'Unknown Seller',
          in_stock: product.stock_quantity > 0,
          created_at: fav.created_at,
        };
      }) || []
    );
  }

  async addProductToFavorites(
    buyerOrgId: string,
    productId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('buyer_favorite_products')
      .insert({
        buyer_org_id: buyerOrgId,
        product_id: productId,
      });

    if (error && error.code !== '23505') {
      // Ignore duplicate key error
      throw new BadRequestException(
        `Failed to add to favorites: ${error.message}`,
      );
    }
  }

  async removeProductFromFavorites(
    buyerOrgId: string,
    productId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('buyer_favorite_products')
      .delete()
      .eq('buyer_org_id', buyerOrgId)
      .eq('product_id', productId);

    if (error)
      throw new BadRequestException(
        `Failed to remove from favorites: ${error.message}`,
      );
  }

  async getFavoriteSellers(buyerOrgId: string): Promise<FavoriteSellerDto[]> {
    const client = this.supabase.getClient();
    const { data: favorites, error } = await client
      .from('buyer_favorite_sellers')
      .select(
        `
        seller_org_id, created_at,
        seller:organizations!seller_org_id(
          id, name, logo_url, business_type, country, status, is_hidden_from_marketplace,
          products:products!seller_org_id(count)
        )
      `,
      )
      .eq('buyer_org_id', buyerOrgId)
      .order('created_at', { ascending: false });

    if (error)
      throw new BadRequestException(
        `Failed to fetch favorite sellers: ${error.message}`,
      );

    const rows = (favorites || []).filter((fav: any) => {
      const seller = Array.isArray(fav.seller) ? fav.seller[0] : fav.seller;
      const hidden = Boolean((seller as any)?.is_hidden_from_marketplace);
      const status = ((seller as any)?.status as string | undefined) ?? undefined;
      return !hidden && status === 'active';
    });
    const sellerIds = Array.from(
      new Set(
        rows
          .map((fav: any) => (fav.seller_org_id as string | null) ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let ratingsBySeller: Record<string, { avg: number; count: number }> = {};
    if (sellerIds.length > 0) {
      const { data: reviews } = await client
        .from('order_reviews')
        .select('seller_org_id, rating')
        .in('seller_org_id', sellerIds);

      const agg = new Map<string, { sum: number; count: number }>();
      (reviews || []).forEach((r: any) => {
        const sid = r.seller_org_id as string;
        const rating = Number(r.rating) || 0;
        const cur = agg.get(sid) || { sum: 0, count: 0 };
        cur.sum += rating;
        cur.count += 1;
        agg.set(sid, cur);
      });

      ratingsBySeller = Object.fromEntries(
        Array.from(agg.entries()).map(([sid, a]) => [
          sid,
          {
            avg: a.count > 0 ? Number((a.sum / a.count).toFixed(2)) : 0,
            count: a.count,
          },
        ]),
      );
    }

    return rows.map((fav: any) => {
      const seller = Array.isArray(fav.seller) ? fav.seller[0] : fav.seller;
      const r = ratingsBySeller[fav.seller_org_id as string];
      return {
        seller_org_id: fav.seller_org_id,
        seller_name: seller?.name || 'Unknown Seller',
        logo_url: seller?.logo_url,
        description: seller?.business_type,
        average_rating: r?.avg,
        product_count: seller?.products?.[0]?.count || 0,
        created_at: fav.created_at,
      };
    });
  }

  async addSellerToFavorites(
    buyerOrgId: string,
    sellerId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('buyer_favorite_sellers')
      .insert({
        buyer_org_id: buyerOrgId,
        seller_org_id: sellerId,
      });

    if (error) {
      if (error.code === '23505') {
        // Already exists
        return;
      }
      throw new BadRequestException(
        `Failed to add seller to favorites: ${error.message}`,
      );
    }
  }

  async removeSellerFromFavorites(
    buyerOrgId: string,
    sellerId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('buyer_favorite_sellers')
      .delete()
      .eq('buyer_org_id', buyerOrgId)
      .eq('seller_org_id', sellerId);

    if (error)
      throw new BadRequestException(
        `Failed to remove seller from favorites: ${error.message}`,
      );
  }

  // ==================== TRANSACTION METHODS ====================

  async getTransactions(
    buyerOrgId: string,
    query: BuyerTransactionQueryDto,
  ): Promise<{
    transactions: BuyerTransactionResponseDto[];
    summary: BuyerTransactionSummaryDto;
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      start_date,
      end_date,
      seller_id,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;
    const offset = (page - 1) * limit;

    let queryBuilder = this.supabase
      .getClient()
      .from('transactions')
      .select(
        `
        *,
        order:orders!order_id(order_number, status),
        seller_organization:organizations!seller_org_id(name)
      `,
        { count: 'exact' },
      )
      .eq('buyer_org_id', buyerOrgId);

    if (type) queryBuilder = queryBuilder.eq('transaction_type', type);
    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (seller_id) queryBuilder = queryBuilder.eq('seller_org_id', seller_id);
    if (start_date) queryBuilder = queryBuilder.gte('created_at', start_date);
    if (end_date) queryBuilder = queryBuilder.lte('created_at', end_date);
    if (search) {
      queryBuilder = queryBuilder.or(
        `transaction_number.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    queryBuilder = queryBuilder
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch transactions: ${error.message}`,
      );
    }

    // Calculate summary statistics
    const summaryQuery = this.supabase
      .getClient()
      .from('transactions')
      .select('amount, transaction_type, status, created_at')
      .eq('buyer_org_id', buyerOrgId);

    if (start_date) summaryQuery.gte('created_at', start_date);
    if (end_date) summaryQuery.lte('created_at', end_date);

    const { data: allTransactions } = await summaryQuery;

    const totalSpent =
      allTransactions
        ?.filter(
          (t) => t.transaction_type === 'sale' && t.status === 'completed',
        )
        .reduce((sum, t) => sum + t.amount, 0) || 0;
    const totalRefunds =
      allTransactions
        ?.filter(
          (t) => t.transaction_type === 'refund' && t.status === 'completed',
        )
        .reduce((sum, t) => sum + t.amount, 0) || 0;
    const totalFees =
      allTransactions
        ?.filter(
          (t) => t.transaction_type === 'fee' && t.status === 'completed',
        )
        .reduce((sum, t) => sum + t.amount, 0) || 0;

    const summary: BuyerTransactionSummaryDto = {
      total_transactions: allTransactions?.length || 0,
      total_spent: totalSpent,
      total_refunds: totalRefunds,
      total_fees: totalFees,
      net_spent: totalSpent - totalRefunds,
      currency: 'USD',
      transactions_by_status:
        allTransactions?.reduce(
          (acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ) || {},
      transactions_by_type:
        allTransactions?.reduce(
          (acc, t) => {
            acc[t.transaction_type] = (acc[t.transaction_type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ) || {},
      monthly_spending: [], // TODO: Implement monthly spending calculation
      top_sellers: [], // TODO: Implement top sellers calculation
      average_transaction_amount: allTransactions?.length
        ? totalSpent /
            allTransactions.filter(
              (t) => t.transaction_type === 'sale' && t.status === 'completed',
            ).length || 0
        : 0,
      largest_transaction:
        allTransactions
          ?.filter(
            (t) => t.transaction_type === 'sale' && t.status === 'completed',
          )
          .reduce((max, t) => Math.max(max, t.amount), 0) || 0,
      last_transaction_date: allTransactions?.length
        ? allTransactions.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )[0]?.created_at
        : undefined,
    };

    const transformedTransactions: BuyerTransactionResponseDto[] =
      transactions?.map((transaction) => ({
        id: transaction.id,
        transaction_number: transaction.transaction_number,
        order_id: transaction.order_id,
        order_number: transaction.order?.order_number,
        seller_org_id: transaction.seller_org_id,
        seller_name: transaction.seller_organization?.name || 'Unknown Seller',
        type: transaction.transaction_type,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        payment_method: transaction.payment_method,
        payment_reference: transaction.payment_reference,
        platform_fee: transaction.platform_fee || 0,
        payment_processing_fee: transaction.payment_processing_fee || 0,
        net_amount: transaction.net_amount || transaction.amount,
        description: transaction.description,
        metadata: transaction.metadata,
        processed_at: transaction.processed_at,
        settled_at: transaction.settled_at,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      })) || [];

    return {
      transactions: transformedTransactions,
      summary,
      total: count || 0,
      page,
      limit,
    };
  }

  // ==================== HARVEST UPDATES METHODS ====================

  async getHarvestUpdates(
    query: HarvestUpdatesQueryDto,
    buyerOrgId?: string,
  ): Promise<{
    updates: HarvestUpdateDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      crop,
      seller_org_id,
      category,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = query;

    const offset = (page - 1) * limit;

    let queryBuilder = this.supabase
      .getClient()
      .from('harvest_requests')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(
          id, name, logo_url, address, country, is_verified
        )
      `,
        { count: 'exact' },
      )
      .eq('status', 'active')
      .eq('visibility', 'public');

    // Apply filters
    if (crop) {
      queryBuilder = queryBuilder.ilike('crop', `%${crop}%`);
    }
    if (seller_org_id) {
      queryBuilder = queryBuilder.eq('seller_org_id', seller_org_id);
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(sort_by, {
      ascending: sort_order === 'asc',
    });

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data: updates, error, count } = await queryBuilder;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch harvest updates: ${error.message}`,
      );
    }

    // Transform data and check if user has liked each update
    const transformedUpdates: HarvestUpdateDto[] = await Promise.all(
      updates?.map(async (update) => {
        const seller = Array.isArray(update.seller_organization)
          ? update.seller_organization[0]
          : update.seller_organization;

        const isLiked = buyerOrgId
          ? await this.isHarvestLiked(buyerOrgId, update.id)
          : false;

        return {
          id: update.id,
          seller_org_id: update.seller_org_id,
          farm_name: seller?.name || 'Unknown Farm',
          farm_avatar: seller?.logo_url,
          location: seller?.address
            ? `${seller.address}${seller.country ? `, ${seller.country}` : ''}`
            : seller?.country || undefined,
          crop: update.crop,
          content: update.content,
          expected_harvest_window: update.expected_harvest_window,
          quantity: update.quantity,
          unit: update.unit,
          notes: update.notes,
          images: update.images || [],
          likes_count: update.likes_count || 0,
          comments_count: update.comments_count || 0,
          requests_count: update.requests_count || 0,
          is_verified: seller?.is_verified || false,
          is_liked: isLiked,
          created_at: update.created_at,
          time_ago: this.getTimeAgo(update.created_at),
          next_planting_crop: update.next_planting_crop,
          next_planting_date: update.next_planting_date,
          next_planting_area: update.next_planting_area,
        };
      }) || [],
    );

    return {
      updates: transformedUpdates,
      total: count || 0,
      page,
      limit,
    };
  }

  async getHarvestUpdateDetail(
    harvestId: string,
    buyerOrgId?: string,
  ): Promise<HarvestUpdateDetailDto> {
    const { data: update, error } = await this.supabase
      .getClient()
      .from('harvest_requests')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(
          id, name, logo_url, address, country, is_verified, phone_number
        )
      `,
      )
      .eq('id', harvestId)
      .eq('status', 'active')
      .single();

    if (error || !update) {
      throw new NotFoundException('Harvest update not found');
    }

    const seller = Array.isArray(update.seller_organization)
      ? update.seller_organization[0]
      : update.seller_organization;

    const isLiked = buyerOrgId
      ? await this.isHarvestLiked(buyerOrgId, update.id)
      : false;

    // Get recent comments
    const { data: comments } = await this.supabase
      .getClient()
      .from('harvest_comments')
      .select(
        `
        *,
        buyer_organization:organizations!buyer_org_id(name, logo_url),
        buyer_user:users!buyer_user_id(id)
      `,
      )
      .eq('harvest_id', harvestId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentComments: BuyerHarvestCommentDto[] =
      comments?.map((comment) => ({
        id: comment.id,
        buyer_org_id: comment.buyer_org_id,
        buyer_user_id: comment.buyer_user_id,
        commenter_name: comment.buyer_organization?.name || 'Anonymous',
        commenter_avatar: comment.buyer_organization?.logo_url,
        content: comment.content,
        created_at: comment.created_at,
        time_ago: this.getTimeAgo(comment.created_at),
      })) || [];

    return {
      id: update.id,
      seller_org_id: update.seller_org_id,
      farm_name: seller?.name || 'Unknown Farm',
      farm_avatar: seller?.logo_url,
      location: seller?.address
        ? `${seller.address}${seller.country ? `, ${seller.country}` : ''}`
        : seller?.country || undefined,
      crop: update.crop,
      content: update.content,
      expected_harvest_window: update.expected_harvest_window,
      quantity: update.quantity,
      unit: update.unit,
      notes: update.notes,
      images: update.images || [],
      likes_count: update.likes_count || 0,
      comments_count: update.comments_count || 0,
      requests_count: update.requests_count || 0,
      is_verified: seller?.is_verified || false,
      is_liked: isLiked,
      created_at: update.created_at,
      time_ago: this.getTimeAgo(update.created_at),
      next_planting_crop: update.next_planting_crop,
      next_planting_date: update.next_planting_date,
      next_planting_area: update.next_planting_area,
      recent_comments: recentComments,
      seller_contact: {
        email: undefined,
        phone: seller?.phone_number || undefined,
      },
    };
  }

  async toggleHarvestLike(
    buyerOrgId: string,
    buyerUserId: string,
    harvestId: string,
    isLike: boolean,
  ): Promise<void> {
    // Verify harvest exists
    const { data: harvest } = await this.supabase
      .getClient()
      .from('harvest_requests')
      .select('id')
      .eq('id', harvestId)
      .eq('status', 'active')
      .single();

    if (!harvest) {
      throw new NotFoundException('Harvest update not found');
    }

    if (isLike) {
      // Add like
      const { error } = await this.supabase
        .getClient()
        .from('harvest_likes')
        .insert({
          harvest_id: harvestId,
          buyer_org_id: buyerOrgId,
          buyer_user_id: buyerUserId,
        });

      if (error && error.code !== '23505') {
        // Ignore duplicate key error
        throw new BadRequestException(`Failed to like: ${error.message}`);
      }
    } else {
      // Remove like
      const { error } = await this.supabase
        .getClient()
        .from('harvest_likes')
        .delete()
        .eq('harvest_id', harvestId)
        .eq('buyer_org_id', buyerOrgId);

      if (error) {
        throw new BadRequestException(`Failed to unlike: ${error.message}`);
      }
    }
  }

  async createHarvestComment(
    buyerOrgId: string,
    buyerUserId: string,
    harvestId: string,
    commentDto: CreateBuyerHarvestCommentDto,
  ): Promise<BuyerHarvestCommentDto> {
    // Verify harvest exists
    const { data: harvest } = await this.supabase
      .getClient()
      .from('harvest_requests')
      .select('id')
      .eq('id', harvestId)
      .eq('status', 'active')
      .single();

    if (!harvest) {
      throw new NotFoundException('Harvest update not found');
    }

    const { data: comment, error } = await this.supabase
      .getClient()
      .from('harvest_comments')
      .insert({
        harvest_id: harvestId,
        buyer_org_id: buyerOrgId,
        buyer_user_id: buyerUserId,
        content: commentDto.content,
      })
      .select(
        `
        *,
        buyer_organization:organizations!buyer_org_id(name, logo_url)
      `,
      )
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create comment: ${error.message}`,
      );
    }

    return {
      id: comment.id,
      buyer_org_id: comment.buyer_org_id,
      buyer_user_id: comment.buyer_user_id,
      commenter_name: comment.buyer_organization?.name || 'Anonymous',
      commenter_avatar: comment.buyer_organization?.logo_url,
      content: comment.content,
      created_at: comment.created_at,
      time_ago: this.getTimeAgo(comment.created_at),
    };
  }

  async getHarvestComments(
    harvestId: string,
  ): Promise<BuyerHarvestCommentDto[]> {
    const { data: comments, error } = await this.supabase
      .getClient()
      .from('harvest_comments')
      .select(
        `
        *,
        buyer_organization:organizations!buyer_org_id(name, logo_url)
      `,
      )
      .eq('harvest_id', harvestId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch comments: ${error.message}`,
      );
    }

    return (
      comments?.map((comment) => ({
        id: comment.id,
        buyer_org_id: comment.buyer_org_id,
        buyer_user_id: comment.buyer_user_id,
        commenter_name: comment.buyer_organization?.name || 'Anonymous',
        commenter_avatar: comment.buyer_organization?.logo_url,
        content: comment.content,
        created_at: comment.created_at,
        time_ago: this.getTimeAgo(comment.created_at),
      })) || []
    );
  }

  async createHarvestRequest(
    buyerOrgId: string,
    buyerUserId: string,
    harvestId: string,
    requestDto: CreateBuyerHarvestRequestDto,
  ): Promise<void> {
    // Verify harvest exists
    const { data: harvest } = await this.supabase
      .getClient()
      .from('harvest_requests')
      .select('seller_org_id')
      .eq('id', harvestId)
      .eq('status', 'active')
      .single();

    if (!harvest) {
      throw new NotFoundException('Harvest update not found');
    }

    const { error } = await this.supabase
      .getClient()
      .from('harvest_buyer_requests')
      .insert({
        harvest_id: harvestId,
        seller_org_id: harvest.seller_org_id,
        buyer_org_id: buyerOrgId,
        buyer_user_id: buyerUserId,
        requested_quantity: requestDto.requested_quantity,
        unit: requestDto.unit,
        requested_date: requestDto.requested_date,
        notes: requestDto.notes,
      });

    if (error) {
      throw new BadRequestException(
        `Failed to create harvest request: ${error.message}`,
      );
    }
  }

  // ==================== HELPER METHODS ====================

  private async isProductFavorited(
    buyerOrgId: string,
    productId: string,
  ): Promise<boolean> {
    const { data } = await this.supabase
      .getClient()
      .from('buyer_favorite_products')
      .select('buyer_org_id')
      .eq('buyer_org_id', buyerOrgId)
      .eq('product_id', productId)
      .single();

    return !!data;
  }

  private async isHarvestLiked(
    buyerOrgId: string,
    harvestId: string,
  ): Promise<boolean> {
    const { data } = await this.supabase
      .getClient()
      .from('harvest_likes')
      .select('buyer_org_id')
      .eq('buyer_org_id', buyerOrgId)
      .eq('harvest_id', harvestId)
      .single();

    return !!data;
  }

  private getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    if (seconds < 2592000) {
      const weeks = Math.floor(seconds / 604800);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    const months = Math.floor(seconds / 2592000);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
}
