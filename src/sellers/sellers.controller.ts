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
import { SellersService } from './sellers.service';
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
} from './dto';

@ApiTags('Sellers')
@ApiBearerAuth('JWT-auth')
@Controller('sellers')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
@AccountTypes(AccountType.SELLER)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

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
  @RequirePermissions('manage_seller_analytics')
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
  @RequirePermissions('manage_seller_analytics')
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
    // Implementation would be similar to getDashboardMetrics but more detailed
    return { message: 'Sales analytics endpoint - implementation pending' };
  }

  @Get('analytics/products')
  @RequirePermissions('manage_seller_analytics')
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
    // Implementation would analyze product performance
    return { message: 'Product analytics endpoint - implementation pending' };
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
    return this.sellersService.getHarvestFeed(user.organizationId!);
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

  // ==================== PRODUCT REQUESTS ENDPOINTS ====================

  @Get('product-requests')
  @RequirePermissions('view_product_requests')
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
  @RequirePermissions('view_product_requests')
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
    );
  }
}
