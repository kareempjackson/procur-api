import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { FarmService } from './farm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountTypeGuard } from '../auth/guards/account-type.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AccountTypes } from '../auth/decorators/account-types.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { AccountType } from '../common/enums/account-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import {
  UpsertFarmProfileDto,
  FarmProfileResponseDto,
  CreatePlotDto,
  UpdatePlotDto,
  PlotResponseDto,
  CreateHarvestLogDto,
  UpdateHarvestLogDto,
  HarvestLogQueryDto,
  HarvestLogResponseDto,
  CreatePackingRecordDto,
  UpdatePackingRecordDto,
  PackingRecordResponseDto,
  CreateFarmInputDto,
  UpdateFarmInputDto,
  FarmInputResponseDto,
  CreateCropSeasonDto,
  UpdateCropSeasonDto,
  CropSeasonResponseDto,
  AdminFarmQueryDto,
} from './dto';

@ApiTags('Farm & Traceability')
@Controller('sellers/farm')
export class FarmController {
  constructor(private readonly farmService: FarmService) {}

  // ─── Farm Profile ─────────────────────────────────────────────────────────

  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Get farm profile' })
  @ApiResponse({ status: 200, type: FarmProfileResponseDto })
  @ApiUnauthorizedResponse()
  async getFarmProfile(@CurrentUser() user: UserContext): Promise<FarmProfileResponseDto | null> {
    return this.farmService.getFarmProfile(user.organizationId!);
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Create or update farm profile' })
  @ApiResponse({ status: 200, type: FarmProfileResponseDto })
  @ApiBadRequestResponse()
  async upsertFarmProfile(
    @CurrentUser() user: UserContext,
    @Body() dto: UpsertFarmProfileDto,
  ): Promise<FarmProfileResponseDto> {
    return this.farmService.upsertFarmProfile(user.organizationId!, dto);
  }

  @Patch('profile')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Update farm profile (partial)' })
  @ApiResponse({ status: 200, type: FarmProfileResponseDto })
  async updateFarmProfile(
    @CurrentUser() user: UserContext,
    @Body() dto: UpsertFarmProfileDto,
  ): Promise<FarmProfileResponseDto> {
    return this.farmService.upsertFarmProfile(user.organizationId!, dto);
  }

  // ─── Farm Plots ───────────────────────────────────────────────────────────

  @Get('plots')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'List farm plots' })
  @ApiResponse({ status: 200, type: [PlotResponseDto] })
  async getPlots(@CurrentUser() user: UserContext): Promise<PlotResponseDto[]> {
    return this.farmService.getPlots(user.organizationId!);
  }

  @Post('plots')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Create a farm plot' })
  @ApiResponse({ status: 201, type: PlotResponseDto })
  async createPlot(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePlotDto,
  ): Promise<PlotResponseDto> {
    return this.farmService.createPlot(user.organizationId!, dto);
  }

  @Patch('plots/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Update a farm plot' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: PlotResponseDto })
  @ApiNotFoundResponse()
  async updatePlot(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) plotId: string,
    @Body() dto: UpdatePlotDto,
  ): Promise<PlotResponseDto> {
    return this.farmService.updatePlot(user.organizationId!, plotId, dto);
  }

  @Delete('plots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Delete a farm plot' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204 })
  async deletePlot(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) plotId: string,
  ): Promise<void> {
    return this.farmService.deletePlot(user.organizationId!, plotId);
  }

  // ─── Harvest Logs ─────────────────────────────────────────────────────────

  @Get('harvest-logs')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'List harvest logs (paginated)' })
  async getHarvestLogs(
    @CurrentUser() user: UserContext,
    @Query() query: HarvestLogQueryDto,
  ): Promise<{ data: HarvestLogResponseDto[]; total: number }> {
    return this.farmService.getHarvestLogs(user.organizationId!, query);
  }

  @Post('harvest-logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Log a harvest (generates Traceability Lot Code)',
    description:
      'Creates a FSMA 204 harvest CTE record. A unique Traceability Lot Code (TLC) is auto-generated in the format TLC-{ORG4}-{CROP4}-{YYYYMMDD}-{RAND4}.',
  })
  @ApiResponse({ status: 201, type: HarvestLogResponseDto })
  @ApiBadRequestResponse()
  async createHarvestLog(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateHarvestLogDto,
  ): Promise<HarvestLogResponseDto> {
    return this.farmService.createHarvestLog(
      user.organizationId!,
      user.id,
      dto,
    );
  }

  @Get('harvest-logs/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Get a harvest log by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: HarvestLogResponseDto })
  @ApiNotFoundResponse()
  async getHarvestLog(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) logId: string,
  ): Promise<HarvestLogResponseDto> {
    return this.farmService.getHarvestLogById(user.organizationId!, logId);
  }

  @Patch('harvest-logs/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Update a harvest log' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: HarvestLogResponseDto })
  @ApiNotFoundResponse()
  async updateHarvestLog(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) logId: string,
    @Body() dto: UpdateHarvestLogDto,
  ): Promise<HarvestLogResponseDto> {
    return this.farmService.updateHarvestLog(user.organizationId!, logId, dto);
  }

  // ─── Packing Records ──────────────────────────────────────────────────────

  @Get('harvest-logs/:id/packing')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'List packing records for a harvest log' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: [PackingRecordResponseDto] })
  async getPackingRecords(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) logId: string,
  ): Promise<PackingRecordResponseDto[]> {
    return this.farmService.getPackingRecords(user.organizationId!, logId);
  }

  @Post('harvest-logs/:id/packing')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Log a packing event for a harvest batch (FSMA 204 Packing CTE)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, type: PackingRecordResponseDto })
  async createPackingRecord(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) logId: string,
    @Body() dto: CreatePackingRecordDto,
  ): Promise<PackingRecordResponseDto> {
    return this.farmService.createPackingRecord(
      user.organizationId!,
      user.id,
      logId,
      dto,
    );
  }

  @Patch('harvest-logs/:logId/packing/:recordId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Update a packing record' })
  @ApiResponse({ status: 200, type: PackingRecordResponseDto })
  @ApiNotFoundResponse()
  async updatePackingRecord(
    @CurrentUser() user: UserContext,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdatePackingRecordDto,
  ): Promise<PackingRecordResponseDto> {
    return this.farmService.updatePackingRecord(user.organizationId!, recordId, dto);
  }

  // ─── Chain of Custody ─────────────────────────────────────────────────────

  @Get('harvest-logs/:id/chain')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Full FSMA 204 chain-of-custody for a harvest log',
    description: 'Returns all 4 CTEs: Harvest → Packing → Shipping → Receiving for a given lot.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Chain of custody timeline' })
  @ApiNotFoundResponse()
  async getChainOfCustody(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) logId: string,
  ) {
    return this.farmService.getChainOfCustody(user.organizationId!, logId);
  }

  // ─── FSMA 204 CSV Export ──────────────────────────────────────────────────

  @Get('export')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @Header('Content-Type', 'text/csv')
  @ApiOperation({
    summary: 'Export FSMA 204 compliance CSV',
    description:
      'Downloads all Harvest and Packing CTE records in FDA Electronic Sortable Spreadsheet (ESS) format. Filter by date range with ?from=YYYY-MM-DD&to=YYYY-MM-DD.',
  })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportFsmaCsv(
    @CurrentUser() user: UserContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.farmService.exportFsmaCsv(user.organizationId!, from, to);
    const filename = `procur-fsma204-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ─── Farm Inputs ──────────────────────────────────────────────────────────

  @Get('inputs')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'List farm inputs (fertilizers, pesticides, etc.)' })
  @ApiResponse({ status: 200, type: [FarmInputResponseDto] })
  async getFarmInputs(
    @CurrentUser() user: UserContext,
    @Query('plot_id') plotId?: string,
  ): Promise<FarmInputResponseDto[]> {
    return this.farmService.getFarmInputs(user.organizationId!, plotId);
  }

  @Post('inputs')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Log a farm input application' })
  @ApiResponse({ status: 201, type: FarmInputResponseDto })
  async createFarmInput(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateFarmInputDto,
  ): Promise<FarmInputResponseDto> {
    return this.farmService.createFarmInput(user.organizationId!, user.id, dto);
  }

  @Patch('inputs/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Update a farm input' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: FarmInputResponseDto })
  async updateFarmInput(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) inputId: string,
    @Body() dto: UpdateFarmInputDto,
  ): Promise<FarmInputResponseDto> {
    return this.farmService.updateFarmInput(user.organizationId!, inputId, dto);
  }

  @Delete('inputs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Delete a farm input record' })
  @ApiParam({ name: 'id', type: String })
  async deleteFarmInput(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) inputId: string,
  ): Promise<void> {
    return this.farmService.deleteFarmInput(user.organizationId!, inputId);
  }

  @Get('inputs/warnings')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Get withdrawal period warnings for a planned harvest date',
    description: 'Returns inputs still within their withdrawal period on the given date. Use before logging a harvest.',
  })
  async getWithdrawalWarnings(
    @CurrentUser() user: UserContext,
    @Query('harvest_date') harvestDate: string,
    @Query('plot_id') plotId?: string,
  ) {
    return this.farmService.getWithdrawalWarnings(
      user.organizationId!,
      harvestDate ?? new Date().toISOString().slice(0, 10),
      plotId,
    );
  }

  // ─── Crop Seasons ─────────────────────────────────────────────────────────

  @Get('seasons')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'List crop seasonal calendar entries' })
  @ApiResponse({ status: 200, type: [CropSeasonResponseDto] })
  async getCropSeasons(
    @CurrentUser() user: UserContext,
  ): Promise<CropSeasonResponseDto[]> {
    return this.farmService.getCropSeasons(user.organizationId!);
  }

  @Post('seasons')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Create or update a crop season (upsert on crop+variety)' })
  @ApiResponse({ status: 200, type: CropSeasonResponseDto })
  async upsertCropSeason(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateCropSeasonDto,
  ): Promise<CropSeasonResponseDto> {
    return this.farmService.upsertCropSeason(user.organizationId!, dto);
  }

  @Patch('seasons/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Update a crop season entry' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: CropSeasonResponseDto })
  async updateCropSeason(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) seasonId: string,
    @Body() dto: UpdateCropSeasonDto,
  ): Promise<CropSeasonResponseDto> {
    return this.farmService.updateCropSeason(user.organizationId!, seasonId, dto);
  }

  @Delete('seasons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Delete a crop season entry' })
  @ApiParam({ name: 'id', type: String })
  async deleteCropSeason(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) seasonId: string,
  ): Promise<void> {
    return this.farmService.deleteCropSeason(user.organizationId!, seasonId);
  }

  // ─── Intelligence Endpoints ────────────────────────────────────────────────

  @Get('compliance-dashboard')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Full compliance dashboard',
    description:
      'Returns FSMA 204 coverage metrics, certification status, input withdrawal warnings, reliability score, and an overall compliance score (0–100).',
  })
  @ApiResponse({ status: 200, description: 'Compliance dashboard data' })
  async getComplianceDashboard(@CurrentUser() user: UserContext) {
    return this.farmService.getComplianceDashboard(user.organizationId!);
  }

  @Get('price-benchmark')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({
    summary: 'Price benchmark against market averages',
    description: 'Compares your product prices to market averages for the same crops.',
  })
  @ApiResponse({ status: 200, description: 'Price benchmark data' })
  async getPriceBenchmark(@CurrentUser() user: UserContext) {
    return this.farmService.getPriceBenchmark(user.organizationId!);
  }

  @Get('reliability')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AccountTypeGuard, PermissionsGuard)
  @AccountTypes(AccountType.SELLER)
  @RequirePermissions('manage_inventory')
  @ApiOperation({ summary: 'Your seller reliability score' })
  @ApiResponse({ status: 200, description: 'Reliability score' })
  async getReliabilityScore(@CurrentUser() user: UserContext) {
    return this.farmService.getReliabilityScore(user.organizationId!);
  }

  // ─── Public Lot Code Lookup (no auth — for QR code scanning) ─────────────

  @Get('/lot-code/:lotCode')
  @Public()
  @ApiOperation({
    summary: 'Public lot code lookup',
    description:
      'Returns full chain-of-custody info for a Traceability Lot Code. No authentication required — designed for QR code scanning on physical packaging.',
  })
  @ApiParam({ name: 'lotCode', example: 'TLC-GREE-PLAN-20260315-X7K2' })
  @ApiResponse({ status: 200, description: 'Lot code traceability data' })
  @ApiNotFoundResponse({ description: 'Lot code not found' })
  async getLotCodePublic(@Param('lotCode') lotCode: string) {
    return this.farmService.getLotCodePublic(lotCode);
  }
}

// ─── Admin Farm Controller ─────────────────────────────────────────────────

@ApiTags('Admin — Farm')
@ApiBearerAuth('JWT-auth')
@Controller('admin/farm')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.SUPER_ADMIN)
export class FarmAdminController {
  constructor(private readonly farmService: FarmService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Admin: platform-wide farm & traceability stats' })
  @ApiResponse({ status: 200 })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async getAdminFarmOverview() {
    return this.farmService.getAdminFarmOverview();
  }

  @Get('compliance')
  @ApiOperation({ summary: 'Admin: per-seller compliance scores (paginated)' })
  @ApiResponse({ status: 200 })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async getAdminSellerCompliance(@Query() query: AdminFarmQueryDto) {
    return this.farmService.getAdminSellerCompliance(query);
  }

  @Get('harvest-logs')
  @ApiOperation({ summary: 'Admin: all harvest logs across all sellers (paginated)' })
  @ApiResponse({ status: 200 })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async getAdminHarvestLogs(@Query() query: AdminFarmQueryDto) {
    return this.farmService.getAdminHarvestLogs(query);
  }
}
