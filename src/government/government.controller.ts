import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GovernmentService } from './government.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountTypeGuard } from '../auth/guards/account-type.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AccountTypes } from '../auth/decorators/account-types.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { AccountType } from '../common/enums/account-type.enum';
import {
  CreateTableDto,
  UpdateTableDto,
  TableDto,
  TableQueryDto,
} from './dto/table.dto';
import {
  CreateChartDto,
  UpdateChartDto,
  ChartDto,
  ChartQueryDto,
} from './dto/chart.dto';
import {
  CreateReportDto,
  UpdateReportDto,
  ReportDto,
  ReportQueryDto,
  GenerateReportResponseDto,
} from './dto/report.dto';
import {
  DataSourceDto,
  TableDataQueryDto,
  TableDataResponseDto,
  ChartDataQueryDto,
  ChartDataResponseDto,
} from './dto/data.dto';
import {
  RolePermissionDto,
  AvailablePermissionDto,
  AssignPermissionsDto,
  RevokePermissionsDto,
  PermissionChangeLogDto,
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
} from './dto/permissions.dto';

@ApiTags('Government')
@ApiBearerAuth()
@Controller('government')
@UseGuards(
  JwtAuthGuard,
  EmailVerifiedGuard,
  AccountTypeGuard,
  RolesGuard,
  PermissionsGuard,
)
@AccountTypes(AccountType.GOVERNMENT)
export class GovernmentController {
  constructor(private readonly governmentService: GovernmentService) {}

  // ==================== PERMISSION MANAGEMENT ====================
  // Only admin role can manage permissions

  @Get('roles')
  @ApiOperation({
    summary:
      'Get all roles and their permissions in the government organization',
    description: 'Only available to admin role',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Roles and permissions retrieved successfully',
    type: [RolePermissionDto],
  })
  @RequirePermissions('manage_role_permissions')
  async getRolesAndPermissions(
    @CurrentUser() user: UserContext,
  ): Promise<RolePermissionDto[]> {
    return this.governmentService.getRolesAndPermissions(user.organizationId);
  }

  @Get('permissions/available')
  @ApiOperation({
    summary: 'Get all available permissions that can be assigned',
    description: 'Only available to admin role',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available permissions retrieved successfully',
    type: [AvailablePermissionDto],
  })
  @RequirePermissions('manage_role_permissions')
  async getAvailablePermissions(): Promise<AvailablePermissionDto[]> {
    return this.governmentService.getAvailablePermissions();
  }

  @Post('permissions/assign')
  @ApiOperation({
    summary: 'Assign permissions to a role',
    description: 'Only available to admin role',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permissions assigned successfully',
  })
  @RequirePermissions('manage_role_permissions')
  async assignPermissions(
    @Body() assignPermissionsDto: AssignPermissionsDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string; assignedPermissions: string[] }> {
    return this.governmentService.assignPermissions(assignPermissionsDto, user);
  }

  @Post('permissions/revoke')
  @ApiOperation({
    summary: 'Revoke permissions from a role',
    description: 'Only available to admin role',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permissions revoked successfully',
  })
  @RequirePermissions('manage_role_permissions')
  async revokePermissions(
    @Body() revokePermissionsDto: RevokePermissionsDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string; revokedPermissions: string[] }> {
    return this.governmentService.revokePermissions(revokePermissionsDto, user);
  }

  @Get('permissions/changelog')
  @ApiOperation({
    summary: 'Get permission change history',
    description: 'Only available to admin role',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permission change log retrieved successfully',
    type: [PermissionChangeLogDto],
  })
  @RequirePermissions('manage_role_permissions')
  async getPermissionChangeLog(
    @CurrentUser() user: UserContext,
  ): Promise<PermissionChangeLogDto[]> {
    return this.governmentService.getPermissionChangeLog(user.organizationId);
  }

