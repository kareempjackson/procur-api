import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsObject,
  ValidateNested,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BuyerOrderStatus {
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

export class OrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ description: 'Quantity to order' })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Items to order', type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ description: 'Shipping address ID' })
  @IsUUID()
  shipping_address_id: string;

  @ApiPropertyOptional({
    description: 'Billing address ID (defaults to shipping)',
  })
  @IsOptional()
  @IsUUID()
  billing_address_id?: string;

  @ApiPropertyOptional({ description: 'Notes for the seller' })
  @IsOptional()
  @IsString()
  buyer_notes?: string;

  @ApiPropertyOptional({ description: 'Preferred delivery date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  preferred_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Credits to apply to this order (in cents)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credits_applied_cents?: number;
}

export class BuyerOrderQueryDto {
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
    description: 'Filter by order status',
    enum: BuyerOrderStatus,
  })
  @IsOptional()
  @IsEnum(BuyerOrderStatus)
  status?: BuyerOrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Filter by seller ID' })
  @IsOptional()
  @IsUUID()
  seller_id?: string;

  @ApiPropertyOptional({
    description: 'Search term (order number, product name)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  end_date?: string;

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

  @ApiPropertyOptional({ description: 'Product SKU' })
  product_sku?: string;

  @ApiProperty({ description: 'Unit price at time of order' })
  unit_price: number;

  @ApiProperty({ description: 'Quantity ordered' })
  quantity: number;

  @ApiProperty({ description: 'Total price for this item' })
  total_price: number;

  @ApiPropertyOptional({ description: 'Product image URL' })
  image_url?: string;

  @ApiPropertyOptional({ description: 'Product snapshot at time of order' })
  product_snapshot?: any;
}

export class BuyerOrderResponseDto {
  @ApiProperty({ description: 'Order ID' })
  id: string;

  @ApiPropertyOptional({
    description:
      'Checkout group ID (links split seller orders created from a single checkout)',
  })
  checkout_group_id?: string;

  @ApiProperty({ description: 'Order number' })
  order_number: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'Order status' })
  status: string;

  @ApiProperty({ description: 'Payment status' })
  payment_status: string;

  @ApiProperty({ description: 'Order items' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

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

  @ApiPropertyOptional({ description: 'When order was accepted' })
  accepted_at?: string;

  @ApiPropertyOptional({ description: 'When order was rejected' })
  rejected_at?: string;

  @ApiPropertyOptional({ description: 'When order was shipped' })
  shipped_at?: string;

  @ApiPropertyOptional({ description: 'When order was delivered' })
  delivered_at?: string;

  @ApiProperty({ description: 'Order created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Order updated timestamp' })
  updated_at: string;

  @ApiPropertyOptional({ description: 'Can this order be cancelled?' })
  can_cancel?: boolean;

  @ApiPropertyOptional({ description: 'Can this order be reviewed?' })
  can_review?: boolean;

  @ApiPropertyOptional({ description: 'Existing review for this order' })
  review?: any;
}

export class CancelOrderDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  @Length(1, 500)
  reason: string;
}

export class OrderReviewDto {
  @ApiProperty({ description: 'Overall rating (1-5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  overall_rating: number;

  @ApiPropertyOptional({
    description: 'Product quality rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  product_quality_rating?: number;

  @ApiPropertyOptional({
    description: 'Delivery rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  delivery_rating?: number;

  @ApiPropertyOptional({
    description: 'Service rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  service_rating?: number;

  @ApiPropertyOptional({ description: 'Review title' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Make review public', default: true })
  @IsOptional()
  is_public?: boolean = true;
}

export class OrderTimelineEventDto {
  @ApiProperty({ description: 'Event ID' })
  id: string;

  @ApiProperty({ description: 'Event type' })
  event_type: string;

  @ApiProperty({ description: 'Event description' })
  description: string;

  @ApiPropertyOptional({ description: 'Additional event data' })
  metadata?: any;

  @ApiProperty({ description: 'User who triggered the event' })
  created_by?: string;

  @ApiProperty({ description: 'Event timestamp' })
  created_at: string;
}

export class OrderSummaryDto {
  @ApiProperty({ description: 'Total orders placed' })
  total_orders: number;

  @ApiProperty({ description: 'Orders by status' })
  orders_by_status: Record<string, number>;

  @ApiProperty({ description: 'Total amount spent' })
  total_spent: number;

  @ApiProperty({ description: 'Average order value' })
  average_order_value: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Orders this month' })
  orders_this_month: number;

  @ApiProperty({ description: 'Amount spent this month' })
  spent_this_month: number;
}
