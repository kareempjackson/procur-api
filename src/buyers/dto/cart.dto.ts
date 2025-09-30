import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsPositive,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID to add to cart' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ description: 'Quantity to add', example: 2 })
  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity for the cart item', example: 5 })
  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CartItemResponseDto {
  @ApiProperty({ description: 'Cart item ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  product_id: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiProperty({ description: 'Product SKU' })
  product_sku?: string;

  @ApiProperty({ description: 'Unit price' })
  unit_price: number;

  @ApiProperty({ description: 'Sale price if applicable' })
  sale_price?: number;

  @ApiProperty({ description: 'Quantity in cart' })
  quantity: number;

  @ApiProperty({ description: 'Total price for this item' })
  total_price: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Product image URL' })
  image_url?: string;

  @ApiProperty({ description: 'Stock availability' })
  stock_quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  unit_of_measurement: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'When item was added to cart' })
  added_at: string;
}

export class CartSellerGroupDto {
  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'Items from this seller' })
  @ValidateNested({ each: true })
  @Type(() => CartItemResponseDto)
  items: CartItemResponseDto[];

  @ApiProperty({ description: 'Subtotal for this seller' })
  subtotal: number;

  @ApiProperty({ description: 'Estimated shipping cost' })
  estimated_shipping: number;

  @ApiProperty({ description: 'Total for this seller including shipping' })
  total: number;
}

export class CartResponseDto {
  @ApiProperty({ description: 'Cart ID' })
  id: string;

  @ApiProperty({ description: 'Items grouped by seller' })
  @ValidateNested({ each: true })
  @Type(() => CartSellerGroupDto)
  seller_groups: CartSellerGroupDto[];

  @ApiProperty({ description: 'Total number of items' })
  total_items: number;

  @ApiProperty({ description: 'Total number of unique products' })
  unique_products: number;

  @ApiProperty({ description: 'Cart subtotal' })
  subtotal: number;

  @ApiProperty({ description: 'Total estimated shipping' })
  estimated_shipping: number;

  @ApiProperty({ description: 'Estimated tax amount' })
  estimated_tax: number;

  @ApiProperty({ description: 'Cart total' })
  total: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Last updated timestamp' })
  updated_at: string;
}

export class CartCalculationDto {
  @ApiPropertyOptional({ description: 'Shipping address for calculation' })
  @IsOptional()
  @IsUUID()
  shipping_address_id?: string;

  @ApiPropertyOptional({ description: 'Apply tax calculation' })
  @IsOptional()
  include_tax?: boolean = true;

  @ApiPropertyOptional({ description: 'Apply shipping calculation' })
  @IsOptional()
  include_shipping?: boolean = true;
}

export class CartSummaryDto {
  @ApiProperty({ description: 'Number of items in cart' })
  total_items: number;

  @ApiProperty({ description: 'Number of unique products' })
  unique_products: number;

  @ApiProperty({ description: 'Number of different sellers' })
  seller_count: number;

  @ApiProperty({ description: 'Cart subtotal' })
  subtotal: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;
}
