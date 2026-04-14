import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { Request } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BuyersService } from '../buyers/buyers.service';
import { Public } from '../auth/decorators/public.decorator';
import {
  MarketplaceProductDetailDto,
  MarketplaceProductDto,
  MarketplaceProductQueryDto,
  MarketplaceSellerDto,
  MarketplaceSellerQueryDto,
  CreateGuestRequestDto,
  GuestRequestResponseDto,
} from '../buyers/dto';

@ApiTags('Public Marketplace')
@Public()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Browse Public Marketplace Products',
    description:
      'Browse all available marketplace products without authentication. Filters generally match the authenticated buyer marketplace.',
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
  async browsePublicProducts(
    @Query() query: MarketplaceProductQueryDto,
    @Req() req: Request,
  ): Promise<{
    products: MarketplaceProductDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Use island from X-Country-Code header if not explicitly set in query
    if (!query.country_id && req.countryCode) {
      query.country_id = req.countryCode;
    }
    return this.buyersService.browseProducts(query, undefined);
  }

  @Get('products/:id')
  @ApiOperation({
    summary: 'Get Public Product Details',
    description:
      'Get public product details that can be used for SEO pages and social sharing. Does not require authentication.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved successfully',
    type: MarketplaceProductDetailDto,
  })
  async getPublicProductDetail(
    @Param('id', ParseUUIDPipe) productId: string,
  ): Promise<MarketplaceProductDetailDto> {
    return this.buyersService.getProductDetail(productId, undefined);
  }

  @Get('sellers')
  @ApiOperation({
    summary: 'Browse Public Marketplace Sellers',
    description:
      'Browse verified marketplace sellers without authentication, with basic filters.',
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
  async browsePublicSellers(
    @Query() query: MarketplaceSellerQueryDto,
    @Req() req: Request,
  ): Promise<{
    sellers: MarketplaceSellerDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (!query.country_id && req.countryCode) {
      query.country_id = req.countryCode;
    }
    return this.buyersService.getSellers(query);
  }

  @Get('sellers/:idOrSlug')
  @ApiOperation({
    summary: 'Get Public Seller Profile',
    description:
      'Get public profile information for a marketplace seller. Accepts either the organization UUID (legacy) or the seller slug (SEO-friendly URLs).',
  })
  @ApiParam({
    name: 'idOrSlug',
    description: 'Seller organization UUID or slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller profile retrieved successfully',
    type: MarketplaceSellerDto,
  })
  async getPublicSellerDetail(
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<MarketplaceSellerDto> {
    const seller = UUID_REGEX.test(idOrSlug)
      ? await this.buyersService.getSellerById(idOrSlug)
      : await this.buyersService.getSellerBySlug(idOrSlug);
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
    return seller;
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Guest Product Request',
    description:
      'Submit a product request without authentication. Requires guest name and email so admin can follow up.',
  })
  @ApiResponse({
    status: 201,
    description: 'Guest request created successfully',
    type: GuestRequestResponseDto,
  })
  async createGuestRequest(
    @Body() createDto: CreateGuestRequestDto,
  ): Promise<GuestRequestResponseDto> {
    return this.buyersService.createGuestProductRequest(createDto);
  }

  @Post('country-interest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit Country Interest',
    description:
      'Register interest in having Procur expand to a specific country.',
  })
  @ApiResponse({
    status: 201,
    description: 'Country interest recorded',
  })
  async submitCountryInterest(
    @Body() body: { country: string; email: string },
  ): Promise<{ success: boolean }> {
    return this.buyersService.recordCountryInterest(body.country, body.email);
  }
}
