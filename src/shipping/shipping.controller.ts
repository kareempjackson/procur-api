import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountType } from '../common/enums/account-type.enum';
import {
  ShippingService,
  CreateShippingRouteDto,
  UpdateShippingRouteDto,
} from './shipping.service';

@ApiTags('Shipping')
@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // --- Seller endpoints ---

  @Get('sellers/shipping-routes')
  @ApiOperation({ summary: "List seller's shipping routes" })
  async getSellerRoutes(@Req() req: Request) {
    const sellerOrgId = req.user!.organizationId!;
    const routes = await this.shippingService.getSellerRoutes(sellerOrgId);
    return { routes };
  }

  @Post('sellers/shipping-routes')
  @ApiOperation({ summary: 'Create a cross-island shipping route' })
  async createRoute(
    @Req() req: Request,
    @Body() dto: CreateShippingRouteDto,
  ) {
    const sellerOrgId = req.user!.organizationId!;
    // Get seller's home island from their org
    const route = await this.shippingService.createRoute(
      sellerOrgId,
      req.countryCode || 'gda', // fallback to gda
      dto,
    );
    return route;
  }

  @Patch('sellers/shipping-routes/:id')
  @ApiOperation({ summary: 'Update a shipping route' })
  async updateRoute(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body() dto: UpdateShippingRouteDto,
  ) {
    const sellerOrgId = req.user!.organizationId!;
    return this.shippingService.updateRoute(routeId, sellerOrgId, dto);
  }

  @Delete('sellers/shipping-routes/:id')
  @ApiOperation({ summary: 'Delete a shipping route' })
  async deleteRoute(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) routeId: string,
  ) {
    const sellerOrgId = req.user!.organizationId!;
    await this.shippingService.deleteRoute(routeId, sellerOrgId);
    return { success: true };
  }

  // --- Public endpoint ---

  @Get('shipping/estimate')
  @Public()
  @ApiOperation({
    summary: 'Get shipping estimate for a product to a destination island',
  })
  async getEstimate(
    @Query('product_id') productId: string,
    @Query('dest_country') destIsland: string,
  ) {
    const estimate = await this.shippingService.getEstimate(
      productId,
      destIsland,
    );
    return { estimate };
  }

  // --- Shipping documents ---

  @Get('sellers/shipping-documents')
  @ApiOperation({ summary: "List seller's shipping documents" })
  async getDocuments(@Req() req: Request) {
    const sellerOrgId = req.user!.organizationId!;
    const documents = await this.shippingService.getDocuments(sellerOrgId);
    return { documents };
  }

  @Post('sellers/shipping-documents/upload-url')
  @ApiOperation({ summary: 'Get a signed URL for uploading a shipping document' })
  async getUploadUrl(
    @Req() req: Request,
    @Body() body: { filename: string },
  ) {
    const sellerOrgId = req.user!.organizationId!;
    return this.shippingService.getDocumentUploadUrl(sellerOrgId, body.filename);
  }

  @Post('sellers/shipping-documents')
  @ApiOperation({ summary: 'Save a shipping document record after upload' })
  async createDocument(
    @Req() req: Request,
    @Body() body: {
      name: string;
      doc_type: string;
      file_url: string;
      file_path: string;
      file_size?: number;
      mime_type?: string;
    },
  ) {
    const sellerOrgId = req.user!.organizationId!;
    const doc = await this.shippingService.createDocument(sellerOrgId, body);
    return doc;
  }

  @Delete('sellers/shipping-documents/:id')
  @ApiOperation({ summary: 'Delete a shipping document' })
  async deleteDocument(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) docId: string,
  ) {
    const sellerOrgId = req.user!.organizationId!;
    await this.shippingService.deleteDocument(docId, sellerOrgId);
    return { success: true };
  }
}
