import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';

export enum ProductRequestStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  EXPIRED = 'expired',
  FULFILLED = 'fulfilled',
}

export enum QuoteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export class ProductRequestQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ProductRequestStatus,
  })
  @IsOptional()
  @IsEnum(ProductRequestStatus)
  status?: ProductRequestStatus;

  @ApiPropertyOptional({ description: 'Search query (product name, buyer)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by product category',
  })
  @IsOptional()
  @IsString()
  category?: string;
}

export class SellerQuoteDto {
  @ApiProperty({ description: 'Quote ID' })
  id: string;

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

  @ApiProperty({ description: 'Quote status', enum: QuoteStatus })
  status: QuoteStatus;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;
}

export class SellerProductRequestDto {
  @ApiProperty({ description: 'Request ID' })
  id: string;

  @ApiProperty({ description: 'Request number' })
  request_number: string;

  @ApiProperty({ description: 'Buyer organization ID' })
  buyer_org_id: string;

  @ApiProperty({ description: 'Buyer organization name' })
  buyer_name: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiPropertyOptional({ description: 'Product description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Quantity requested' })
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiPropertyOptional({ description: 'Budget range details' })
  budget_range?: {
    min_price?: number;
    max_price?: number;
    currency: string;
  };

  @ApiPropertyOptional({ description: 'Date needed' })
  date_needed?: string;

  @ApiPropertyOptional({ description: 'Delivery location/city' })
  delivery_location?: string;

  @ApiProperty({ description: 'Request status', enum: ProductRequestStatus })
  status: ProductRequestStatus;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expires_at?: string;

  @ApiPropertyOptional({ description: 'Number of quotes received' })
  quote_count?: number;

  @ApiPropertyOptional({ description: 'My quote for this request' })
  my_quote?: SellerQuoteDto;

  @ApiPropertyOptional({ description: 'Buyer rating' })
  buyer_rating?: number;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;
}

export class CreateQuoteDto {
  @ApiProperty({ description: 'Unit price', example: 2.5 })
  @IsNumber()
  @Min(0)
  unit_price: number;

  @ApiProperty({ description: 'Currency', example: 'USD' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Available quantity' })
  @IsNumber()
  @Min(1)
  available_quantity: number;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  delivery_date?: string;

  @ApiPropertyOptional({ description: 'Notes or message to buyer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Link to your product (if applicable)' })
  @IsOptional()
  @IsUUID()
  offered_product_id?: string;
}

export class CreateQuoteResponseDto {
  @ApiProperty({ description: 'Quote ID' })
  id: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}
