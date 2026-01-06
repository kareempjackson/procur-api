import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BuyersService } from './buyers.service';
import { Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountTypeGuard } from '../auth/guards/account-type.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AccountTypes } from '../auth/decorators/account-types.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import type { Response } from 'express';
import { AccountType } from '../common/enums/account-type.enum';
import {
  // Cart DTOs
  AddToCartDto,
  UpdateCartItemDto,
  CartResponseDto,
  CartCalculationDto,
  CartSummaryDto,

  // Marketplace DTOs
  MarketplaceProductQueryDto,
  MarketplaceProductDto,
  MarketplaceProductDetailDto,
  MarketplaceSellerDto,
  MarketplaceSellerQueryDto,
  MarketplaceStatsDto,

  // Request DTOs
  CreateProductRequestDto,
  UpdateProductRequestDto,
  ProductRequestQueryDto,
  ProductRequestResponseDto,
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

@ApiTags('Buyers')
@ApiBearerAuth('JWT-auth')
@Controller('buyers')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
@AccountTypes(AccountType.BUYER)
export class BuyersController {
  private readonly logger = new Logger(BuyersController.name);
  constructor(private readonly buyersService: BuyersService) {}

  // ==================== MARKETPLACE ENDPOINTS ====================

  @Get('marketplace/products')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Browse Marketplace Products',
    description:
      'Browse all available products from sellers with filtering and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: { $ref: '#/components/schemas/MarketplaceProductDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async browseProducts(
    @CurrentUser() user: UserContext,
    @Query() query: MarketplaceProductQueryDto,
  ) {
    return this.buyersService.browseProducts(query, user.organizationId);
  }

  @Get('marketplace/products/:id')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Get Product Details',
    description: 'Get detailed information about a specific product',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved successfully',
    type: MarketplaceProductDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async getProductDetail(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<MarketplaceProductDetailDto> {
    return this.buyersService.getProductDetail(productId, user.organizationId);
  }

  @Get('marketplace/sellers')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Browse Sellers',
    description:
      'Get list of available sellers/vendors with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Sellers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        sellers: {
          type: 'array',
          items: { $ref: '#/components/schemas/MarketplaceSellerDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getSellers(@Query() query: MarketplaceSellerQueryDto): Promise<{
    sellers: MarketplaceSellerDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.buyersService.getSellers(query);
  }

  @Get('marketplace/sellers/:id/products')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Get Seller Products',
    description: 'Get all products from a specific seller',
  })
  @ApiParam({ name: 'id', description: 'Seller ID' })
  @ApiResponse({
    status: 200,
    description: 'Seller products retrieved successfully',
  })
  async getSellerProducts(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) sellerId: string,
    @Query() query: MarketplaceProductQueryDto,
  ) {
    const modifiedQuery = { ...query, seller_id: sellerId };
    return this.buyersService.browseProducts(
      modifiedQuery,
      user.organizationId,
    );
  }

  @Get('marketplace/stats')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Get Marketplace Statistics',
    description: 'Get general marketplace statistics and popular categories',
  })
  @ApiResponse({
    status: 200,
    description: 'Marketplace stats retrieved successfully',
    type: MarketplaceStatsDto,
  })
  async getMarketplaceStats(): Promise<MarketplaceStatsDto> {
    return this.buyersService.getMarketplaceStats();
  }

  // ==================== SHOPPING CART ENDPOINTS ====================

  @Get('cart')
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Get Shopping Cart',
    description: 'Get current cart contents grouped by seller',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart retrieved successfully',
    type: CartResponseDto,
  })
  async getCart(@CurrentUser() user: UserContext): Promise<CartResponseDto> {
    return this.buyersService.getCart(user.organizationId!, user.id);
  }

  @Post('cart/items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Add Item to Cart',
    description: 'Add a product to the shopping cart',
  })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid product or insufficient stock',
  })
  async addToCart(
    @CurrentUser() user: UserContext,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<void> {
    return this.buyersService.addToCart(
      user.organizationId!,
      user.id,
      addToCartDto,
    );
  }

  @Patch('cart/items/:id')
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Update Cart Item',
    description: 'Update quantity of a cart item',
  })
  @ApiParam({ name: 'id', description: 'Cart Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Cart item updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Cart item not found' })
  @ApiBadRequestResponse({
    description: 'Invalid quantity or insufficient stock',
  })
  async updateCartItem(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() updateDto: UpdateCartItemDto,
  ): Promise<void> {
    return this.buyersService.updateCartItem(
      user.organizationId!,
      user.id,
      itemId,
      updateDto,
    );
  }

  @Delete('cart/items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Remove Item from Cart',
    description: 'Remove a specific item from the cart',
  })
  @ApiParam({ name: 'id', description: 'Cart Item ID' })
  @ApiResponse({
    status: 204,
    description: 'Item removed from cart successfully',
  })
  @ApiNotFoundResponse({ description: 'Cart item not found' })
  async removeFromCart(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.buyersService.removeFromCart(
      user.organizationId!,
      user.id,
      itemId,
    );
  }

  @Delete('cart')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Clear Cart',
    description: 'Remove all items from the cart',
  })
  @ApiResponse({
    status: 204,
    description: 'Cart cleared successfully',
  })
  async clearCart(@CurrentUser() user: UserContext): Promise<void> {
    return this.buyersService.clearCart(user.organizationId!, user.id);
  }

  @Get('cart/summary')
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Get Cart Summary',
    description: 'Get quick summary of cart contents',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart summary retrieved successfully',
    type: CartSummaryDto,
  })
  async getCartSummary(
    @CurrentUser() user: UserContext,
  ): Promise<CartSummaryDto> {
    return this.buyersService.getCartSummary(user.organizationId!, user.id);
  }

  @Post('cart/calculate')
  @RequirePermissions('manage_cart')
  @ApiOperation({
    summary: 'Calculate Cart Total',
    description: 'Calculate cart total with shipping and taxes',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart calculation completed successfully',
    type: CartResponseDto,
  })
  async calculateCart(
    @CurrentUser() user: UserContext,
    @Body() calculationDto: CartCalculationDto,
  ): Promise<CartResponseDto> {
    // For now, just return the regular cart - calculation logic can be added later
    return this.buyersService.getCart(user.organizationId!, user.id);
  }

  // ==================== PRODUCT REQUEST ENDPOINTS ====================

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('create_product_requests')
  @ApiOperation({
    summary: 'Create Product Request',
    description: 'Create a new product request (RFQ)',
  })
  @ApiResponse({
    status: 201,
    description: 'Product request created successfully',
    type: ProductRequestResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request data' })
  async createProductRequest(
    @CurrentUser() user: UserContext,
    @Body() createDto: CreateProductRequestDto,
  ): Promise<ProductRequestResponseDto> {
    return this.buyersService.createProductRequest(
      user.organizationId!,
      user.id,
      createDto,
    );
  }

  @Get('requests')
  @RequirePermissions('manage_product_requests')
  @ApiOperation({
    summary: 'List Product Requests',
    description: 'Get paginated list of buyer product requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Product requests retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProductRequestResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getProductRequests(
    @CurrentUser() user: UserContext,
    @Query() query: ProductRequestQueryDto,
  ) {
    return this.buyersService.getProductRequests(user.organizationId!, query);
  }

  @Get('requests/:id')
  @RequirePermissions('manage_product_requests')
  @ApiOperation({
    summary: 'Get Product Request',
    description: 'Get detailed information about a specific product request',
  })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Product request retrieved successfully',
    type: ProductRequestResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product request not found' })
  async getProductRequestById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<ProductRequestResponseDto> {
    return this.buyersService.getProductRequestById(
      user.organizationId!,
      requestId,
    );
  }

  @Patch('requests/:id')
  @RequirePermissions('manage_product_requests')
  @ApiOperation({
    summary: 'Update Product Request',
    description: 'Update a product request',
  })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Product request updated successfully',
    type: ProductRequestResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product request not found' })
  @ApiBadRequestResponse({
    description: 'Invalid update data or request is closed',
  })
  async updateProductRequest(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() updateDto: UpdateProductRequestDto,
  ): Promise<ProductRequestResponseDto> {
    return this.buyersService.updateProductRequest(
      user.organizationId!,
      requestId,
      updateDto,
    );
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_product_requests')
  @ApiOperation({
    summary: 'Delete Product Request',
    description: 'Cancel/delete a product request',
  })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 204,
    description: 'Product request deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Product request not found' })
  @ApiBadRequestResponse({ description: 'Cannot delete closed request' })
  async deleteProductRequest(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<void> {
    return this.buyersService.deleteProductRequest(
      user.organizationId!,
      requestId,
    );
  }

  @Get('requests/:id/quotes')
  @RequirePermissions('manage_product_requests')
  @ApiOperation({
    summary: 'Get Request Quotes',
    description: 'Get all quotes/responses for a product request',
  })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Request quotes retrieved successfully',
    type: [QuoteResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Product request not found' })
  async getRequestQuotes(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<QuoteResponseDto[]> {
    return this.buyersService.getRequestQuotes(user.organizationId!, requestId);
  }

  @Post('requests/:requestId/quotes/:quoteId/accept')
  @RequirePermissions('place_orders')
  @ApiOperation({
    summary: 'Accept Quote',
    description: 'Accept a seller quote and create an order',
  })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiParam({ name: 'quoteId', description: 'Quote ID' })
  @ApiResponse({
    status: 200,
    description: 'Quote accepted and order created successfully',
    type: BuyerOrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Request or quote not found' })
  @ApiBadRequestResponse({ description: 'Quote cannot be accepted' })
  async acceptQuote(
    @CurrentUser() user: UserContext,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() acceptDto: AcceptQuoteDto,
  ): Promise<BuyerOrderResponseDto> {
    return this.buyersService.acceptQuote(
      user.organizationId!,
      requestId,
      quoteId,
      acceptDto,
    );
  }

  // ==================== ORDER ENDPOINTS ====================

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('place_orders')
  @ApiOperation({
    summary: 'Create Order',
    description: 'Create a new order from cart or specific items',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: BuyerOrderResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid order data or insufficient stock',
  })
  async createOrder(
    @CurrentUser() user: UserContext,
    @Body() createDto: CreateOrderDto,
  ): Promise<BuyerOrderResponseDto> {
    return this.buyersService.createOrder(
      user.organizationId!,
      user.id,
      createDto,
    );
  }

  @Get('orders')
  @RequirePermissions('view_buyer_orders')
  @ApiOperation({
    summary: 'List Orders',
    description: 'Get paginated list of buyer orders',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/BuyerOrderResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getOrders(
    @CurrentUser() user: UserContext,
    @Query() query: BuyerOrderQueryDto,
  ) {
    return this.buyersService.getOrders(user.organizationId!, query);
  }

  @Get('orders/:id')
  @RequirePermissions('view_buyer_orders')
  @ApiOperation({
    summary: 'Get Order',
    description: 'Get detailed information about a specific order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: BuyerOrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getOrderById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<BuyerOrderResponseDto> {
    return this.buyersService.getOrderById(user.organizationId!, orderId);
  }

  @Get('orders/:id/invoice')
  @RequirePermissions('view_buyer_orders')
  @ApiOperation({
    summary: 'Download Order Invoice (PDF)',
    description: 'Generate and download a PDF invoice for an order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF invoice generated successfully',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async downloadOrderInvoice(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, invoiceNumber } =
      await this.buyersService.generateOrderInvoicePdf(
      user.organizationId!,
      orderId,
    );

    // Keep filename stable for users (prefer invoice number / order number)
    const filename = `procur-invoice-${invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  @Patch('orders/:id/cancel')
  @RequirePermissions('cancel_orders')
  @ApiOperation({
    summary: 'Cancel Order',
    description: 'Cancel a pending order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: BuyerOrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Order cannot be cancelled' })
  async cancelOrder(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() cancelDto: CancelOrderDto,
  ): Promise<BuyerOrderResponseDto> {
    // TODO: Implement cancelOrder in service
    throw new Error('Not implemented');
  }

  @Get('orders/:id/timeline')
  @RequirePermissions('view_buyer_orders')
  @ApiOperation({
    summary: 'Get Order Timeline',
    description: 'Get the timeline/history of an order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order timeline retrieved successfully',
    type: [OrderTimelineEventDto],
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getOrderTimeline(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<OrderTimelineEventDto[]> {
    // TODO: Implement getOrderTimeline in service
    throw new Error('Not implemented');
  }

  @Post('orders/:id/review')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('review_orders')
  @ApiOperation({
    summary: 'Review Order',
    description: 'Submit a review for a completed order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Order review submitted successfully',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order cannot be reviewed or already reviewed',
  })
  async reviewOrder(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() reviewDto: OrderReviewDto,
  ): Promise<void> {
    return this.buyersService.createOrderReview(
      user.organizationId!,
      orderId,
      reviewDto,
    );
  }

  @Get('orders/summary')
  @RequirePermissions('view_buyer_orders')
  @ApiOperation({
    summary: 'Get Order Summary',
    description: 'Get order statistics and summary',
  })
  @ApiResponse({
    status: 200,
    description: 'Order summary retrieved successfully',
    type: OrderSummaryDto,
  })
  async getOrderSummary(
    @CurrentUser() user: UserContext,
  ): Promise<OrderSummaryDto> {
    // TODO: Implement getOrderSummary in service
    throw new Error('Not implemented');
  }

  // ==================== PROFILE ENDPOINTS ====================

  @Get('profile')
  @RequirePermissions('manage_buyer_profile')
  @ApiOperation({
    summary: 'Get Buyer Profile',
    description: 'Get buyer profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: BuyerProfileResponseDto,
  })
  async getBuyerProfile(
    @CurrentUser() user: UserContext,
  ): Promise<BuyerProfileResponseDto> {
    return this.buyersService.getBuyerProfile(user.organizationId!);
  }

  @Get('addresses')
  @RequirePermissions('manage_addresses')
  @ApiOperation({
    summary: 'List Addresses',
    description: 'Get all saved addresses for the buyer',
  })
  @ApiResponse({
    status: 200,
    description: 'Addresses retrieved successfully',
    type: [AddressResponseDto],
  })
  async getAddresses(
    @CurrentUser() user: UserContext,
  ): Promise<AddressResponseDto[]> {
    this.logger.log(`GET /buyers/addresses buyer_org=${user.organizationId}`);
    return this.buyersService.getAddresses(user.organizationId!);
  }

  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_addresses')
  @ApiOperation({
    summary: 'Create Address',
    description: 'Add a new address to the buyer profile',
  })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
    type: AddressResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid address data' })
  async createAddress(
    @CurrentUser() user: UserContext,
    @Body() createDto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    this.logger.log(
      `POST /buyers/addresses buyer_org=${user.organizationId} city=${createDto?.city} street_present=${Boolean(createDto?.street_address)}`,
    );
    return this.buyersService.createAddress(user.organizationId!, createDto);
  }

  @Patch('addresses/:id')
  @RequirePermissions('manage_addresses')
  @ApiOperation({
    summary: 'Update Address',
    description: 'Update an existing address',
  })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
    type: AddressResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Address not found' })
  @ApiBadRequestResponse({ description: 'Invalid address data' })
  async updateAddress(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) addressId: string,
    @Body() updateDto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    // TODO: Implement updateAddress in service
    throw new Error('Not implemented');
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_addresses')
  @ApiOperation({
    summary: 'Delete Address',
    description: 'Delete an address from the buyer profile',
  })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({
    status: 204,
    description: 'Address deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Address not found' })
  async deleteAddress(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) addressId: string,
  ): Promise<void> {
    // TODO: Implement deleteAddress in service
    throw new Error('Not implemented');
  }

  @Get('preferences')
  @RequirePermissions('manage_buyer_profile')
  @ApiOperation({
    summary: 'Get Preferences',
    description: 'Get buyer preferences and settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
    type: PreferencesResponseDto,
  })
  async getPreferences(
    @CurrentUser() user: UserContext,
  ): Promise<PreferencesResponseDto> {
    return this.buyersService.getPreferences(user.organizationId!);
  }

  @Patch('preferences')
  @RequirePermissions('manage_buyer_profile')
  @ApiOperation({
    summary: 'Update Preferences',
    description: 'Update buyer preferences and settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: PreferencesResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid preferences data' })
  async updatePreferences(
    @CurrentUser() user: UserContext,
    @Body() updateDto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    return this.buyersService.updatePreferences(
      user.organizationId!,
      updateDto,
    );
  }

  // ==================== FAVORITES ENDPOINTS ====================

  @Get('favorites/products')
  @RequirePermissions('manage_favorites')
  @ApiOperation({
    summary: 'Get Favorite Products',
    description: 'Get all favorite products',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorite products retrieved successfully',
    type: [FavoriteProductDto],
  })
  async getFavoriteProducts(
    @CurrentUser() user: UserContext,
  ): Promise<FavoriteProductDto[]> {
    return this.buyersService.getFavoriteProducts(user.organizationId!);
  }

  @Post('favorites/products/:id')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_favorites')
  @ApiOperation({
    summary: 'Add Product to Favorites',
    description: 'Add a product to favorites list',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 201,
    description: 'Product added to favorites successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async addProductToFavorites(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.buyersService.addProductToFavorites(
      user.organizationId!,
      productId,
    );
  }

  @Delete('favorites/products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_favorites')
  @ApiOperation({
    summary: 'Remove Product from Favorites',
    description: 'Remove a product from favorites list',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 204,
    description: 'Product removed from favorites successfully',
  })
  async removeProductFromFavorites(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.buyersService.removeProductFromFavorites(
      user.organizationId!,
      productId,
    );
  }

  @Get('favorites/sellers')
  @RequirePermissions('manage_favorites')
  @ApiOperation({
    summary: 'Get Favorite Sellers',
    description: 'Get all favorite sellers',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorite sellers retrieved successfully',
    type: [FavoriteSellerDto],
  })
  async getFavoriteSellers(
    @CurrentUser() user: UserContext,
  ): Promise<FavoriteSellerDto[]> {
    return this.buyersService.getFavoriteSellers(user.organizationId!);
  }

  @Post('favorites/sellers/:id')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_favorites')
  @ApiOperation({
    summary: 'Add Seller to Favorites',
    description: 'Add a seller to favorites list',
  })
  @ApiParam({ name: 'id', description: 'Seller ID' })
  @ApiResponse({
    status: 201,
    description: 'Seller added to favorites successfully',
  })
  @ApiNotFoundResponse({ description: 'Seller not found' })
  async addSellerToFavorites(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) sellerId: string,
  ): Promise<void> {
    return this.buyersService.addSellerToFavorites(
      user.organizationId!,
      sellerId,
    );
  }

  @Delete('favorites/sellers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_favorites')
  @ApiOperation({
    summary: 'Remove Seller from Favorites',
    description: 'Remove a seller from favorites list',
  })
  @ApiParam({ name: 'id', description: 'Seller ID' })
  @ApiResponse({
    status: 204,
    description: 'Seller removed from favorites successfully',
  })
  async removeSellerFromFavorites(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) sellerId: string,
  ): Promise<void> {
    return this.buyersService.removeSellerFromFavorites(
      user.organizationId!,
      sellerId,
    );
  }

  // ==================== TRANSACTION ENDPOINTS ====================

  @Get('transactions')
  @RequirePermissions('view_buyer_transactions')
  @ApiOperation({
    summary: 'List Transactions',
    description: 'Get paginated list of buyer transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: { $ref: '#/components/schemas/BuyerTransactionResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getTransactions(
    @CurrentUser() user: UserContext,
    @Query() query: BuyerTransactionQueryDto,
  ) {
    return this.buyersService.getTransactions(user.organizationId!, query);
  }

  @Get('transactions/:id')
  @RequirePermissions('view_buyer_transactions')
  @ApiOperation({
    summary: 'Get Transaction',
    description: 'Get detailed information about a specific transaction',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: BuyerTransactionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  async getTransactionById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<BuyerTransactionResponseDto> {
    // TODO: Implement getTransactionById in service
    throw new Error('Not implemented');
  }

  @Get('transactions/summary')
  @RequirePermissions('view_buyer_transactions')
  @ApiOperation({
    summary: 'Get Transaction Summary',
    description: 'Get transaction summary and analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction summary retrieved successfully',
    type: BuyerTransactionSummaryDto,
  })
  async getTransactionSummary(
    @CurrentUser() user: UserContext,
  ): Promise<BuyerTransactionSummaryDto> {
    // TODO: Implement getTransactionSummary in service
    throw new Error('Not implemented');
  }

  @Post('transactions/:id/dispute')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('view_buyer_transactions')
  @ApiOperation({
    summary: 'Create Dispute',
    description: 'Create a dispute for a transaction',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 201,
    description: 'Dispute created successfully',
    type: DisputeResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiBadRequestResponse({ description: 'Transaction cannot be disputed' })
  async createDispute(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() createDto: CreateDisputeDto,
  ): Promise<DisputeResponseDto> {
    // TODO: Implement createDispute in service
    throw new Error('Not implemented');
  }

  // ==================== HARVEST UPDATES ENDPOINTS ====================

  @Get('harvest-updates')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Get Harvest Updates Feed',
    description:
      'Get social feed of harvest updates from sellers with likes, comments, and engagement',
  })
  @ApiResponse({
    status: 200,
    description: 'Harvest updates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: { $ref: '#/components/schemas/HarvestUpdateDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getHarvestUpdates(
    @CurrentUser() user: UserContext,
    @Query() query: HarvestUpdatesQueryDto,
  ) {
    return this.buyersService.getHarvestUpdates(query, user.organizationId);
  }

  @Get('harvest-updates/:id')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Get Harvest Update Detail',
    description: 'Get detailed information about a specific harvest update',
  })
  @ApiParam({ name: 'id', description: 'Harvest Update ID' })
  @ApiResponse({
    status: 200,
    description: 'Harvest update details retrieved successfully',
    type: HarvestUpdateDetailDto,
  })
  @ApiNotFoundResponse({ description: 'Harvest update not found' })
  async getHarvestUpdateDetail(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) harvestId: string,
  ): Promise<HarvestUpdateDetailDto> {
    return this.buyersService.getHarvestUpdateDetail(
      harvestId,
      user.organizationId,
    );
  }

  @Post('harvest-updates/:id/like')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Toggle Like on Harvest Update',
    description: 'Like or unlike a harvest update',
  })
  @ApiParam({ name: 'id', description: 'Harvest Update ID' })
  @ApiResponse({
    status: 200,
    description: 'Like toggled successfully',
  })
  @ApiNotFoundResponse({ description: 'Harvest update not found' })
  async toggleHarvestLike(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) harvestId: string,
    @Body() toggleDto: ToggleHarvestLikeDto,
  ): Promise<void> {
    return this.buyersService.toggleHarvestLike(
      user.organizationId!,
      user.id,
      harvestId,
      toggleDto.is_like,
    );
  }

  @Get('harvest-updates/:id/comments')
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Get Harvest Update Comments',
    description: 'Get all comments for a specific harvest update',
  })
  @ApiParam({ name: 'id', description: 'Harvest Update ID' })
  @ApiResponse({
    status: 200,
    description: 'Comments retrieved successfully',
    type: [BuyerHarvestCommentDto],
  })
  async getHarvestComments(
    @Param('id', ParseUUIDPipe) harvestId: string,
  ): Promise<BuyerHarvestCommentDto[]> {
    return this.buyersService.getHarvestComments(harvestId);
  }

  @Post('harvest-updates/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('browse_marketplace')
  @ApiOperation({
    summary: 'Comment on Harvest Update',
    description: 'Add a comment to a harvest update',
  })
  @ApiParam({ name: 'id', description: 'Harvest Update ID' })
  @ApiResponse({
    status: 201,
    description: 'Comment created successfully',
    type: BuyerHarvestCommentDto,
  })
  @ApiNotFoundResponse({ description: 'Harvest update not found' })
  async createHarvestComment(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) harvestId: string,
    @Body() commentDto: CreateBuyerHarvestCommentDto,
  ): Promise<BuyerHarvestCommentDto> {
    return this.buyersService.createHarvestComment(
      user.organizationId!,
      user.id,
      harvestId,
      commentDto,
    );
  }

  @Post('harvest-updates/:id/request')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('create_product_requests')
  @ApiOperation({
    summary: 'Request Product from Harvest',
    description: 'Create a product request against a specific harvest update',
  })
  @ApiParam({ name: 'id', description: 'Harvest Update ID' })
  @ApiResponse({
    status: 201,
    description: 'Harvest request created successfully',
  })
  @ApiNotFoundResponse({ description: 'Harvest update not found' })
  async createHarvestRequest(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) harvestId: string,
    @Body() requestDto: CreateBuyerHarvestRequestDto,
  ): Promise<void> {
    return this.buyersService.createHarvestRequest(
      user.organizationId!,
      user.id,
      harvestId,
      requestDto,
    );
  }
}
