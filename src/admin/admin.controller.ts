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
import {
  AdminProductResponseDto,
  AdminProductQueryDto,
  CreateAdminProductDto,
  UpdateAdminProductDto,
} from './dto/admin-product.dto';
import { AdminUserResponseDto, CreateAdminUserDto } from './dto/admin-user.dto';
import { UpdateAdminOrganizationStatusDto } from './dto/admin-org-status.dto';
import { AdminAuditLogQueryDto } from './dto/admin-audit.dto';
import {
  UpdateFarmVerificationDto,
  UpdateFarmersIdVerificationDto,
} from './dto/admin-org-verification.dto';

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

  // ===== Platform admin users (staff) =====

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
}