  @Post('roles/custom')
  @ApiOperation({
    summary: 'Create a custom role with specific permissions',
    description: 'Only available to admin role',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Custom role created successfully',
  })
  @RequirePermissions('manage_role_permissions')
  async createCustomRole(
    @Body() createCustomRoleDto: CreateCustomRoleDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string; roleId: string }> {
    return this.governmentService.createCustomRole(createCustomRoleDto, user);
  }

  @Put('roles/:roleId')
  @ApiOperation({
    summary: 'Update a custom role',
    description:
      'Only available to admin role. Cannot update default roles (admin, staff, inspector, procurement_officer)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Custom role updated successfully',
  })
  @RequirePermissions('manage_role_permissions')
  async updateCustomRole(
    @Param('roleId') roleId: string,
    @Body() updateCustomRoleDto: UpdateCustomRoleDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string }> {
    await this.governmentService.updateCustomRole(
      roleId,
      updateCustomRoleDto,
      user,
    );
    return { message: 'Custom role updated successfully' };
  }

  @Delete('roles/:roleId')
  @ApiOperation({
    summary: 'Delete a custom role',
    description:
      'Only available to admin role. Cannot delete default roles or roles with assigned users',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Custom role deleted successfully',
  })
  @RequirePermissions('manage_role_permissions')
  async deleteCustomRole(
    @Param('roleId') roleId: string,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string }> {
    await this.governmentService.deleteCustomRole(roleId, user.organizationId);
    return { message: 'Custom role deleted successfully' };
  }

  // ==================== DATA SOURCES ====================

  @Get('data-sources')
  @ApiOperation({
    summary: 'Get available data sources for the government organization',
    description: 'Available to all government users with view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data sources retrieved successfully',
    type: [DataSourceDto],
  })
  @RequirePermissions('view_government_data')
  async getDataSources(
    @CurrentUser() user: UserContext,
  ): Promise<DataSourceDto[]> {
    return this.governmentService.getDataSources(user.organizationId);
  }

  // ==================== TABLE MANAGEMENT ====================

