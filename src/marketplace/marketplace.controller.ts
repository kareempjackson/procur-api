import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
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
  ): Promise<{
    products: MarketplaceProductDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Call underlying marketplace browser without a buyer organization context
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
  ): Promise<{
    sellers: MarketplaceSellerDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.buyersService.getSellers(query);
  }

  @Get('sellers/:id')
  @ApiOperation({
    summary: 'Get Public Seller Profile',
    description:
      'Get public profile information for a marketplace seller that can be shown on a public seller page.',
  })
  @ApiParam({ name: 'id', description: 'Seller organization ID' })
  @ApiResponse({
    status: 200,
    description: 'Seller profile retrieved successfully',
    type: MarketplaceSellerDto,
  })
  async getPublicSellerDetail(
    @Param('id', ParseUUIDPipe) sellerId: string,
  ): Promise<MarketplaceSellerDto> {
    const seller = await this.buyersService.getSellerById(sellerId);
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
