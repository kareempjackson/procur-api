import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminService } from './admin.service';
import type {
  AdminDashboardSummary,
  AdminDashboardCharts,
  AdminAuditLogItem,
} from './admin.service';
import { AdminOrgQueryDto } from './dto/admin-org-query.dto';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import {
  AdminDriverResponseDto,
  CreateDriverDto,
  UpdateDriverDto,
} from './dto/driver.dto';
import {
  AssignDriverDto,
  UpdateAdminOrderStatusDto,
} from './dto/admin-order-status.dto';
import { UpdateAdminOrderPaymentStatusDto } from './dto/admin-order-payment-status.dto';
import { AdminOrderInspectionApprovalDto } from './dto/admin-order-inspection.dto';
import {
  AdminPaymentsQueryDto,
  MarkBuyerSettlementCompletedDto,
  MarkFarmerPayoutCompletedDto,
} from './dto/admin-payments.dto';
import {
  AdminProductResponseDto,
  AdminProductQueryDto,
  CreateAdminProductDto,
  UpdateAdminProductDto,
} from './dto/admin-product.dto';
import {
  AdminUserResponseDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from './dto/admin-user.dto';
import { UpdateAdminOrganizationStatusDto } from './dto/admin-org-status.dto';
import { AdminAuditLogQueryDto } from './dto/admin-audit.dto';
import {
  UpdateFarmVerificationDto,
  UpdateFarmersIdVerificationDto,
} from './dto/admin-org-verification.dto';
import { UpdateSellerMarketplaceHiddenDto } from './dto/admin-seller-marketplace-hidden.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import {
  CreateFarmVisitRequestDto,
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponseDto,
  ProductStatus,
} from '../sellers/dto';
import { OrderReviewDto } from '../buyers/dto/order.dto';
import { AdminCreateOfflineOrderDto } from './dto/admin-offline-order.dto';
import { LogoUploadUrlResponseDto } from '../users/dto/logo-upload.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ===== Buyers =====

  @Get('buyers')
  @ApiOperation({
    summary: 'List buyer organizations',
    description:
      'Platform-level view of all buyer organizations with basic metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Buyer organizations listed successfully',
  })
  async listBuyers(@Query() query: AdminOrgQueryDto) {
    return this.adminService.listOrganizationsByType('buyer', query);
  }

  @Get('buyers/:id')
  @ApiOperation({
    summary: 'Get buyer organization profile',
    description:
      'Fetch buyer organization details, members, and recent orders for admin review',
  })
  @ApiResponse({
    status: 200,
    description: 'Buyer organization profile retrieved successfully',
  })
  async getBuyerById(@Param('id') id: string) {
    return this.adminService.getBuyerDetail(id);
  }

  @Delete('buyers/:id')
  @ApiOperation({
    summary: 'Delete buyer organization',
    description:
      'Soft-delete (suspend) a buyer organization and deactivate its members from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Buyer organization deleted successfully',
  })
  async deleteBuyer(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.adminService.deleteOrganization(id, 'buyer');
  }

  @Post('buyers/bulk-delete')
  @ApiOperation({
    summary: 'Bulk delete buyer organizations',
    description:
      'Soft-delete (suspend) multiple buyer organizations and deactivate their members from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Buyer organizations deleted successfully',
  })
  async bulkDeleteBuyers(
    @Body('ids') ids: string[],
  ): Promise<{ success: boolean; deleted: number }> {
    const { deleted } = await this.adminService.bulkDeleteOrganizations(
      ids || [],
      'buyer',
    );
    return { success: true, deleted };
  }

  // ===== Sellers =====

  @Get('sellers')
  @ApiOperation({
    summary: 'List seller organizations',
    description:
      'Platform-level view of all seller organizations with basic metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller organizations listed successfully',
  })
  async listSellers(@Query() query: AdminOrgQueryDto) {
    return this.adminService.listOrganizationsByType('seller', query);
  }

  @Get('sellers/:id')
  @ApiOperation({
    summary: 'Get seller organization profile',
    description:
      'Fetch seller organization details, members, and recent orders for admin review',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller organization profile retrieved successfully',
  })
  async getSellerById(@Param('id') id: string) {
    return this.adminService.getSellerDetail(id);
  }

  @Patch('sellers/:id/farmers-id/signed-upload')
  @ApiOperation({
    summary: "Create signed upload URL for seller farmer's ID (admin)",
    description:
      "Return a signed upload URL for the seller's farmer ID image and update the organization's farmers_id path.",
  })
  @ApiResponse({
    status: 200,
    description: 'Signed upload URL created successfully',
  })
  async createSellerFarmersIdSignedUpload(
    @Param('id') id: string,
    @Body() body: { filename: string },
  ) {
    return this.adminService.createSellerFarmersIdSignedUpload(
      id,
      body.filename,
    );
  }

  @Patch('sellers/:id/logo/signed-upload')
  @ApiOperation({
    summary: 'Create signed upload URL for seller logo (admin)',
    description:
      'Return a signed upload URL for a seller organization logo and update the organization logo_url.',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed upload URL for logo created successfully',
    type: LogoUploadUrlResponseDto,
  })
  async createSellerLogoSignedUpload(
    @Param('id') id: string,
    @Body() body: { filename: string },
  ): Promise<LogoUploadUrlResponseDto> {
    return this.adminService.createSellerLogoSignedUpload(id, body.filename);
  }

  @Patch('sellers/:id/header-image/signed-upload')
  @ApiOperation({
    summary: 'Create signed upload URL for seller header image (admin)',
    description:
      'Return a signed upload URL for a seller organization header image and update the organization header_image_url.',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed upload URL for header image created successfully',
    type: LogoUploadUrlResponseDto,
  })
  async createSellerHeaderImageSignedUpload(
    @Param('id') id: string,
    @Body() body: { filename: string },
  ): Promise<LogoUploadUrlResponseDto> {
    return this.adminService.createSellerHeaderImageSignedUpload(
      id,
      body.filename,
    );
  }

  @Delete('sellers/:id')
  @ApiOperation({
    summary: 'Delete seller organization',
    description:
      'Soft-delete (suspend) a seller organization and deactivate its members from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller organization deleted successfully',
  })
  async deleteSeller(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.adminService.deleteOrganization(id, 'seller');
  }

  @Post('sellers/bulk-delete')
  @ApiOperation({
    summary: 'Bulk delete seller organizations',
    description:
      'Soft-delete (suspend) multiple seller organizations and deactivate their members from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller organizations deleted successfully',
  })
  async bulkDeleteSellers(
    @Body('ids') ids: string[],
  ): Promise<{ success: boolean; deleted: number }> {
    const { deleted } = await this.adminService.bulkDeleteOrganizations(
      ids || [],
      'seller',
    );
    return { success: true, deleted };
  }

  // ===== Seller products (admin-managed) =====

  @Get('sellers/:id/products')
  @ApiOperation({
    summary: 'List seller products (admin)',
    description:
      'Platform-level view of products for a specific seller organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller products listed successfully',
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
  async listSellerProducts(
    @Param('id') orgId: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.adminService.listSellerProducts(orgId, query);
  }

  @Post('sellers/:id/products')
  @ApiOperation({
    summary: 'Create product for seller (admin)',
    description:
      'Create a new product in the seller catalog on behalf of a seller organization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  async createSellerProduct(
    @Param('id') orgId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.adminService.createSellerProduct(orgId, dto, user.id);
  }

  @Patch('sellers/:orgId/products/:productId')
  @ApiOperation({
    summary: 'Update product for seller (admin)',
    description:
      'Update core product fields for a seller product on behalf of a seller organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  async updateSellerProduct(
    @Param('orgId') orgId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.adminService.updateSellerProduct(
      orgId,
      productId,
      dto,
      user.id,
    );
  }

  @Patch('sellers/:orgId/products/:productId/status')
  @ApiOperation({
    summary: 'Update product status for seller (admin)',
    description:
      'Hide or show a product in the marketplace by changing its status (e.g. active/inactive).',
  })
  @ApiResponse({
    status: 200,
    description: 'Product status updated successfully',
    type: ProductResponseDto,
  })
  async updateSellerProductStatus(
    @Param('orgId') orgId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: UserContext,
    @Body('status') status: ProductStatus,
  ): Promise<ProductResponseDto> {
    return this.adminService.updateSellerProductStatus(
      orgId,
      productId,
      status,
      user.id,
    );
  }

  @Delete('sellers/:orgId/products/:productId')
  @ApiOperation({
    summary: 'Delete product for seller (admin)',
    description:
      'Delete a product from the seller catalog on behalf of a seller organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully',
  })
  async deleteSellerProduct(
    @Param('orgId') orgId: string,
    @Param('productId') productId: string,
  ): Promise<{ success: boolean }> {
    await this.adminService.deleteSellerProduct(orgId, productId);
    return { success: true };
  }

  // ===== Orders =====

  @Get('orders')
  @ApiOperation({
    summary: 'List orders',
    description:
      'Platform-level view of all orders with buyer/seller context and basic logistics info',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders listed successfully',
  })
  async listOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.listOrders(query);
  }

  @Post('orders/offline')
  @ApiOperation({
    summary: 'Create offline order (no payment link)',
    description:
      'Record an order that happened off-platform between a buyer and seller organization without creating a payment link.',
  })
  @ApiResponse({
    status: 201,
    description: 'Offline order created successfully',
  })
  async createOfflineOrder(
    @Body() dto: AdminCreateOfflineOrderDto,
  ): Promise<{ id: string; order_number: string }> {
    return this.adminService.createOfflineOrder(dto);
  }

  @Get('orders/:id')
  @ApiOperation({
    summary: 'Get order logistics profile',
    description:
      'Fetch a single order with buyer/seller organizations, line items and logistics timeline',
  })
  @ApiResponse({
    status: 200,
    description: 'Order profile retrieved successfully',
  })
  async getOrderById(@Param('id') id: string) {
    return this.adminService.getOrderDetail(id);
  }

  @Post('orders/:id/send-receipt')
  @ApiOperation({
    summary: 'Send receipt to a custom email',
    description:
      'Sends the existing buyer receipt template to the provided email address for this order.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        paymentReference: { type: 'string' },
      },
      required: ['email'],
    },
  })
  async sendOrderReceipt(
    @Param('id') id: string,
    @Body()
    body: {
      email: string;
      paymentReference?: string | null;
    },
  ) {
    return this.adminService.sendOrderReceiptEmail({
      orderId: id,
      email: body.email,
      paymentReference: body.paymentReference,
    });
  }

  @Post('orders/:id/send-seller-receipt')
  @ApiOperation({
    summary: 'Send seller receipt to a custom email',
    description:
      'Sends the existing seller receipt template to the provided email address for this order.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        paymentReference: { type: 'string' },
      },
      required: ['email'],
    },
  })
  async sendOrderSellerReceipt(
    @Param('id') id: string,
    @Body()
    body: {
      email: string;
      paymentReference?: string | null;
    },
  ) {
    return this.adminService.sendOrderSellerReceiptEmail({
      orderId: id,
      email: body.email,
      paymentReference: body.paymentReference,
    });
  }

  @Post('orders/bulk-delete')
  @ApiOperation({
    summary: 'Bulk delete orders (admin)',
    description:
      'Permanently delete multiple orders by ID. Use with care; this is irreversible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders deleted successfully',
  })
  async bulkDeleteOrders(
    @Body('ids') ids: string[],
  ): Promise<{ success: boolean; deleted: number }> {
    const { deleted } = await this.adminService.bulkDeleteOrders(ids || []);
    return { success: true, deleted };
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary: 'Update order status (admin)',
    description:
      'Update the status of an order from the admin panel. Triggers timeline via DB triggers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
  })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrderStatusDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.updateOrderStatus(id, dto.status);
  }

  @Patch('orders/:id/payment-status')
  @ApiOperation({
    summary: 'Update order payment status (admin)',
    description:
      'Update the payment_status (and paid_at when marking paid) for an order from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order payment status updated successfully',
  })
  async updateOrderPaymentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrderPaymentStatusDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ success: boolean }> {
    return this.adminService.updateOrderPaymentStatus(id, dto, user.id);
  }

  @Patch('orders/:id/inspection-approval')
  @ApiOperation({
    summary: 'Record post-inspection approval or rejection (admin)',
    description:
      'Admin records supermarket inspection outcome, optional line adjustments, and approval notes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspection approval saved successfully',
  })
  async approveOrderInspection(
    @Param('id') id: string,
    @Body() dto: AdminOrderInspectionApprovalDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ success: boolean }> {
    return this.adminService.approveOrderInspection(id, {
      inspectionStatus: dto.inspection_status,
      approvalNotes: dto.approval_notes,
      adminUserId: user.id,
      itemAdjustments: dto.items?.map((i) => ({
        id: i.id,
        unit_price: i.unit_price,
        quantity: i.quantity,
      })),
    });
  }

  // ===== Payments (direct-deposit clearing) =====

  @Get('payments/buyer-settlements')
  @ApiOperation({
    summary: 'List buyer settlements (direct-deposit clearing)',
    description:
      'Lists buyer-side settlement transactions for the direct-deposit clearing flow.',
  })
  async listBuyerSettlements(@Query() query: AdminPaymentsQueryDto) {
    return this.adminService.listBuyerSettlements(query);
  }

  @Get('payments/farmer-payouts')
  @ApiOperation({
    summary: 'List farmer payouts (direct-deposit clearing)',
    description:
      'Lists farmer payout transactions for the direct-deposit clearing flow.',
  })
  async listFarmerPayouts(@Query() query: AdminPaymentsQueryDto) {
    return this.adminService.listFarmerPayouts(query);
  }

  @Patch('payments/buyer-settlements/:id/mark-completed')
  @ApiOperation({
    summary: 'Mark buyer settlement as completed',
    description:
      'Marks a buyer settlement (supermarket → Procur) as completed and records reference / proof.',
  })
  async markBuyerSettlementCompleted(
    @Param('id') id: string,
    @Body() body: MarkBuyerSettlementCompletedDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.markBuyerSettlementCompleted(id, body);
  }

  @Patch('payments/farmer-payouts/:id/mark-completed')
  @ApiOperation({
    summary: 'Mark farmer payout as completed',
    description:
      'Marks a farmer payout (Procur → farmer) as completed and records proof, updating order payment status.',
  })
  async markFarmerPayoutCompleted(
    @Param('id') id: string,
    @Body() body: MarkFarmerPayoutCompletedDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.markFarmerPayoutCompleted(id, body);
  }

  @Patch('orders/:id/driver')
  @ApiOperation({
    summary: 'Assign driver to order',
    description:
      'Assign an individual driver account to this order for logistics handling.',
  })
  @ApiResponse({
    status: 200,
    description: 'Driver assigned successfully',
  })
  async assignDriver(
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.assignDriver(id, dto.driverId);
  }

  // ===== Buyer reviews on seller orders (admin-triggered) =====

  @Post('buyers/:buyerOrgId/orders/:orderId/review')
  @ApiOperation({
    summary: 'Create order review on behalf of buyer',
    description:
      'Allow an admin to create an order review for a delivered order on behalf of a buyer organization. Uses the same validation rules as the buyer-side review endpoint.',
  })
  @ApiResponse({
    status: 201,
    description: 'Order review submitted successfully',
  })
  async createBuyerOrderReview(
    @Param('buyerOrgId') buyerOrgId: string,
    @Param('orderId') orderId: string,
    @Body() reviewDto: OrderReviewDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.createOrderReviewForBuyer(
      buyerOrgId,
      orderId,
      reviewDto,
    );
  }

  @Post('buyers/:buyerOrgId/orders/:orderId/review-email')
  @ApiOperation({
    summary: 'Send review request email to buyer',
    description:
      'Sends an email to the buyer admin contact asking them to write a review for a delivered order. Includes a link to the buyer order review page.',
  })
  @ApiResponse({
    status: 201,
    description: 'Review request email sent successfully',
  })
  async sendBuyerReviewRequestEmail(
    @Param('buyerOrgId') buyerOrgId: string,
    @Param('orderId') orderId: string,
  ): Promise<{ success: boolean; to: string; reviewUrl: string }> {
    return this.adminService.sendBuyerOrderReviewRequestEmail(
      buyerOrgId,
      orderId,
    );
  }

  // ===== Admin products (catalog) =====

  @Get('products')
  @ApiOperation({
    summary: 'List admin catalog products',
    description:
      'List platform-managed products that sellers can reference when creating products.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin products listed successfully',
    type: Object,
  })
  async listAdminProducts(@Query() query: AdminProductQueryDto) {
    return this.adminService.listAdminProducts(query);
  }

  @Get('products/:id')
  @ApiOperation({
    summary: 'Get admin catalog product',
    description: 'Fetch a single admin product definition by id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin product retrieved successfully',
    type: AdminProductResponseDto,
  })
  async getAdminProduct(
    @Param('id') id: string,
  ): Promise<AdminProductResponseDto> {
    return this.adminService.getAdminProductById(id);
  }

  @Post('products')
  @ApiOperation({
    summary: 'Create admin catalog product',
    description:
      'Create a new platform-managed product that sellers can select from.',
  })
  @ApiResponse({
    status: 201,
    description: 'Admin product created successfully',
    type: AdminProductResponseDto,
  })
  async createAdminProduct(
    @Body() dto: CreateAdminProductDto,
  ): Promise<AdminProductResponseDto> {
    return this.adminService.createAdminProduct(dto);
  }

  @Patch('products/:id')
  @ApiOperation({
    summary: 'Update admin catalog product',
    description: 'Update fields on an admin-managed product.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin product updated successfully',
    type: AdminProductResponseDto,
  })
  async updateAdminProduct(
    @Param('id') id: string,
    @Body() dto: UpdateAdminProductDto,
  ): Promise<AdminProductResponseDto> {
    return this.adminService.updateAdminProduct(id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({
    summary: 'Delete admin catalog product',
    description: 'Soft-delete an admin product (marks it inactive).',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin product deleted successfully',
  })
  async deleteAdminProduct(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.adminService.deleteAdminProduct(id);
  }

  // ===== Drivers =====

  @Get('drivers')
  @ApiOperation({
    summary: 'List drivers',
    description: 'List all driver individual accounts managed by the platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Drivers listed successfully',
    type: [AdminDriverResponseDto],
  })
  async listDrivers(): Promise<AdminDriverResponseDto[]> {
    return this.adminService.listDrivers();
  }

  @Get('drivers/:id')
  @ApiOperation({
    summary: 'Get driver profile',
    description: 'Fetch a single driver record by id',
  })
  @ApiResponse({
    status: 200,
    description: 'Driver retrieved successfully',
    type: AdminDriverResponseDto,
  })
  async getDriver(@Param('id') id: string): Promise<AdminDriverResponseDto> {
    return this.adminService.getDriverById(id);
  }

  @Post('drivers')
  @ApiOperation({
    summary: 'Create driver',
    description: 'Create a new driver individual account',
  })
  @ApiResponse({
    status: 201,
    description: 'Driver created successfully',
    type: AdminDriverResponseDto,
  })
  async createDriver(
    @Body() dto: CreateDriverDto,
  ): Promise<AdminDriverResponseDto> {
    return this.adminService.createDriver(dto);
  }

  @Patch('drivers/:id')
  @ApiOperation({
    summary: 'Update driver',
    description: 'Update driver profile fields',
  })
  @ApiResponse({
    status: 200,
    description: 'Driver updated successfully',
    type: AdminDriverResponseDto,
  })
  async updateDriver(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<AdminDriverResponseDto> {
    return this.adminService.updateDriver(id, dto);
  }

  @Delete('drivers/:id')
  @ApiOperation({
    summary: 'Delete driver',
    description: 'Soft-delete (deactivate) a driver account',
  })
  @ApiResponse({
    status: 200,
    description: 'Driver deactivated successfully',
  })
  async deleteDriver(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.adminService.deleteDriver(id);
  }

  // ===== Dashboard =====

  @Get('dashboard/summary')
  @ApiOperation({
    summary: 'Admin dashboard summary',
    description:
      'High level metrics for buyers, sellers, orders and platform fees',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully',
    type: Object,
  })
  async getDashboardSummary(): Promise<AdminDashboardSummary> {
    return this.adminService.getDashboardSummary();
  }

  @Get('dashboard/charts')
  @ApiOperation({
    summary: 'Admin dashboard charts',
    description:
      'Time series and aggregation data for admin dashboard visualizations',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard charts retrieved successfully',
    type: Object,
  })
  async getDashboardCharts(): Promise<AdminDashboardCharts> {
    return this.adminService.getDashboardCharts();
  }

  // ===== Platform fees configuration =====

  @Get('settings/fees')
  @ApiOperation({
    summary: 'Get platform fees configuration',
    description:
      'Returns the current platform fee percentage and flat delivery fee used across the app for offline orders and payment links.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform fees configuration retrieved successfully',
  })
  async getPlatformFeesSettings() {
    return this.adminService.getPlatformFeesSettings();
  }

  @Patch('settings/fees')
  @ApiOperation({
    summary: 'Update platform fees configuration',
    description:
      'Update the platform fee percentage and flat delivery fee used across the app. Only SUPER_ADMINs should call this endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform fees configuration updated successfully',
  })
  async updatePlatformFeesSettings(
    @Body()
    body: {
      platformFeePercent?: number;
      deliveryFlatFee?: number;
      buyerDeliveryShare?: number;
      sellerDeliveryShare?: number;
      currency?: string;
    },
  ) {
    return this.adminService.updatePlatformFeesSettings({
      platformFeePercent: body.platformFeePercent,
      deliveryFlatFee: body.deliveryFlatFee,
      buyerDeliveryShare: body.buyerDeliveryShare,
      sellerDeliveryShare: body.sellerDeliveryShare,
      currency: body.currency,
    });
  }

  // ===== Audit log =====

  @Get('audit/logs')
  @ApiOperation({
    summary: 'List audit log entries',
    description:
      'Paginated system-wide audit log of HTTP/API requests, filterable by actor, action, route and time range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    type: Object,
  })
  async listAuditLogs(@Query() query: AdminAuditLogQueryDto): Promise<{
    items: AdminAuditLogItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.adminService.listAuditLogs(query);
  }

  // ===== Organization status (verification) =====

  @Patch('buyers/:id/status')
  @ApiOperation({
    summary: 'Update buyer organization status',
    description: 'Verify or suspend a buyer organization from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Buyer organization status updated successfully',
  })
  async updateBuyerStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrganizationStatusDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.updateOrganizationStatus(id, 'buyer', dto.status);
  }

  @Patch('sellers/:id/status')
  @ApiOperation({
    summary: 'Update seller organization status',
    description:
      'Verify or suspend a seller organization from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller organization status updated successfully',
  })
  async updateSellerStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrganizationStatusDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.updateOrganizationStatus(id, 'seller', dto.status);
  }

  @Patch('sellers/:id/marketplace-hidden')
  @ApiOperation({
    summary: 'Hide or show seller on marketplace (admin)',
    description:
      'Toggles whether this seller (and their products) appears on the public marketplace and buyer marketplace UIs. Seller remains active and visible in admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller marketplace visibility updated successfully',
  })
  async updateSellerMarketplaceHidden(
    @Param('id') id: string,
    @Body() dto: UpdateSellerMarketplaceHiddenDto,
  ): Promise<{ success: boolean; isHiddenFromMarketplace: boolean }> {
    return this.adminService.updateSellerMarketplaceHidden(id, dto.hidden);
  }

  @Patch('sellers/:id/farmers-id-verification')
  @ApiOperation({
    summary: 'Update farmer ID verification for seller',
    description:
      'Mark a seller organization farmer ID as verified/unverified from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Farmer ID verification updated successfully',
  })
  async updateSellerFarmersIdVerification(
    @Param('id') id: string,
    @Body() dto: UpdateFarmersIdVerificationDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.updateSellerFarmersIdVerification(
      id,
      dto.verified,
    );
  }

  @Patch('sellers/:id/farm-verification')
  @ApiOperation({
    summary: 'Update farm verification for seller',
    description:
      'Mark a seller organization farm as verified/unverified from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Farm verification updated successfully',
  })
  async updateSellerFarmVerification(
    @Param('id') id: string,
    @Body() dto: UpdateFarmVerificationDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.updateSellerFarmVerification(id, dto.verified);
  }

  // ===== Seller farm visit requests (admin-managed) =====

  @Post('sellers/:id/farm-visit-requests')
  @ApiOperation({
    summary: 'Create farm visit request for seller (admin)',
    description:
      'Allow an admin to create a farm visit request on behalf of a seller organization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Farm visit request created successfully',
  })
  async createSellerFarmVisitRequest(
    @Param('id') orgId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: CreateFarmVisitRequestDto,
  ): Promise<{ success: boolean }> {
    return this.adminService.createSellerFarmVisitRequest(orgId, user.id, dto);
  }

  // ===== Platform admin users (staff) =====

  @Get('admins')
  @ApiOperation({
    summary: 'List platform admin users',
    description:
      'List all platform-level admin and super admin accounts that can access the Procur admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin users listed successfully',
    type: [AdminUserResponseDto],
  })
  async listAdminUsers(): Promise<AdminUserResponseDto[]> {
    return this.adminService.listAdminUsers();
  }

  @Post('admins')
  @ApiOperation({
    summary: 'Create platform admin user',
    description:
      'Create a new platform-level admin or super admin account. Only SUPER_ADMIN can call this endpoint.',
  })
  @ApiResponse({
    status: 201,
    description: 'Admin user created successfully',
    type: AdminUserResponseDto,
  })
  async createAdminUser(
    @Body() dto: CreateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.createAdminUser(dto);
  }

  @Patch('admins/:id')
  @ApiOperation({
    summary: 'Update platform admin user',
    description:
      'Update core fields for a platform-level admin or super admin account. Only SUPER_ADMIN can call this endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin user updated successfully',
    type: AdminUserResponseDto,
  })
  async updateAdminUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.updateAdminUser(id, dto);
  }

  @Delete('admins/:id')
  @ApiOperation({
    summary: 'Delete (deactivate) platform admin user',
    description:
      'Soft-delete a platform-level admin or super admin account by marking it inactive. Only SUPER_ADMIN can call this endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin user deleted successfully',
  })
  async deleteAdminUser(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.adminService.deleteAdminUser(id);
  }

  // ===== User WhatsApp management (admin-triggered) =====

  @Patch('users/:id/phone')
  @ApiOperation({
    summary: 'Update user phone number (no WhatsApp send)',
    description:
      'Update a user phone_number without triggering any WhatsApp messages. Admins can then manually start the bot or send prompts.',
  })
  @ApiResponse({
    status: 200,
    description: 'User phone number updated successfully',
  })
  async updateUserPhone(
    @Param('id') id: string,
    @Body() body: { phoneNumber: string },
  ): Promise<{ success: boolean; phoneNumber: string }> {
    return this.adminService.updateUserPhone(id, body.phoneNumber);
  }

  @Post('users/:id/whatsapp/start')
  @ApiOperation({
    summary: 'Start WhatsApp bot for user',
    description:
      'Send an onboarding WhatsApp template to the user to start the bot. Must be called explicitly from the admin panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp bot started successfully',
  })
  async startUserWhatsAppBot(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.adminService.startUserWhatsAppBot(id);
  }

  @Post('users/:id/whatsapp/prompt')
  @ApiOperation({
    summary: 'Send WhatsApp prompt to user',
    description:
      'Send a predefined WhatsApp prompt template (e.g., KYC reminder) to the given user.',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp prompt sent successfully',
  })
  async sendUserWhatsAppPrompt(
    @Param('id') id: string,
    @Body()
    body: {
      template: string;
      variables?: Record<string, string>;
    },
  ): Promise<{ success: boolean }> {
    return this.adminService.sendUserWhatsAppPrompt(
      id,
      body.template,
      body.variables ?? {},
    );
  }

  // ===== Onboarding buyers and sellers from admin =====

  @Post('buyers/onboard')
  @ApiOperation({
    summary: 'Create buyer organization and primary user from admin panel',
    description:
      'Create a new buyer organization plus its primary admin user (email + password) for onboarding.',
  })
  @ApiResponse({
    status: 201,
    description: 'Buyer organization created successfully',
  })
  async createBuyerFromAdmin(
    @Body()
    body: {
      adminEmail: string;
      adminFullname: string;
      password: string;
      businessName: string;
      country?: string;
      businessType?: string;
      phoneNumber?: string;
    },
  ): Promise<{ organizationId: string; userId: string }> {
    return this.adminService.createBuyerFromAdmin(body);
  }

  @Post('sellers/onboard')
  @ApiOperation({
    summary: 'Create seller organization and primary user from admin panel',
    description:
      'Create a new seller organization plus its primary admin user (email + password) for onboarding.',
  })
  @ApiResponse({
    status: 201,
    description: 'Seller organization created successfully',
  })
  async createSellerFromAdmin(
    @Body()
    body: {
      adminEmail: string;
      adminFullname: string;
      password: string;
      businessName: string;
      country?: string;
      businessType?: string;
      phoneNumber?: string;
    },
  ): Promise<{ organizationId: string; userId: string }> {
    return this.adminService.createSellerFromAdmin(body);
  }
}
