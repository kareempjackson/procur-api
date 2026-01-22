import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { SellersService } from './sellers.service';
import { BankInfoService } from '../bank-info/bank-info.service';
import { BuyersService } from '../buyers/buyers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountTypeGuard } from '../auth/guards/account-type.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AccountTypes } from '../auth/decorators/account-types.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { AccountType } from '../common/enums/account-type.enum';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponseDto,
  ProductImageDto,
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
  PublishPostDto,
  DashboardMetricsDto,
  SalesAnalyticsDto,
  ProductAnalyticsDto,
  AnalyticsQueryDto,
  ReportGenerationDto,
  ReportResponseDto,
  SellerHomeResponseDto,
  CreateSellerHarvestDto,
  HarvestRequestResponseDto,
  HarvestFeedItemDto,
  SellerHarvestCommentDto,
  CreateSellerHarvestCommentDto,
  CreateHarvestBuyerRequestDto,
  HarvestBuyerRequestDto,
  AcknowledgeHarvestBuyerRequestDto,
  CreateFarmVisitRequestDto,
  FarmVisitRequestDto,
  SellerCatalogProductDto,
  BuyerReviewDto,
} from './dto';
import { SellerStatusUpdateRequestDto } from './dto/order-status-request.dto';

@ApiTags('Sellers')
@ApiBearerAuth('JWT-auth')
@Controller('sellers')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
@AccountTypes(AccountType.SELLER)
export class SellersController {
  constructor(
    private readonly sellersService: SellersService,
    private readonly bankInfoService: BankInfoService,
    private readonly buyersService: BuyersService,
  ) {}

