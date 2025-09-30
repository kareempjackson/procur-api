import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsPositive,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

export enum ProductCondition {
  NEW = 'new',
  USED = 'used',
  REFURBISHED = 'refurbished',
}

export enum MeasurementUnit {
  KG = 'kg',
  G = 'g',
  LB = 'lb',
  OZ = 'oz',
  PIECE = 'piece',
  DOZEN = 'dozen',
  LITER = 'liter',
  ML = 'ml',
  GALLON = 'gallon',
}

// Removed dimensions DTO to simplify create payload

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Organic Tomatoes' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ description: 'Detailed product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Short product description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  short_description?: string;

  @ApiProperty({ description: 'Product category', example: 'Vegetables' })
  @IsString()
  @Length(1, 100)
  category: string;

  @ApiPropertyOptional({
    description: 'Product subcategory',
    example: 'Fresh Vegetables',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  subcategory?: string;

  @ApiProperty({ description: 'Base price of the product', example: 5.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  base_price: number;

  @ApiPropertyOptional({
    description: 'Sale price (if on sale)',
    example: 4.99,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sale_price?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'XCD',
    default: 'XCD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Current stock quantity',
    example: 100,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number;

  @ApiProperty({ description: 'Unit of measurement', enum: MeasurementUnit })
  @IsEnum(MeasurementUnit)
  unit_of_measurement: MeasurementUnit;

  @ApiPropertyOptional({ description: 'Product weight in kg', example: 0.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({
    description: 'Product condition',
    enum: ProductCondition,
    default: ProductCondition.NEW,
  })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({
    description: 'Product status',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Is this a featured product?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({
    description: 'Is this an organic product?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_organic?: boolean;

  @ApiPropertyOptional({
    description: 'Product images to attach',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Product name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Detailed product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Short product description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  short_description?: string;

  @ApiPropertyOptional({ description: 'Stock Keeping Unit' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiPropertyOptional({ description: 'Product barcode' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  barcode?: string;

  @ApiPropertyOptional({ description: 'Product category' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @ApiPropertyOptional({ description: 'Product subcategory' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  subcategory?: string;

  @ApiPropertyOptional({
    description: 'Product tags for search',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Base price of the product' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  base_price?: number;

  @ApiPropertyOptional({ description: 'Sale price (if on sale)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sale_price?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Current stock quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number;

  @ApiPropertyOptional({ description: 'Minimum stock level for alerts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock_level?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_stock_level?: number;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    enum: MeasurementUnit,
  })
  @IsOptional()
  @IsEnum(MeasurementUnit)
  unit_of_measurement?: MeasurementUnit;

  @ApiPropertyOptional({ description: 'Product weight in kg' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number;

  // dimensions removed from update payload

  @ApiPropertyOptional({
    description: 'Product condition',
    enum: ProductCondition,
  })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({ description: 'Product brand' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  brand?: string;

  @ApiPropertyOptional({ description: 'Product model' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  model?: string;

  @ApiPropertyOptional({ description: 'Product color' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  color?: string;

  @ApiPropertyOptional({ description: 'Product size' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  size?: string;

  @ApiPropertyOptional({ description: 'Product status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Is this a featured product?' })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ description: 'Is this an organic product?' })
  @IsOptional()
  @IsBoolean()
  is_organic?: boolean;

  @ApiPropertyOptional({ description: 'Is this a locally sourced product?' })
  @IsOptional()
  @IsBoolean()
  is_local?: boolean;

  @ApiPropertyOptional({ description: 'SEO meta title' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  meta_title?: string;

  @ApiPropertyOptional({ description: 'SEO meta description' })
  @IsOptional()
  @IsString()
  meta_description?: string;
}

export class ProductImageDto {
  @ApiProperty({ description: 'Image URL' })
  @IsString()
  image_url: string;

  @ApiPropertyOptional({ description: 'Alt text for the image' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  alt_text?: string;

  @ApiPropertyOptional({
    description: 'Display order of the image',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  display_order?: number;

  @ApiPropertyOptional({
    description: 'Is this the primary image?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class ProductQueryDto {
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

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Filter by featured products' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by organic products' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_organic?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['name', 'price', 'created_at', 'stock_quantity'],
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';
}

export class ProductResponseDto {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiPropertyOptional({ description: 'Product description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Short description' })
  short_description?: string;

  @ApiPropertyOptional({ description: 'SKU' })
  sku?: string;

  @ApiPropertyOptional({ description: 'Barcode' })
  barcode?: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiPropertyOptional({ description: 'Subcategory' })
  subcategory?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  tags?: string[];

  @ApiProperty({ description: 'Base price' })
  base_price: number;

  @ApiPropertyOptional({ description: 'Sale price' })
  sale_price?: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Stock quantity' })
  stock_quantity: number;

  @ApiProperty({ description: 'Minimum stock level' })
  min_stock_level: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  max_stock_level?: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiPropertyOptional({ description: 'Weight in kg' })
  weight?: number;

  @ApiPropertyOptional({ description: 'Dimensions' })
  dimensions?: any;

  @ApiProperty({ description: 'Product condition' })
  condition: string;

  @ApiPropertyOptional({ description: 'Brand' })
  brand?: string;

  @ApiPropertyOptional({ description: 'Model' })
  model?: string;

  @ApiPropertyOptional({ description: 'Color' })
  color?: string;

  @ApiPropertyOptional({ description: 'Size' })
  size?: string;

  @ApiProperty({ description: 'Product status' })
  status: string;

  @ApiProperty({ description: 'Is featured' })
  is_featured: boolean;

  @ApiProperty({ description: 'Is organic' })
  is_organic: boolean;

  @ApiProperty({ description: 'Is local' })
  is_local: boolean;

  @ApiPropertyOptional({ description: 'Meta title' })
  meta_title?: string;

  @ApiPropertyOptional({ description: 'Meta description' })
  meta_description?: string;

  @ApiPropertyOptional({ description: 'URL slug' })
  slug?: string;

  @ApiProperty({ description: 'Created at' })
  created_at: string;

  @ApiProperty({ description: 'Updated at' })
  updated_at: string;

  @ApiPropertyOptional({
    description: 'Product images',
    type: [ProductImageDto],
  })
  images?: ProductImageDto[];
}
