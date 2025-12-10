import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  Length,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductSortBy {
  NAME = 'name',
  PRICE = 'price',
  CREATED_AT = 'created_at',
  RATING = 'rating',
  POPULARITY = 'popularity',
  DISTANCE = 'distance',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class MarketplaceProductQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search term for product name/description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by subcategory' })
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiPropertyOptional({ description: 'Filter by seller ID' })
  @IsOptional()
  @IsUUID()
  seller_id?: string;

  @ApiPropertyOptional({ description: 'Minimum price filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum price filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiPropertyOptional({ description: 'Filter by organic products only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_organic?: boolean;

  @ApiPropertyOptional({ description: 'Filter by local products only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_local?: boolean;

  @ApiPropertyOptional({ description: 'Filter by featured products only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by products in stock only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  in_stock?: boolean;

  @ApiPropertyOptional({ description: 'Filter by product tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Buyer location for distance calculation',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Maximum distance in km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_distance?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ProductSortBy,
    default: ProductSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sort_by?: ProductSortBy = ProductSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}

export class MarketplaceSellerQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search term for seller name/description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by business type' })
  @IsOptional()
  @IsString()
  business_type?: string;

  @ApiPropertyOptional({ description: 'Filter by location/country' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Filter by verified sellers only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_verified?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['name', 'created_at', 'product_count'],
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}

export class MarketplaceSellerDto {
  @ApiProperty({ description: 'Seller organization ID' })
  id: string;

  @ApiProperty({ description: 'Seller name' })
  name: string;

  @ApiProperty({ description: 'Seller description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Business type' })
  business_type?: string;

  @ApiPropertyOptional({
    description: 'Public header / cover image URL for the seller profile',
  })
  header_image_url?: string;

  @ApiProperty({ description: 'Seller logo URL' })
  logo_url?: string;

  @ApiProperty({ description: 'Seller location' })
  location?: string;

  @ApiProperty({ description: 'Average rating' })
  average_rating?: number;

  @ApiProperty({ description: 'Total number of reviews' })
  review_count: number;

  @ApiProperty({ description: 'Number of products' })
  product_count: number;

  @ApiProperty({ description: 'Years in business' })
  years_in_business?: number;

  @ApiProperty({ description: 'Is verified seller' })
  is_verified: boolean;

  @ApiProperty({ description: 'Seller tags/specialties' })
  specialties?: string[];

  @ApiProperty({ description: 'Distance from buyer (if location provided)' })
  distance?: number;
}

export class MarketplaceProductDto {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'Short description' })
  short_description?: string;

  @ApiProperty({ description: 'Product category' })
  category: string;

  @ApiProperty({ description: 'Product subcategory' })
  subcategory?: string;

  @ApiProperty({
    description:
      'Current price (sale price if available, otherwise base price)',
  })
  current_price: number;

  @ApiProperty({ description: 'Original base price' })
  base_price: number;

  @ApiProperty({ description: 'Sale price if on sale' })
  sale_price?: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Stock quantity available' })
  stock_quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiProperty({ description: 'Product condition' })
  condition: string;

  @ApiProperty({ description: 'Product brand' })
  brand?: string;

  @ApiProperty({ description: 'Primary product image URL' })
  image_url?: string;

  @ApiProperty({ description: 'All product images' })
  images?: string[];

  @ApiProperty({ description: 'Product tags' })
  tags?: string[];

  @ApiProperty({ description: 'Is organic product' })
  is_organic: boolean;

  @ApiProperty({ description: 'Is local product' })
  is_local: boolean;

  @ApiProperty({ description: 'Is featured product' })
  is_featured: boolean;

  @ApiProperty({ description: 'Average product rating' })
  average_rating?: number;

  @ApiProperty({ description: 'Number of reviews' })
  review_count: number;

  @ApiProperty({ description: 'Seller information' })
  seller: MarketplaceSellerDto;

  @ApiProperty({ description: 'Distance from buyer (if location provided)' })
  distance?: number;

  @ApiProperty({ description: 'Estimated delivery time in days' })
  estimated_delivery_days?: number;

  @ApiProperty({ description: 'Is in buyer favorites' })
  is_favorited?: boolean;
}

export class MarketplaceProductDetailDto extends MarketplaceProductDto {
  @ApiProperty({ description: 'Full product description' })
  description?: string;

  @ApiProperty({ description: 'Product SKU' })
  sku?: string;

  @ApiProperty({ description: 'Product weight in kg' })
  weight?: number;

  @ApiProperty({ description: 'Product dimensions' })
  dimensions?: any;

  @ApiProperty({ description: 'Product color' })
  color?: string;

  @ApiProperty({ description: 'Product size' })
  size?: string;

  @ApiProperty({ description: 'Product model' })
  model?: string;

  @ApiProperty({ description: 'Minimum stock level' })
  min_stock_level: number;

  @ApiProperty({ description: 'Recent reviews' })
  recent_reviews?: any[];

  @ApiProperty({ description: 'Related products' })
  related_products?: MarketplaceProductDto[];
}

export class MarketplaceCategoryDto {
  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiProperty({ description: 'Number of products in category' })
  product_count: number;

  @ApiProperty({ description: 'Subcategories' })
  subcategories?: {
    name: string;
    product_count: number;
  }[];
}

export class MarketplaceStatsDto {
  @ApiProperty({ description: 'Total number of products' })
  total_products: number;

  @ApiProperty({ description: 'Total number of sellers' })
  total_sellers: number;

  @ApiProperty({ description: 'Number of categories' })
  total_categories: number;

  @ApiProperty({ description: 'Featured products count' })
  featured_products: number;

  @ApiProperty({ description: 'New products this week' })
  new_products_this_week: number;

  @ApiProperty({ description: 'Popular categories' })
  popular_categories: MarketplaceCategoryDto[];
}
