import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { ConversationsService } from '../messages/services/conversations.service';
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
  constructor(
    private readonly supabase: SupabaseService,
    private readonly conversationsService: ConversationsService,
  ) {}

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

    let queryBuilder = this.supabase
      .getClient()
      .from('products')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(id, name, logo_url, business_type, country),
        product_images(image_url, is_primary, display_order)
      `,
      )
      .eq('status', 'active')
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

    // Get total count
    const { count } = await this.supabase
      .getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('stock_quantity', in_stock ? 1 : 0);

    // Get paginated results
    const { data: products, error } = await queryBuilder.range(
      offset,
      offset + limit - 1,
    );

    if (error)
      throw new BadRequestException(
        `Failed to fetch products: ${error.message}`,
      );

    // Transform data
    const transformedProducts: MarketplaceProductDto[] =
      (await Promise.all(
        products?.map(async (product) => ({
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
          average_rating: undefined, // TODO: Calculate from reviews
          review_count: 0, // TODO: Count reviews
          seller: {
            id: product.seller_organization.id,
            name: product.seller_organization.name,
            description: undefined,
            logo_url: product.seller_organization.logo_url,
            average_rating: undefined, // TODO: Calculate seller rating
            review_count: 0, // TODO: Count seller reviews
            product_count: 0, // TODO: Count seller products
            is_verified: true, // TODO: Add verification logic
          },
          is_favorited: buyerOrgId
            ? await this.isProductFavorited(buyerOrgId, product.id)
            : false,
        })),
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
    const { data: product, error } = await this.supabase
      .getClient()
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

    // Get related products (same category, different seller or same seller)
    const { data: relatedProducts } = await this.supabase
      .getClient()
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
      .limit(6);

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
      average_rating: undefined, // TODO: Calculate from reviews
      review_count: 0, // TODO: Count reviews
      seller: {
        id: product.seller_organization.id,
        name: product.seller_organization.name,
        description: undefined,
        logo_url: product.seller_organization.logo_url,
        average_rating: undefined, // TODO: Calculate seller rating
        review_count: 0, // TODO: Count seller reviews
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
        id, name, logo_url, created_at, business_type, country,
        products(id)
      `,
        { count: 'exact' },
      )
      .eq('account_type', 'seller')
      .eq('status', 'active');

    // Apply filters
    if (search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${search}%, description.ilike.%${search}%`,
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

    let mappedSellers =
      sellers?.map((seller) => ({
        id: seller.id,
        name: seller.name,
        description: undefined,
        business_type: seller.business_type,
        logo_url: seller.logo_url,
        location: seller.country,
        average_rating: undefined, // TODO: Calculate from reviews
        review_count: 0, // TODO: Count reviews
        product_count: seller.products?.length || 0,
        years_in_business:
          new Date().getFullYear() - new Date(seller.created_at).getFullYear(),
        is_verified: true, // TODO: Add verification logic
        specialties: [], // TODO: Add specialties
      })) || [];

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

  async getMarketplaceStats(): Promise<MarketplaceStatsDto> {
    // Get total counts
    const [productsResult, sellersResult, categoriesResult] = await Promise.all(
      [
        this.supabase
          .getClient()
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        this.supabase
          .getClient()
          .from('organizations')
          .select('*', { count: 'exact', head: true })
          .eq('account_type', 'seller')
          .eq('status', 'active'),
        this.supabase
          .getClient()
          .from('products')
          .select('category')
          .eq('status', 'active'),
      ],
    );

    // Get featured products count
    const { count: featuredCount } = await this.supabase
      .getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_featured', true);

    // Get new products this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { count: newProductsCount } = await this.supabase
      .getClient()
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
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
          seller_organization:organizations!seller_org_id(id, name),
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

    // Group items by seller
    const sellerGroups = new Map<string, CartSellerGroupDto>();
    let totalItems = 0;
    let subtotal = 0;

    cartItems.forEach((item) => {
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
          estimated_shipping: 10, // TODO: Calculate actual shipping
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
      unique_products: cartItems.length,
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
      .select('id, stock_quantity, status')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== 'active') {
      throw new BadRequestException('Product is not available');
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
    const { error, data } = await this.supabase
      .getClient()
      .from('product_requests')
      .insert({
        buyer_org_id: buyerOrgId,
        buyer_user_id: buyerUserId,
        ...createDto,
        status: 'draft',
      })
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
      budget_range: data.budget_range,
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
        budget_range: request.budget_range,
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
      budget_range: request.budget_range,
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

    const { data: request, error } = await this.supabase
      .getClient()
      .from('product_requests')
      .update(updateDto)
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
      budget_range: request.budget_range,
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
    const shippingAmount = 15; // TODO: Calculate actual shipping
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
      const { data: product } = await this.supabase
        .getClient()
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .eq('status', 'active')
        .single();

      if (!product) {
        throw new NotFoundException(`Product ${item.product_id} not found`);
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

    for (const [sellerOrgId, items] of sellerGroups) {
      const orderSubtotal = items.reduce(
        (sum, item) => sum + item.total_price,
        0,
      );
      const shippingAmount = 10; // TODO: Calculate actual shipping
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
          subtotal: orderSubtotal,
          tax_amount: taxAmount,
          shipping_amount: shippingAmount,
          discount_amount: 0,
          total_amount: totalAmount,
          currency: 'USD',
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

      createdOrders.push(order);
    }

    // Clear cart after successful order creation
    await this.clearCart(buyerOrgId, buyerUserId);

    // Return the first order (or combine if needed)
    const firstOrder = createdOrders[0];
    const firstOrderItems = sellerGroups.get(firstOrder.seller_org_id) || [];

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

    let queryBuilder = this.supabase
      .getClient()
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

    const transformedOrders: BuyerOrderResponseDto[] = await Promise.all(
      orders?.map(async (order) => {
        const orderItems = Array.isArray(order.order_items)
          ? order.order_items
          : [];
        return this.transformOrderToResponse(order, orderItems);
      }) || [],
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
    const { data: order, error } = await this.supabase
      .getClient()
      .from('orders')
      .select(
        `
        *,
        seller_organization:organizations!seller_org_id(name),
        order_items(*),
        order_timeline(*)
      `,
      )
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (error || !order) {
      throw new NotFoundException('Order not found');
    }

    const orderItems = Array.isArray(order.order_items)
      ? order.order_items
      : [];
    return this.transformOrderToResponse(order, orderItems);
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
    // Verify order ownership and completion
    const { data: order } = await this.supabase
      .getClient()
      .from('orders')
      .select('id, status, seller_org_id')
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'delivered') {
      throw new BadRequestException('Can only review delivered orders');
    }

    const { error } = await this.supabase
      .getClient()
      .from('order_reviews')
      .insert({
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
      seller_name: (order.seller_organization as any)?.name || 'Unknown Seller',
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
      estimated_delivery_date: order.estimated_delivery_date,
      actual_delivery_date: order.actual_delivery_date,
      items: orderItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total_price: item.total_price,
      })),
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

  private async getPreferences(
    buyerOrgId: string,
  ): Promise<PreferencesResponseDto> {
    const { data: preferences } = await this.supabase
      .getClient()
      .from('buyer_preferences')
      .select('*')
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (!preferences) {
      // Create default preferences
      const { data: newPreferences } = await this.supabase
        .getClient()
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
        .select()
        .single();

      return newPreferences;
    }

    return preferences;
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
          seller_organization:organizations!seller_org_id(name),
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

    return (
      favorites?.map((fav) => {
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
    const { data: favorites, error } = await this.supabase
      .getClient()
      .from('buyer_favorite_sellers')
      .select(
        `
        seller_org_id, created_at,
        seller:organizations!seller_org_id(
          id, name, logo_url, business_type, country,
          products(count)
        )
      `,
      )
      .eq('buyer_org_id', buyerOrgId)
      .order('created_at', { ascending: false });

    if (error)
      throw new BadRequestException(
        `Failed to fetch favorite sellers: ${error.message}`,
      );

    return (
      favorites?.map((fav) => {
        const seller = Array.isArray(fav.seller) ? fav.seller[0] : fav.seller;
        return {
          seller_org_id: fav.seller_org_id,
          seller_name: seller?.name || 'Unknown Seller',
          logo_url: seller?.logo_url,
          description: seller?.business_type,
          average_rating: undefined, // TODO: Calculate from reviews
          product_count: seller?.products?.[0]?.count || 0,
          created_at: fav.created_at,
        };
      }) || []
    );
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
        seller_name:
          (transaction.seller_organization as any)?.name || 'Unknown Seller',
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
          id, name, logo_url, location, country, is_verified
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
          location: seller?.location
            ? `${seller.location}${seller.country ? `, ${seller.country}` : ''}`
            : undefined,
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
          id, name, logo_url, location, country, is_verified, contact_email, contact_phone
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
        commenter_name:
          (comment.buyer_organization as any)?.name || 'Anonymous',
        commenter_avatar: (comment.buyer_organization as any)?.logo_url,
        content: comment.content,
        created_at: comment.created_at,
        time_ago: this.getTimeAgo(comment.created_at),
      })) || [];

    return {
      id: update.id,
      seller_org_id: update.seller_org_id,
      farm_name: seller?.name || 'Unknown Farm',
      farm_avatar: seller?.logo_url,
      location: seller?.location
        ? `${seller.location}${seller.country ? `, ${seller.country}` : ''}`
        : undefined,
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
        email: seller?.contact_email,
        phone: seller?.contact_phone,
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
      commenter_name: (comment.buyer_organization as any)?.name || 'Anonymous',
      commenter_avatar: (comment.buyer_organization as any)?.logo_url,
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
        commenter_name:
          (comment.buyer_organization as any)?.name || 'Anonymous',
        commenter_avatar: (comment.buyer_organization as any)?.logo_url,
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
