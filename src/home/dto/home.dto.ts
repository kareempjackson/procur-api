import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Recommended Product DTO
export class RecommendedProductDto {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'Short description' })
  short_description?: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiProperty({
    description:
      'Current price (sale price if available, otherwise base price)',
  })
  current_price: number;

  @ApiProperty({ description: 'Original price (base price)' })
  base_price: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Primary image URL' })
  image_url?: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'Seller ID' })
  seller_id: string;

  @ApiProperty({ description: 'Average rating' })
  average_rating?: number;

  @ApiProperty({ description: 'Is organic product' })
  is_organic: boolean;

  @ApiProperty({ description: 'Is local product' })
  is_local: boolean;

  @ApiProperty({ description: 'Stock quantity' })
  stock_quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;
}

// Popular Seller DTO
export class PopularSellerDto {
  @ApiProperty({ description: 'Seller organization ID' })
  id: string;

  @ApiProperty({ description: 'Seller name' })
  name: string;

  @ApiProperty({ description: 'Business description' })
  description?: string;

  @ApiProperty({ description: 'Business type' })
  business_type?: string;

  @ApiProperty({ description: 'Logo URL' })
  logo_url?: string;

  @ApiProperty({ description: 'Location' })
  location?: string;

  @ApiProperty({ description: 'Average rating' })
  average_rating?: number;

  @ApiProperty({ description: 'Total reviews' })
  review_count: number;

  @ApiProperty({ description: 'Number of active products' })
  product_count: number;

  @ApiProperty({ description: 'Total sales this month' })
  monthly_sales: number;

  @ApiProperty({ description: 'Years in business' })
  years_in_business?: number;

  @ApiProperty({ description: 'Is verified seller' })
  is_verified: boolean;

  @ApiProperty({ description: 'Specialties/tags' })
  specialties?: string[];
}

// Best Selling Product DTO
export class BestSellingProductDto {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiProperty({ description: 'Current price' })
  current_price: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Primary image URL' })
  image_url?: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'Seller ID' })
  seller_id: string;

  @ApiProperty({ description: 'Total units sold (last 30 days)' })
  units_sold: number;

  @ApiProperty({ description: 'Total revenue (last 30 days)' })
  total_revenue: number;

  @ApiProperty({ description: 'Average rating' })
  average_rating?: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;
}

// In Demand Product DTO
export class InDemandProductDto {
  @ApiProperty({ description: 'Product name/category' })
  product_name: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiProperty({ description: 'Number of active requests' })
  request_count: number;

  @ApiProperty({ description: 'Total quantity requested' })
  total_quantity_requested: number;

  @ApiProperty({ description: 'Average budget range minimum' })
  avg_budget_min?: number;

  @ApiProperty({ description: 'Average budget range maximum' })
  avg_budget_max?: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Most common unit of measurement' })
  common_unit: string;

  @ApiProperty({
    description: 'Trend percentage (increase/decrease from last period)',
  })
  trend_percentage: number;
}

// Popular Request DTO
export class PopularRequestDto {
  @ApiProperty({ description: 'Request ID' })
  id: string;

  @ApiProperty({ description: 'Request number' })
  request_number: string;

  @ApiProperty({ description: 'Product name requested' })
  product_name: string;

  @ApiProperty({ description: 'Category' })
  category?: string;

  @ApiProperty({ description: 'Quantity requested' })
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiProperty({ description: 'Budget range' })
  budget_range?: {
    min: number;
    max: number;
    currency: string;
  };

  @ApiProperty({ description: 'Date needed' })
  date_needed?: string;

  @ApiProperty({ description: 'Number of quotes received' })
  response_count: number;

  @ApiProperty({ description: 'Buyer organization name' })
  buyer_name: string;

  @ApiProperty({ description: 'Days since posted' })
  days_since_posted: number;

  @ApiProperty({ description: 'Request status' })
  status: string;

  @ApiProperty({ description: 'Expires at' })
  expires_at?: string;
}

// Main Home Page Response DTO
export class HomePageResponseDto {
  @ApiProperty({
    description: 'Recommended products based on user preferences and trends',
    type: [RecommendedProductDto],
  })
  recommended_products: RecommendedProductDto[];

  @ApiProperty({
    description: 'Popular sellers with high ratings and sales',
    type: [PopularSellerDto],
  })
  popular_sellers: PopularSellerDto[];

  @ApiProperty({
    description: 'Best selling products in the last 30 days',
    type: [BestSellingProductDto],
  })
  best_selling_products: BestSellingProductDto[];

  @ApiProperty({
    description: 'Products currently in high demand based on requests',
    type: [InDemandProductDto],
  })
  in_demand_products: InDemandProductDto[];

  @ApiProperty({
    description: 'Popular/trending product requests',
    type: [PopularRequestDto],
  })
  popular_requests: PopularRequestDto[];

  @ApiProperty({ description: 'Total number of active products' })
  total_active_products: number;

  @ApiProperty({ description: 'Total number of verified sellers' })
  total_verified_sellers: number;

  @ApiProperty({ description: 'Total number of open requests' })
  total_open_requests: number;

  @ApiProperty({ description: 'Data last updated timestamp' })
  last_updated: string;
}

// Query parameters for customizing home page data
export class HomePageQueryDto {
  @ApiPropertyOptional({
    description: 'Number of recommended products to return',
    default: 8,
    minimum: 1,
    maximum: 20,
  })
  recommended_limit?: number = 8;

  @ApiPropertyOptional({
    description: 'Number of popular sellers to return',
    default: 6,
    minimum: 1,
    maximum: 15,
  })
  sellers_limit?: number = 6;

  @ApiPropertyOptional({
    description: 'Number of best selling products to return',
    default: 8,
    minimum: 1,
    maximum: 20,
  })
  best_selling_limit?: number = 8;

  @ApiPropertyOptional({
    description: 'Number of in-demand products to return',
    default: 6,
    minimum: 1,
    maximum: 15,
  })
  in_demand_limit?: number = 6;

  @ApiPropertyOptional({
    description: 'Number of popular requests to return',
    default: 10,
    minimum: 1,
    maximum: 20,
  })
  requests_limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by specific category',
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'User location for local recommendations (lat,lng)',
  })
  user_location?: string;
}
