import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminOfflineOrderLineItemDto {
  @ApiProperty({ description: 'ID of an existing seller product' })
  @IsString()
  product_id: string;

  @ApiProperty({ description: 'Product name snapshot at time of order' })
  @IsString()
  product_name: string;

  @ApiPropertyOptional({
    description: 'Display unit for the product (e.g. kg, lb, crate)',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: 'Quantity purchased', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({
    description: 'Unit price charged to the buyer',
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  unit_price: number;
}

export class AdminCreateOfflineOrderDto {
  @ApiProperty({
    description: 'Seller organization id that fulfilled the order',
  })
  @IsString()
  seller_org_id: string;

  @ApiProperty({
    description: 'Buyer organization id that received the order',
  })
  @IsString()
  buyer_org_id: string;

  @ApiProperty({
    description:
      'Total order amount (excluding any implicit shipping that may be applied)',
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({
    description: 'Order currency (defaults to XCD)',
    default: 'XCD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description:
      "Logical order status (e.g. 'pending', 'accepted', 'shipped', 'delivered')",
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      "Payment status for this offline order (e.g. 'paid', 'pending', 'failed')",
  })
  @IsOptional()
  @IsString()
  payment_status?: string;

  @ApiPropertyOptional({
    description:
      'Short description or notes about this offline order (stored as buyer notes)',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Estimated or actual delivery date (ISO string)',
  })
  @IsOptional()
  @IsString()
  delivery_date?: string;

  @ApiPropertyOptional({
    description:
      'Lightweight shipping address snapshot. Shape is not strictly validated server-side.',
  })
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shipping_address?: any;

  @ApiPropertyOptional({
    description:
      'Optional line items for this offline order. When provided, the subtotal is computed from quantity × unit_price per item.',
    type: Array,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminOfflineOrderLineItemDto)
  line_items?: AdminOfflineOrderLineItemDto[];
}