  // ==================== PRODUCT MANAGEMENT ====================

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_products')
  @ApiOperation({
    summary: 'Create Product',
    description: 'Create a new product in the seller catalog',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid product data' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async createProduct(
    @CurrentUser() user: UserContext,
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.sellersService.createProduct(
      user.organizationId!,
      createProductDto,
      user.id,
    );
  }

  @Get('products')
  @RequirePermissions('view_products')
  @ApiOperation({
    summary: 'List Products',
    description:
      'Get paginated list of seller products with filtering and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProductResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getProducts(
    @CurrentUser() user: UserContext,
    @Query() query: ProductQueryDto,
  ) {
    return this.sellersService.getProducts(user.organizationId!, query);
  }

  @Get('catalog-products')
  @RequirePermissions('view_products')
  @ApiOperation({
    summary: 'List catalog products available to sellers',
    description:
      'Returns active admin catalog products (with optional price ranges) that sellers can reference when creating products.',
  })
  @ApiResponse({
    status: 200,
    description: 'Catalog products retrieved successfully',
    type: [SellerCatalogProductDto],
  })
  async getCatalogProducts(
    @CurrentUser() user: UserContext,
  ): Promise<SellerCatalogProductDto[]> {
    return this.sellersService.listCatalogProducts(user.organizationId!);
  }

  @Get('products/:id')
  @RequirePermissions('view_products')
  @ApiOperation({
    summary: 'Get Product',
    description: 'Get detailed information about a specific product',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async getProductById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<ProductResponseDto> {
    return this.sellersService.getProductById(user.organizationId!, productId);
  }

  @Patch('products/:id')
  @RequirePermissions('manage_products')
  @ApiOperation({
    summary: 'Update Product',
    description: 'Update product information',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  async updateProduct(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.sellersService.updateProduct(
      user.organizationId!,
      productId,
      updateProductDto,
      user.id,
    );
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_products')
  @ApiOperation({
    summary: 'Delete Product',
    description: 'Delete a product from the catalog',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 204,
    description: 'Product deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async deleteProduct(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return this.sellersService.deleteProduct(user.organizationId!, productId);
  }

  @Post('products/:id/images')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_products')
  @ApiOperation({
    summary: 'Add Product Image',
    description: 'Add an image to a product',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 201,
    description: 'Product image added successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async addProductImage(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() imageDto: ProductImageDto,
  ): Promise<void> {
    return this.sellersService.addProductImage(
      user.organizationId!,
      productId,
      imageDto,
    );
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_products')
  @ApiOperation({
    summary: 'Delete Product Image',
    description: 'Remove an image from a product',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiParam({ name: 'imageId', description: 'Image ID' })
  @ApiResponse({
    status: 204,
    description: 'Product image deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Product or image not found' })
  async deleteProductImage(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.sellersService.deleteProductImage(
      user.organizationId!,
      productId,
      imageId,
    );
  }

  // ==================== ORDER MANAGEMENT ====================

  @Get('orders')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'List Orders',
    description: 'Get paginated list of orders with filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getOrders(
    @CurrentUser() user: UserContext,
    @Query() query: OrderQueryDto,
  ) {
    return this.sellersService.getOrders(user.organizationId!, query);
  }

  @Get('orders/:id')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Get Order',
    description: 'Get detailed information about a specific order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getOrderById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<OrderResponseDto> {
    return this.sellersService.getOrderById(user.organizationId!, orderId);
  }

  @Get('orders/:id/invoice')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Download Order Receipt (PDF)',
    description:
      'Generate and download a PDF receipt/invoice for an order (seller copy).',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF generated successfully',
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
    // Authorize as seller first (ensures the order belongs to this seller org)
    const order = await this.sellersService.getOrderById(
      user.organizationId!,
      orderId,
    );

    // Reuse the existing PDF invoice generator (single source of truth)
    const buyerOrgId = (order as any)?.buyer_org_id as string | undefined;
    if (!buyerOrgId) {
      throw new BadRequestException('Order is missing buyer organization ID');
    }

    // Delivery fee (seller share) comes from admin-controlled platform fee config.
    const fees = await this.sellersService.getPlatformFeesConfig();
    const configuredBuyerShare = Number(fees.buyerDeliveryShare || 0);
    const configuredSellerShare = Number(fees.sellerDeliveryShare || 0);
    const configuredFlatDelivery = Number(fees.deliveryFlatFee || 0);

    const shipping = (order as any)?.shipping_address as any;
    const hasShippingAddress = Boolean(
      shipping &&
        (shipping.line1 ||
          shipping.address_line1 ||
          shipping.street ||
          shipping.street_address),
    );

    const fullDeliveryFee = hasShippingAddress
      ? configuredBuyerShare + configuredSellerShare || configuredFlatDelivery
      : 0;

    const buyerDeliveryAmount = hasShippingAddress
      ? configuredBuyerShare || Number((fullDeliveryFee / 2).toFixed(2))
      : 0;

    const sellerDeliveryAmount = hasShippingAddress
      ? Number((fullDeliveryFee - buyerDeliveryAmount).toFixed(2))
      : 0;

    const { buffer, invoiceNumber } =
      await this.buyersService.generateOrderInvoicePdf(buyerOrgId, orderId, {
        billedToCompanyName:
          (order as any)?.buyer_info?.organization_name ||
          (order as any)?.buyer_info?.business_name ||
          '',
        deliveryFeeAmountOverride: sellerDeliveryAmount,
        totalsMode: 'seller',
      });

    // Keep filename stable for users (prefer invoice number / order number)
    const filename = `procur-receipt-${invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  @Patch('orders/:id/accept')
  @RequirePermissions('accept_orders')
  @ApiOperation({
    summary: 'Accept Order',
    description: 'Accept a pending order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order accepted successfully',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Order cannot be accepted' })
  async acceptOrder(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() acceptOrderDto: AcceptOrderDto,
  ): Promise<OrderResponseDto> {
    return this.sellersService.acceptOrder(
      user.organizationId!,
      orderId,
      acceptOrderDto,
      user.id,
    );
  }

  @Patch('orders/:id/reject')
  @RequirePermissions('accept_orders')
  @ApiOperation({
    summary: 'Reject Order',
    description: 'Reject a pending order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order rejected successfully',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Order cannot be rejected' })
  async rejectOrder(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() rejectOrderDto: RejectOrderDto,
  ): Promise<OrderResponseDto> {
    return this.sellersService.rejectOrder(
      user.organizationId!,
      orderId,
      rejectOrderDto,
      user.id,
    );
  }

  @Patch('orders/:id/status')
  @RequirePermissions('manage_orders')
  @ApiOperation({
    summary: 'Update Order Status',
    description: 'Update the status of an order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Invalid status update' })
  async updateOrderStatus(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.sellersService.updateOrderStatus(
      user.organizationId!,
      orderId,
      updateOrderStatusDto,
      user.id,
    );
  }

  @Post('orders/:id/review-buyer')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_orders')
  @ApiOperation({
    summary: 'Rate buyer for order',
    description:
      'Submit a rating for the buyer after an order has been delivered.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Buyer review submitted successfully',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order cannot be reviewed or already reviewed',
  })
  async reviewBuyer(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() reviewDto: BuyerReviewDto,
  ): Promise<void> {
    await this.sellersService.createBuyerReview(
      user.organizationId!,
      orderId,
      reviewDto,
      user.id,
    );
  }

  @Get('orders/:id/timeline')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Get Order Timeline',
    description: 'Get the timeline/history of an order',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order timeline retrieved successfully',
    type: [Object],
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getOrderTimeline(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
  ) {
    return this.sellersService.getOrderTimeline(user.organizationId!, orderId);
  }

  @Post('orders/:id/status-requests')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Request order status update',
    description:
      'Allow a seller to request a status change (e.g. to shipped) without directly updating the order status.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Status update request recorded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async requestOrderStatusUpdate(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() body: SellerStatusUpdateRequestDto,
  ): Promise<{ success: boolean }> {
    return this.sellersService.requestOrderStatusUpdate(
      user.organizationId!,
      orderId,
      body,
      user.id,
    );
  }

  // ==================== TRANSACTION MANAGEMENT ====================

  @Get('transactions')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'List Transactions',
    description: 'Get paginated list of transactions with filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: { $ref: '#/components/schemas/TransactionResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getTransactions(
    @CurrentUser() user: UserContext,
    @Query() query: TransactionQueryDto,
  ) {
    return this.sellersService.getTransactions(user.organizationId!, query);
  }

  @Get('transactions/summary')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'Get Transaction Summary',
    description: 'Get transaction summary and analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction summary retrieved successfully',
    type: TransactionSummaryDto,
  })
  async getTransactionSummary(
    @CurrentUser() user: UserContext,
    @Query() query: AnalyticsQueryDto,
  ): Promise<TransactionSummaryDto> {
    return this.sellersService.getTransactionSummary(
      user.organizationId!,
      query,
    );
  }

  @Get('transactions/:id')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'Get Transaction',
    description: 'Get detailed information about a specific transaction',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  async getTransactionById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<TransactionResponseDto> {
    return this.sellersService.getTransactionById(
      user.organizationId!,
      transactionId,
    );
  }

  // ==================== SCHEDULED POSTS ====================

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_posts')
  @ApiOperation({
    summary: 'Schedule Post',
    description: 'Schedule a new social media post',
  })
  @ApiResponse({
    status: 201,
    description: 'Post scheduled successfully',
    type: ScheduledPostResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid post data' })
  async createScheduledPost(
    @CurrentUser() user: UserContext,
    @Body() createPostDto: CreateScheduledPostDto,
  ): Promise<ScheduledPostResponseDto> {
    return this.sellersService.createScheduledPost(
      user.organizationId!,
      createPostDto,
      user.id,
    );
  }

  @Get('posts')
  @RequirePermissions('view_posts')
  @ApiOperation({
    summary: 'List Scheduled Posts',
    description: 'Get paginated list of scheduled posts with filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled posts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        posts: {
          type: 'array',
          items: { $ref: '#/components/schemas/ScheduledPostResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getScheduledPosts(
    @CurrentUser() user: UserContext,
    @Query() query: PostQueryDto,
  ) {
    return this.sellersService.getScheduledPosts(user.organizationId!, query);
  }

  @Get('posts/:id')
  @RequirePermissions('view_posts')
  @ApiOperation({
    summary: 'Get Scheduled Post',
    description: 'Get detailed information about a specific scheduled post',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled post retrieved successfully',
    type: ScheduledPostResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Scheduled post not found' })
  async getScheduledPostById(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) postId: string,
  ): Promise<ScheduledPostResponseDto> {
    return this.sellersService.getScheduledPostById(
      user.organizationId!,
      postId,
    );
  }

  @Patch('posts/:id')
  @RequirePermissions('manage_posts')
  @ApiOperation({
    summary: 'Update Scheduled Post',
    description: 'Update a scheduled post',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled post updated successfully',
    type: ScheduledPostResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Scheduled post not found' })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  async updateScheduledPost(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() updatePostDto: UpdateScheduledPostDto,
  ): Promise<ScheduledPostResponseDto> {
    return this.sellersService.updateScheduledPost(
      user.organizationId!,
      postId,
      updatePostDto,
      user.id,
    );
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_posts')
  @ApiOperation({
    summary: 'Delete Scheduled Post',
    description: 'Cancel/delete a scheduled post',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 204,
    description: 'Scheduled post deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Scheduled post not found' })
  async deleteScheduledPost(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    return this.sellersService.deleteScheduledPost(
      user.organizationId!,
      postId,
    );
  }

  @Post('posts/:id/publish')
  @RequirePermissions('manage_posts')
  @ApiOperation({
    summary: 'Publish Post',
    description: 'Publish a scheduled post immediately',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Post published successfully',
    type: ScheduledPostResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Scheduled post not found' })
  async publishPost(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() publishPostDto: PublishPostDto,
  ): Promise<ScheduledPostResponseDto> {
    return this.sellersService.publishPost(user.organizationId!, postId);
  }

  // ==================== ANALYTICS & REPORTS ====================

  @Get('analytics/dashboard')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Get Dashboard Metrics',
    description: 'Get key metrics for the seller dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardMetricsDto,
  })
  async getDashboardMetrics(
    @CurrentUser() user: UserContext,
    @Query() query: AnalyticsQueryDto,
  ): Promise<DashboardMetricsDto> {
    return this.sellersService.getDashboardMetrics(user.organizationId!, query);
  }

  @Get('analytics/sales')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Get Sales Analytics',
    description: 'Get detailed sales analytics and trends',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales analytics retrieved successfully',
    type: SalesAnalyticsDto,
  })
  async getSalesAnalytics(
    @CurrentUser() user: UserContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.sellersService.getSalesAnalytics(user.organizationId!, query);
  }

  @Get('analytics/products')
  @RequirePermissions('view_orders')
  @ApiOperation({
    summary: 'Get Product Analytics',
    description: 'Get product performance analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Product analytics retrieved successfully',
    type: ProductAnalyticsDto,
  })
  async getProductAnalytics(
    @CurrentUser() user: UserContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.sellersService.getProductAnalytics(user.organizationId!, query);
  }

  @Post('reports/sales')
  @RequirePermissions('manage_seller_analytics')
  @ApiOperation({
    summary: 'Generate Sales Report',
    description: 'Generate and download sales report',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales report generation started',
    type: ReportResponseDto,
  })
  async generateSalesReport(
    @CurrentUser() user: UserContext,
    @Body() reportDto: ReportGenerationDto,
  ) {
    // Implementation would generate report and return download link
    return {
      message: 'Sales report generation endpoint - implementation pending',
    };
  }

  @Post('reports/inventory')
  @RequirePermissions('manage_seller_analytics')
  @ApiOperation({
    summary: 'Generate Inventory Report',
    description: 'Generate and download inventory report',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory report generation started',
    type: ReportResponseDto,
  })
  async generateInventoryReport(
    @CurrentUser() user: UserContext,
    @Body() reportDto: ReportGenerationDto,
  ) {
    // Implementation would generate inventory report
    return {
      message: 'Inventory report generation endpoint - implementation pending',
    };
  }

  // ==================== SELLER HOME (AGGREGATED) ====================

  @Get('home')
  @RequirePermissions('view_products')
  @ApiOperation({
    summary: 'Seller Home Aggregate',
    description:
      'Aggregated data for seller dashboard including metrics, products, orders, and buyer requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller home data retrieved successfully',
    type: SellerHomeResponseDto,
  })
  async getSellerHome(
    @CurrentUser() user: UserContext,
    @Query() query: AnalyticsQueryDto,
  ): Promise<SellerHomeResponseDto> {
    return this.sellersService.getSellerHome(user.organizationId!, query);
  }

  // ==================== INSIGHTS ====================

  @Get('insights')
  @RequirePermissions('view_products')
  @ApiOperation({
    summary: 'Get Seller Insights',
    description:
      'Returns recommended actions and alerts for the seller dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Insights retrieved',
    type: [/* SellerInsightDto */ Object],
  })
  async getSellerInsights(@CurrentUser() user: UserContext) {
    return this.sellersService.getSellerInsights(user.organizationId!);
  }

  @Post('insights/:id/execute')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Execute Seller Insight Action',
    description: 'Executes the action associated with a seller insight',
  })
  @ApiParam({ name: 'id', description: 'Insight ID' })
  @ApiResponse({ status: 200, description: 'Action executed' })
  async executeSellerInsight(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.sellersService.executeSellerInsight(user.organizationId!, id);
  }

  // ==================== HARVEST REQUESTS ====================

  @Post('harvest-request')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Create Harvest Request',
    description:
      'Sellers can post upcoming harvest info and what they are planting next',
  })
  @ApiResponse({
    status: 201,
    description: 'Harvest request created',
    type: HarvestRequestResponseDto,
  })
  async createHarvestRequest(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateSellerHarvestDto,
  ): Promise<HarvestRequestResponseDto> {
    return this.sellersService.createHarvestRequest(
      user.organizationId!,
      dto,
      user.id,
    );
  }

  @Get('harvest-feed')
  @RequirePermissions('view_products')
  @ApiOperation({
    summary: 'Get Harvest Feed',
    description:
      'Returns recent harvest updates with comments and buyer requests',
  })
  @ApiResponse({ status: 200, type: [HarvestFeedItemDto] })
  async getHarvestFeed(
    @CurrentUser() user: UserContext,
  ): Promise<HarvestFeedItemDto[]> {
    // Scope to updates created by the currently logged-in seller user (not other
    // users in the same seller org).
    return this.sellersService.getHarvestFeed(user.organizationId!, user.id);
  }

  @Post('harvest/:harvestId/comments')
  @RequirePermissions('manage_product_requests')
  @ApiOperation({
    summary: 'Add Comment to Harvest',
    description: 'Buyer comments on a harvest update',
  })
  @ApiParam({ name: 'harvestId', description: 'Harvest ID' })
  @ApiResponse({ status: 201, type: SellerHarvestCommentDto })
  async addHarvestComment(
    @CurrentUser() user: UserContext,
    @Param('harvestId', ParseUUIDPipe) harvestId: string,
    @Body() dto: CreateSellerHarvestCommentDto,
  ): Promise<SellerHarvestCommentDto> {
    // NOTE: Route is under sellers but permission is buyer-side; guard ensures account type
    return this.sellersService.addHarvestComment(
      user.organizationId!,
      user.id,
      harvestId,
      dto,
    );
  }

  @Post('harvest/:harvestId/requests')
  @RequirePermissions('create_product_requests')
  @ApiOperation({
    summary: 'Create Buyer Request for Harvest',
    description: 'Buyer requests a quantity from a specific harvest update',
  })
  @ApiParam({ name: 'harvestId', description: 'Harvest ID' })
  @ApiResponse({ status: 201, type: HarvestBuyerRequestDto })
  async createHarvestBuyerRequest(
    @CurrentUser() user: UserContext,
    @Param('harvestId', ParseUUIDPipe) harvestId: string,
    @Body() dto: CreateHarvestBuyerRequestDto,
  ): Promise<HarvestBuyerRequestDto> {
    return this.sellersService.createHarvestBuyerRequest(
      user.organizationId!,
      user.id,
      harvestId,
      dto,
    );
  }

  @Patch('harvest/requests/:requestId/acknowledge')
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Acknowledge Buyer Request',
    description:
      'Seller acknowledges whether they can fulfill a harvest request',
  })
  @ApiParam({ name: 'requestId', description: 'Harvest buyer request ID' })
  @ApiResponse({ status: 200, type: HarvestBuyerRequestDto })
  async acknowledgeHarvestBuyerRequest(
    @CurrentUser() user: UserContext,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: AcknowledgeHarvestBuyerRequestDto,
  ): Promise<HarvestBuyerRequestDto> {
    return this.sellersService.acknowledgeHarvestBuyerRequest(
      user.organizationId!,
      requestId,
      user.id,
      dto,
    );
  }

  // ==================== FARM VISIT REQUESTS ====================

  @Post('farm-visit-requests')
  @ApiOperation({
    summary: 'Book farm visit for verification',
    description:
      'Allow a seller to request a farm visit so an admin can verify their farm on-site.',
  })
  @ApiResponse({
    status: 201,
    description: 'Farm visit request created',
    type: FarmVisitRequestDto,
  })
  async createFarmVisitRequest(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateFarmVisitRequestDto,
  ): Promise<FarmVisitRequestDto> {
    return (this.sellersService as any).createFarmVisitRequest(
      user.organizationId!,
      user.id,
      dto,
    );
  }

  @Get('farm-visit-requests/latest')
  @ApiOperation({
    summary: 'Get latest farm visit request for this seller',
    description:
      'Returns the most recent farm visit request so the seller can see its status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest farm visit request retrieved successfully',
    type: FarmVisitRequestDto,
  })
  async getLatestFarmVisitRequest(
    @CurrentUser() user: UserContext,
  ): Promise<FarmVisitRequestDto | null> {
    return (this.sellersService as any).getLatestFarmVisitRequest(
      user.organizationId!,
    );
  }

  // ==================== BANK INFO / PAYOUT SETTINGS ====================

  @Get('bank-info')
  @ApiOperation({
    summary: 'Get masked bank information for this seller',
    description:
      'Returns masked payout bank information for the current seller organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bank information retrieved successfully',
  })
  async getBankInfo(@CurrentUser() user: UserContext): Promise<{
    account_name: string | null;
    bank_name: string | null;
    account_last4: string | null;
    bank_branch: string | null;
    has_bank_info: boolean;
  }> {
    if (!user.organizationId) {
      throw new BadRequestException('Missing organization context');
    }
    return this.bankInfoService.getMaskedBankInfo(user.organizationId);
  }

  // ==================== PAYOUTS & BALANCE ====================

  @Get('balance')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'Get Seller Balance',
    description: 'Get current available and pending balance for the seller',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
  })
  async getBalance(@CurrentUser() user: UserContext) {
    return await this.sellersService.getSellerBalance(user.organizationId!);
  }

  @Get('payouts')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'List Payouts',
    description: 'Get paginated list of completed payouts for the seller',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Payouts retrieved successfully',
  })
  async getPayouts(
    @CurrentUser() user: UserContext,
    @Query() query: { page?: number; limit?: number; status?: string },
  ) {
    return await this.sellersService.getSellerPayouts(
      user.organizationId!,
      query,
    );
  }

  @Get('payouts/settings')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'Get Payout Settings',
    description: 'Get minimum payout threshold and schedule info',
  })
  @ApiResponse({
    status: 200,
    description: 'Payout settings retrieved successfully',
  })
  async getPayoutSettings(@CurrentUser() user: UserContext) {
    return await this.sellersService.getPayoutSettings(user.organizationId!);
  }

  @Get('credits/transactions')
  @RequirePermissions('view_transactions')
  @ApiOperation({
    summary: 'Get Credit Transaction History',
    description: "Get the seller's credit/debit transaction history",
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Credit transactions retrieved successfully',
  })
  async getCreditTransactions(
    @CurrentUser() user: UserContext,
    @Query() query: { page?: number; limit?: number },
  ) {
    return await this.sellersService.getSellerCreditTransactions(
      user.organizationId!,
      query,
    );
  }

  // ==================== PRODUCT REQUESTS ENDPOINTS ====================

  @Get('product-requests')
  @ApiOperation({
    summary: 'Get Product Requests',
    description: 'Get all product requests (RFQs) visible to this seller',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Product requests retrieved successfully',
  })
  async getProductRequests(
    @CurrentUser() user: UserContext,
    @Query() query: any,
  ) {
    return this.sellersService.getProductRequests(user.organizationId!, query);
  }

  @Get('product-requests/:id')
  @ApiOperation({
    summary: 'Get Product Request Detail',
    description: 'Get detailed information about a specific product request',
  })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Product request retrieved successfully',
  })
  @ApiNotFoundResponse({ description: 'Product request not found' })
  @ApiForbiddenResponse({ description: 'Access denied to this request' })
  async getProductRequestDetail(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.sellersService.getProductRequestDetail(
      user.organizationId!,
      requestId,
    );
  }

  @Post('product-requests/:id/quotes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('submit_quotes')
  @ApiOperation({
    summary: 'Submit Quote',
    description: 'Submit a quote/response to a product request',
  })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 201,
    description: 'Quote submitted successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid quote data or request no longer accepting quotes',
  })
  @ApiNotFoundResponse({ description: 'Product request not found' })
  @ApiForbiddenResponse({ description: 'Access denied to this request' })
  async createQuote(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() createDto: any,
  ) {
    return this.sellersService.createQuote(
      user.organizationId!,
      requestId,
      createDto,
      user.id,
    );
  }

  // ==================== PAYOUT REQUESTS ====================

  @Post('payouts/request')
  @ApiOperation({
    summary: 'Request a payout',
    description:
      'Submit a request to withdraw funds from the available balance. Minimum payout is $100.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payout request submitted successfully',
  })
  @ApiBadRequestResponse({
    description: 'Insufficient balance or pending request already exists',
  })
  async requestPayout(
    @CurrentUser() user: UserContext,
    @Body() body: { amount?: number; note?: string },
  ) {
    return await this.sellersService.requestPayout(user.organizationId!, body);
  }

  @Get('payouts/requests')
  @ApiOperation({
    summary: 'Get payout requests',
    description: 'Get a paginated list of payout requests for the seller.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getPayoutRequests(
    @CurrentUser() user: UserContext,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return await this.sellersService.getPayoutRequests(user.organizationId!, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
  }

  @Delete('payouts/requests/:id')
  @ApiOperation({
    summary: 'Cancel a payout request',
    description: 'Cancel a pending payout request.',
  })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  async cancelPayoutRequest(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return await this.sellersService.cancelPayoutRequest(
      user.organizationId!,
      requestId,
    );
  }
}
