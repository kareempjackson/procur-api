import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsPositive,
  Length,
  IsObject,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RequestStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum QuoteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
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

export class BudgetRangeDto {
  @ApiProperty({ description: 'Minimum budget' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min: number;

  @ApiProperty({ description: 'Maximum budget' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  max: number;

  @ApiProperty({ description: 'Currency code', default: 'USD' })
  @IsString()
  @Length(3, 3)
  currency: string;
}

export class CreateProductRequestDto {
  @ApiProperty({
    description: 'Product name being requested',
    example: 'Organic Tomatoes',
  })
  @IsString()
  @Length(1, 255)
  product_name: string;

  @ApiPropertyOptional({
    description: 'Product type/category',
    example: 'Fresh Vegetables',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  product_type?: string;

  @ApiPropertyOptional({
    description: 'Product category',
    example: 'Vegetables',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @ApiPropertyOptional({ description: 'Detailed description of requirements' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Quantity needed', example: 100 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement', enum: MeasurementUnit })
  @IsEnum(MeasurementUnit)
  unit_of_measurement: MeasurementUnit;

  @ApiPropertyOptional({
    description: 'Date when product is needed (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  date_needed?: string;

  @ApiPropertyOptional({ description: 'Budget range for the request' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  budget_range?: BudgetRangeDto;

  @ApiPropertyOptional({
    description: 'Target specific seller (leave empty for open market)',
  })
  @IsOptional()
  @IsUUID()
  target_seller_id?: string;

  @ApiPropertyOptional({ description: 'Request expiration date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class UpdateProductRequestDto {
  @ApiPropertyOptional({ description: 'Product name being requested' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  product_name?: string;

  @ApiPropertyOptional({ description: 'Product type/category' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  product_type?: string;

  @ApiPropertyOptional({ description: 'Product category' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @ApiPropertyOptional({ description: 'Detailed description of requirements' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Quantity needed' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    enum: MeasurementUnit,
  })
  @IsOptional()
  @IsEnum(MeasurementUnit)
  unit_of_measurement?: MeasurementUnit;

  @ApiPropertyOptional({ description: 'Date when product is needed' })
  @IsOptional()
  @IsDateString()
  date_needed?: string;

  @ApiPropertyOptional({ description: 'Budget range for the request' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  budget_range?: BudgetRangeDto;

  @ApiPropertyOptional({ description: 'Request status', enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Request expiration date' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class ProductRequestQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by status', enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['created_at', 'date_needed', 'quantity', 'response_count'],
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

export class ProductRequestResponseDto {
  @ApiProperty({ description: 'Request ID' })
  id: string;

  @ApiProperty({ description: 'Request number' })
  request_number: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiPropertyOptional({ description: 'Product type' })
  product_type?: string;

  @ApiPropertyOptional({ description: 'Category' })
  category?: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiProperty({ description: 'Quantity requested' })
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiPropertyOptional({ description: 'Date needed' })
  date_needed?: string;

  @ApiPropertyOptional({ description: 'Budget range' })
  budget_range?: BudgetRangeDto;

  @ApiPropertyOptional({ description: 'Target seller ID' })
  target_seller_id?: string;

  @ApiPropertyOptional({ description: 'Target seller name' })
  target_seller_name?: string;

  @ApiProperty({ description: 'Request status' })
  status: string;

  @ApiProperty({ description: 'Number of responses received' })
  response_count: number;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expires_at?: string;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updated_at: string;
}

export class CreateQuoteDto {
  @ApiProperty({ description: 'Unit price for the requested product' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unit_price: number;

  @ApiProperty({ description: 'Total price for the full quantity' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  total_price: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ description: 'Available quantity that can be supplied' })
  @IsNumber()
  @IsPositive()
  available_quantity: number;

  @ApiPropertyOptional({ description: 'Estimated delivery date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  delivery_date?: string;

  @ApiPropertyOptional({ description: 'Additional notes or terms' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Alternative product being offered (if different from request)',
  })
  @IsOptional()
  @IsUUID()
  offered_product_id?: string;
}

export class QuoteResponseDto {
  @ApiProperty({ description: 'Quote ID' })
  id: string;

  @ApiProperty({ description: 'Request ID' })
  request_id: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'Unit price' })
  unit_price: number;

  @ApiProperty({ description: 'Total price' })
  total_price: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Available quantity' })
  available_quantity: number;

  @ApiPropertyOptional({ description: 'Delivery date' })
  delivery_date?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Offered product ID' })
  offered_product_id?: string;

  @ApiPropertyOptional({ description: 'Offered product details' })
  offered_product?: any;

  @ApiProperty({ description: 'Quote status' })
  status: string;

  @ApiProperty({ description: 'Seller rating' })
  seller_rating?: number;

  @ApiProperty({ description: 'Seller review count' })
  seller_review_count: number;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;
}

export class AcceptQuoteDto {
  @ApiPropertyOptional({
    description: 'Quantity to accept (if less than available)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  accepted_quantity?: number;

  @ApiPropertyOptional({ description: 'Shipping address ID' })
  @IsOptional()
  @IsUUID()
  shipping_address_id?: string;

  @ApiPropertyOptional({ description: 'Additional notes for the seller' })
  @IsOptional()
  @IsString()
  notes?: string;
}
