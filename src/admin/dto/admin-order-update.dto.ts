import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateOrderItemDto {
  @ApiPropertyOptional({ description: 'Existing order item ID (for updates/removals)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Product ID (for new items from catalog)' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Product name (for custom/offline items)' })
  @IsOptional()
  @IsString()
  product_name?: string;

  @ApiPropertyOptional({ description: 'Product SKU' })
  @IsOptional()
  @IsString()
  product_sku?: string;

  @ApiProperty({ description: 'Quantity (set to 0 to remove item)' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;
}

export class AdminUpdateOrderDto {
  @ApiPropertyOptional({
    description:
      'Updated order items. Include id to update existing, omit id to add new. Set quantity=0 to remove.',
    type: [AdminUpdateOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminUpdateOrderItemDto)
  items?: AdminUpdateOrderItemDto[];

  @ApiPropertyOptional({ description: 'Updated buyer notes' })
  @IsOptional()
  @IsString()
  buyer_notes?: string;

  @ApiPropertyOptional({ description: 'Updated seller notes (admin only)' })
  @IsOptional()
  @IsString()
  seller_notes?: string;

  @ApiPropertyOptional({ description: 'Updated internal notes (admin only)' })
  @IsOptional()
  @IsString()
  internal_notes?: string;

  @ApiPropertyOptional({ description: 'Updated preferred delivery date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  preferred_delivery_date?: string;

  @ApiPropertyOptional({ description: 'Updated shipping amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping_amount?: number;

  @ApiPropertyOptional({ description: 'Updated discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @ApiPropertyOptional({ description: 'Reason for update (for audit trail)' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  update_reason?: string;
}