  @Get('tables')
  @ApiOperation({
    summary: 'Get all tables for the government organization',
    description: 'Available to users with table management or view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tables retrieved successfully',
  })
  @RequirePermissions('manage_government_tables', 'view_government_data')
  async getTables(
    @Query() query: TableQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<{
    tables: TableDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.governmentService.getTables(query, user.organizationId);
  }

  @Get('tables/:id')
  @ApiOperation({
    summary: 'Get a specific table by ID',
    description: 'Available to users with table management or view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Table retrieved successfully',
    type: TableDto,
  })
  @RequirePermissions('manage_government_tables', 'view_government_data')
  async getTable(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<TableDto> {
    return this.governmentService.getTable(id, user.organizationId);
  }

  @Post('tables')
  @ApiOperation({
    summary: 'Create a new flexible table',
    description:
      'Only available to users with manage_government_tables permission',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Table created successfully',
    type: TableDto,
  })
  @RequirePermissions('manage_government_tables')
  async createTable(
    @Body() createTableDto: CreateTableDto,
    @CurrentUser() user: UserContext,
  ): Promise<TableDto> {
    return this.governmentService.createTable(createTableDto, user);
  }

  @Put('tables/:id')
  @ApiOperation({
    summary: 'Update a table configuration',
    description:
      'Only available to users with manage_government_tables permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Table updated successfully',
    type: TableDto,
  })
  @RequirePermissions('manage_government_tables')
  async updateTable(
    @Param('id') id: string,
    @Body() updateTableDto: UpdateTableDto,
    @CurrentUser() user: UserContext,
  ): Promise<TableDto> {
    return this.governmentService.updateTable(id, updateTableDto, user);
  }

  @Delete('tables/:id')
  @ApiOperation({
    summary: 'Delete a table',
    description:
      'Only available to users with manage_government_tables permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Table deleted successfully',
  })
  @RequirePermissions('manage_government_tables')
  async deleteTable(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string }> {
    await this.governmentService.deleteTable(id, user.organizationId);
    return { message: 'Table deleted successfully' };
  }

  // ==================== TABLE DATA ====================

  @Get('tables/:id/data')
  @ApiOperation({
    summary: 'Get data for a specific table',
    description: 'Available to all government users with view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Table data retrieved successfully',
    type: TableDataResponseDto,
  })
  @RequirePermissions('view_government_data')
  async getTableData(
    @Param('id') id: string,
    @Query() query: TableDataQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<TableDataResponseDto> {
    return this.governmentService.getTableData(id, query, user.organizationId);
  }

  @Put('tables/:tableId/data/:recordId')
  @ApiOperation({
    summary:
      'Update a record in a table (for editable data like seller products)',
    description: 'Only available to users with edit_seller_data permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Record updated successfully',
  })
  @RequirePermissions('edit_seller_data')
  async updateTableRecord(
    @Param('tableId') tableId: string,
    @Param('recordId') recordId: string,
    @Body() updateData: any,
    @CurrentUser() user: UserContext,
  ): Promise<any> {
    return this.governmentService.updateTableRecord(
      tableId,
      recordId,
      updateData,
      user,
    );
  }

  // ==================== CHART MANAGEMENT ====================

  @Get('charts')
  @ApiOperation({
    summary: 'Get all charts for the government organization',
    description: 'Available to users with chart creation or view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Charts retrieved successfully',
  })
  @RequirePermissions('create_government_charts', 'view_government_data')
  async getCharts(
    @Query() query: ChartQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ charts: ChartDto[]; total: number }> {
    return this.governmentService.getCharts(query, user.organizationId);
  }

  @Get('charts/:id')
  @ApiOperation({
    summary: 'Get a specific chart by ID',
    description: 'Available to users with chart creation or view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart retrieved successfully',
    type: ChartDto,
  })
  @RequirePermissions('create_government_charts', 'view_government_data')
  async getChart(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ChartDto> {
    return this.governmentService.getChart(id, user.organizationId);
  }

  @Post('charts')
  @ApiOperation({
    summary: 'Create a new chart',
    description:
      'Only available to users with create_government_charts permission',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Chart created successfully',
    type: ChartDto,
  })
  @RequirePermissions('create_government_charts')
  async createChart(
    @Body() createChartDto: CreateChartDto,
    @CurrentUser() user: UserContext,
  ): Promise<ChartDto> {
    return this.governmentService.createChart(createChartDto, user);
  }

  @Put('charts/:id')
  @ApiOperation({
    summary: 'Update a chart',
    description:
      'Only available to users with create_government_charts permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart updated successfully',
    type: ChartDto,
  })
  @RequirePermissions('create_government_charts')
  async updateChart(
    @Param('id') id: string,
    @Body() updateChartDto: UpdateChartDto,
    @CurrentUser() user: UserContext,
  ): Promise<ChartDto> {
    return this.governmentService.updateChart(id, updateChartDto, user);
  }

  @Delete('charts/:id')
  @ApiOperation({
    summary: 'Delete a chart',
    description:
      'Only available to users with create_government_charts permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart deleted successfully',
  })
  @RequirePermissions('create_government_charts')
  async deleteChart(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string }> {
    await this.governmentService.deleteChart(id, user.organizationId);
    return { message: 'Chart deleted successfully' };
  }

  // ==================== CHART DATA ====================

  @Get('charts/:id/data')
  @ApiOperation({
    summary: 'Get data for a specific chart',
    description: 'Available to all government users with view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart data retrieved successfully',
    type: ChartDataResponseDto,
  })
  @RequirePermissions('view_government_data')
  async getChartData(
    @Param('id') id: string,
    @Query() query: ChartDataQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<ChartDataResponseDto> {
    return this.governmentService.getChartData(id, query, user.organizationId);
  }

  // ==================== REPORT MANAGEMENT ====================

  @Get('reports')
  @ApiOperation({
    summary: 'Get all reports for the government organization',
    description:
      'Available to users with report management or view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reports retrieved successfully',
  })
  @RequirePermissions('manage_government_reports', 'view_reports')
  async getReports(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ reports: ReportDto[]; total: number }> {
    return this.governmentService.getReports(query, user.organizationId);
  }

  @Get('reports/:id')
  @ApiOperation({
    summary: 'Get a specific report by ID',
    description:
      'Available to users with report management or view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report retrieved successfully',
    type: ReportDto,
  })
  @RequirePermissions('manage_government_reports', 'view_reports')
  async getReport(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ReportDto> {
    return this.governmentService.getReport(id, user.organizationId);
  }

  @Post('reports')
  @ApiOperation({
    summary: 'Create and generate a new report',
    description:
      'Only available to users with manage_government_reports permission',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Report generation started',
    type: GenerateReportResponseDto,
  })
  @RequirePermissions('manage_government_reports')
  async createReport(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user: UserContext,
  ): Promise<GenerateReportResponseDto> {
    return this.governmentService.createReport(createReportDto, user);
  }

  @Put('reports/:id')
  @ApiOperation({
    summary: 'Update report configuration',
    description:
      'Only available to users with manage_government_reports permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report updated successfully',
    type: ReportDto,
  })
  @RequirePermissions('manage_government_reports')
  async updateReport(
    @Param('id') id: string,
    @Body() updateReportDto: UpdateReportDto,
    @CurrentUser() user: UserContext,
  ): Promise<ReportDto> {
    return this.governmentService.updateReport(id, updateReportDto, user);
  }

  @Delete('reports/:id')
  @ApiOperation({
    summary: 'Delete a report',
    description:
      'Only available to users with manage_government_reports permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report deleted successfully',
  })
  @RequirePermissions('manage_government_reports')
  async deleteReport(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<{ message: string }> {
    await this.governmentService.deleteReport(id, user.organizationId);
    return { message: 'Report deleted successfully' };
  }

  @Post('reports/:id/generate')
  @ApiOperation({
    summary: 'Generate/regenerate a report',
    description:
      'Only available to users with manage_government_reports permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report generation started',
    type: GenerateReportResponseDto,
  })
  @RequirePermissions('manage_government_reports')
  async generateReport(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<GenerateReportResponseDto> {
    return this.governmentService.generateReport(id, user);
  }

  // ==================== QUICK ACCESS TO FARMERS ====================

  @Get('farmers')
  @ApiOperation({
    summary: 'Get all farmers in the government country (quick access)',
    description: 'Available to all government users with view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmers retrieved successfully',
  })
  @RequirePermissions('view_government_data')
  async getFarmers(@CurrentUser() user: UserContext): Promise<any[]> {
    return this.governmentService.getFarmers(user.organizationId);
  }

  @Get('farmers/:id/products')
  @ApiOperation({
    summary: 'Get products for a specific farmer',
    description: 'Available to all government users with view permissions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmer products retrieved successfully',
  })
  @RequirePermissions('view_government_data')
  async getFarmerProducts(
    @Param('id') farmerId: string,
    @CurrentUser() user: UserContext,
  ): Promise<any[]> {
    return this.governmentService.getFarmerProducts(
      farmerId,
      user.organizationId,
    );
  }

  @Put('farmers/:farmerId/products/:productId')
  @ApiOperation({
    summary: 'Update a farmer product',
    description: 'Only available to users with edit_seller_data permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Farmer product updated successfully',
  })
  @RequirePermissions('edit_seller_data')
  async updateFarmerProduct(
    @Param('farmerId') farmerId: string,
    @Param('productId') productId: string,
    @Body() updateData: any,
    @CurrentUser() user: UserContext,
  ): Promise<any> {
    return this.governmentService.updateFarmerProduct(
      farmerId,
      productId,
      updateData,
      user,
    );
  }
}
