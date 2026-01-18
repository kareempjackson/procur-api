import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HomeService } from './home.service';
import { HomePageResponseDto, HomePageQueryDto } from './dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Home')
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @Public() // Make this endpoint public so it can be accessed without authentication
  @ApiOperation({
    summary: 'Get home page aggregate data',
    description:
      'Returns recommended products, popular sellers, best selling products, in-demand products, and popular requests for the home page',
  })
  @ApiResponse({
    status: 200,
    description: 'Home page data retrieved successfully',
    type: HomePageResponseDto,
  })
  @ApiQuery({
    name: 'recommended_limit',
    required: false,
    type: Number,
    description: 'Number of recommended products to return (1-20, default: 8)',
  })
  @ApiQuery({
    name: 'sellers_limit',
    required: false,
    type: Number,
    description: 'Number of popular sellers to return (1-15, default: 6)',
  })
  @ApiQuery({
    name: 'best_selling_limit',
    required: false,
    type: Number,
    description: 'Number of best selling products to return (1-20, default: 8)',
  })
  @ApiQuery({
    name: 'in_demand_limit',
    required: false,
    type: Number,
    description: 'Number of in-demand products to return (1-15, default: 6)',
  })
  @ApiQuery({
    name: 'requests_limit',
    required: false,
    type: Number,
    description: 'Number of popular requests to return (1-20, default: 10)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter results by specific category',
  })
  @ApiQuery({
    name: 'user_location',
    required: false,
    type: String,
    description: 'User location for local recommendations (format: "lat,lng")',
  })
  async getHomePageData(
    @Query() query: HomePageQueryDto,
  ): Promise<HomePageResponseDto> {
    return this.homeService.getHomePageData(query);
  }

  @Get('stats')
  @Public()
  @ApiOperation({
    summary: 'Get platform statistics',
    description: 'Returns basic platform statistics for the home page',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total_active_products: {
          type: 'number',
          description: 'Total number of active products',
        },
        total_verified_sellers: {
          type: 'number',
          description: 'Total number of verified sellers',
        },
        total_open_requests: {
          type: 'number',
          description: 'Total number of open requests',
        },
        last_updated: {
          type: 'string',
          format: 'date-time',
          description: 'Last updated timestamp',
        },
      },
    },
  })
  async getPlatformStats() {
    const supabase = this.homeService['supabaseService'].getClient();

    const [
      { count: activeProducts },
      { count: verifiedSellers },
      { count: openRequests },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'seller')
        .eq('farm_verified', true)
        .eq('status', 'active'),
      supabase
        .from('product_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('expires_at', new Date().toISOString()),
    ]);

    return {
      total_active_products: activeProducts || 0,
      total_verified_sellers: verifiedSellers || 0,
      total_open_requests: openRequests || 0,
      last_updated: new Date().toISOString(),
    };
  }

  @Get('categories')
  @Public()
  @ApiOperation({
    summary: 'Get popular product categories',
    description:
      'Returns the most popular product categories based on active products and requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Category name' },
              product_count: {
                type: 'number',
                description: 'Number of active products in this category',
              },
              request_count: {
                type: 'number',
                description: 'Number of open requests in this category',
              },
              total_activity: {
                type: 'number',
                description: 'Combined activity score',
              },
            },
          },
        },
      },
    },
  })
  async getPopularCategories() {
    const supabase = this.homeService['supabaseService'].getClient();

    // Get product categories with counts
    const { data: productCategories } = await supabase
      .from('products')
      .select('category')
      .eq('status', 'active')
      .not('category', 'is', null);

    // Get request categories with counts
    const { data: requestCategories } = await supabase
      .from('product_requests')
      .select('category')
      .eq('status', 'open')
      .gte('expires_at', new Date().toISOString())
      .not('category', 'is', null);

    // Count occurrences
    const categoryStats = new Map();

    productCategories?.forEach((item: any) => {
      const category = item.category;
      if (!categoryStats.has(category)) {
        categoryStats.set(category, {
          name: category,
          product_count: 0,
          request_count: 0,
        });
      }
      categoryStats.get(category).product_count += 1;
    });

    requestCategories?.forEach((item: any) => {
      const category = item.category;
      if (!categoryStats.has(category)) {
        categoryStats.set(category, {
          name: category,
          product_count: 0,
          request_count: 0,
        });
      }
      categoryStats.get(category).request_count += 1;
    });

    // Convert to array and calculate total activity
    const categories = Array.from(categoryStats.values())
      .map((cat: any) => ({
        ...cat,
        total_activity: cat.product_count + cat.request_count * 2, // Weight requests higher
      }))
      .sort((a, b) => b.total_activity - a.total_activity)
      .slice(0, 12); // Return top 12 categories

    return { categories };
  }
}
