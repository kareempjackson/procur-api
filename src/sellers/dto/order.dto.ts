import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsPositive,
  Min,
  Max,
  IsUUID,
  ValidateNested,
  IsDateString,
  Length,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export class AddressDto {
  @ApiProperty({ description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State/Province' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Postal/ZIP code' })
  @IsString()
  @IsNotEmpty()
  postal_code: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ description: 'Additional address information' })
  @IsOptional()
  @IsString()
  additional_info?: string;
}

export class OrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ description: 'Quantity to order' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({
    description: 'Unit price (if different from current product price)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unit_price?: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Buyer organization ID' })
  @IsUUID()
  buyer_org_id: string;

  @ApiProperty({ description: 'Order items', type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ description: 'Shipping address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shipping_address: AddressDto;

  @ApiPropertyOptional({
    description: 'Billing address (if different from shipping)',
    type: AddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billing_address?: AddressDto;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  @IsOptional()
  @IsDateString()
  estimated_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shipping_method?: string;

  @ApiPropertyOptional({ description: 'Notes from buyer' })
  @IsOptional()
  @IsString()
  buyer_notes?: string;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Shipping amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shipping_amount?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status', enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Notes from seller' })
  @IsOptional()
  @IsString()
  seller_notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes (not visible to buyer)' })
  @IsOptional()
  @IsString()
  internal_notes?: string;

  @ApiPropertyOptional({ description: 'Tracking number (for shipped orders)' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  tracking_number?: string;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shipping_method?: string;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  @IsOptional()
  @IsDateString()
  estimated_delivery_date?: string;

  @ApiPropertyOptional({
    description: 'Actual delivery date (for delivered orders)',
  })
  @IsOptional()
  @IsDateString()
  actual_delivery_date?: string;
}

export class AcceptOrderDto {
  @ApiPropertyOptional({ description: 'Notes from seller' })
  @IsOptional()
  @IsString()
  seller_notes?: string;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  @IsOptional()
  @IsDateString()
  estimated_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shipping_method?: string;
}

export class RejectOrderDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional notes from seller' })
  @IsOptional()
  @IsString()
  seller_notes?: string;
}

export class BuyerReviewDto {
  @ApiProperty({ description: 'Overall rating (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  overall_rating: number;

  @ApiPropertyOptional({
    description: 'Payment behavior rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  payment_behavior_rating?: number;

  @ApiPropertyOptional({
    description: 'Communication rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communication_rating?: number;

  @ApiPropertyOptional({
    description: 'Reliability rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  reliability_rating?: number;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  comment?: string;
}

export class OrderQueryDto {
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
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: OrderStatus,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Filter by buyer organization ID' })
  @IsOptional()
  @IsUUID()
  buyer_org_id?: string;

  @ApiPropertyOptional({ description: 'Search by order number' })
  @IsOptional()
  @IsString()
  order_number?: string;

  @ApiPropertyOptional({ description: 'Filter orders from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({ description: 'Filter orders to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['created_at', 'total_amount', 'status'],
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

export class OrderItemResponseDto {
  @ApiProperty({ description: 'Order item ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  product_id: string;

  @ApiProperty({ description: 'Product name at time of order' })
  product_name: string;

  @ApiPropertyOptional({ description: 'Product SKU at time of order' })
  product_sku?: string;

  @ApiProperty({ description: 'Unit price at time of order' })
  unit_price: number;

  @ApiProperty({ description: 'Quantity ordered' })
  quantity: number;

  @ApiProperty({ description: 'Total price for this item' })
  total_price: number;

  @ApiPropertyOptional({ description: 'Product snapshot at time of order' })
  product_snapshot?: any;

  @ApiProperty({ description: 'Created at' })
  created_at: string;
}

export class OrderTimelineResponseDto {
  @ApiProperty({ description: 'Timeline entry ID' })
  id: string;

  @ApiProperty({ description: 'Event type' })
  event_type: string;

  @ApiProperty({ description: 'Event title' })
  title: string;

  @ApiPropertyOptional({ description: 'Event description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Actor user ID' })
  actor_user_id?: string;

  @ApiPropertyOptional({ description: 'Actor type' })
  actor_type?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;

  @ApiProperty({ description: 'Is visible to buyer' })
  is_visible_to_buyer: boolean;

  @ApiProperty({ description: 'Is visible to seller' })
  is_visible_to_seller: boolean;

  @ApiProperty({ description: 'Created at' })
  created_at: string;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'Order ID' })
  id: string;

  @ApiProperty({ description: 'Order number' })
  order_number: string;

  @ApiProperty({ description: 'Buyer organization ID' })
  buyer_org_id: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiPropertyOptional({ description: 'Buyer user ID' })
  buyer_user_id?: string;

  @ApiPropertyOptional({ description: 'Buyer organization information' })
  buyer_info?: {
    organization_name?: string;
    business_name?: string;
  };

  @ApiProperty({ description: 'Order status', enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatus })
  payment_status: PaymentStatus;

  @ApiProperty({ description: 'Subtotal amount' })
  subtotal: number;

  @ApiProperty({ description: 'Tax amount' })
  tax_amount: number;

  @ApiProperty({ description: 'Shipping amount' })
  shipping_amount: number;

  @ApiProperty({ description: 'Discount amount' })
  discount_amount: number;

  @ApiProperty({ description: 'Total amount' })
  total_amount: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Shipping address' })
  shipping_address: any;

  @ApiPropertyOptional({ description: 'Billing address' })
  billing_address?: any;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  estimated_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Actual delivery date' })
  actual_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Tracking number' })
  tracking_number?: string;

  @ApiPropertyOptional({ description: 'Shipping method' })
  shipping_method?: string;

  @ApiPropertyOptional({ description: 'Buyer notes' })
  buyer_notes?: string;

  @ApiPropertyOptional({ description: 'Seller notes' })
  seller_notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  internal_notes?: string;

  @ApiPropertyOptional({ description: 'Accepted at' })
  accepted_at?: string;

  @ApiPropertyOptional({ description: 'Rejected at' })
  rejected_at?: string;

  @ApiPropertyOptional({ description: 'Shipped at' })
  shipped_at?: string;

  @ApiPropertyOptional({ description: 'Delivered at' })
  delivered_at?: string;

  @ApiProperty({ description: 'Created at' })
  created_at: string;

  @ApiProperty({ description: 'Updated at' })
  updated_at: string;

  @ApiPropertyOptional({
    description: 'Order items',
    type: [OrderItemResponseDto],
  })
  items?: OrderItemResponseDto[];

  @ApiPropertyOptional({
    description: 'Order timeline',
    type: [OrderTimelineResponseDto],
  })
  timeline?: OrderTimelineResponseDto[];
}
