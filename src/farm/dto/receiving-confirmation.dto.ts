import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivingItemDto {
  @ApiProperty({ description: 'Order item ID' })
  @IsUUID()
  order_item_id: string;

  @ApiPropertyOptional({ description: 'Lot code on this item (from order_items)' })
  @IsOptional()
  @IsString()
  lot_code?: string;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity_received?: number;

  @ApiPropertyOptional({
    description: 'Condition score 1–5 (1=rejected, 5=excellent)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  condition_score?: number;

  @ApiPropertyOptional({ example: 'Slight bruising on outer layer, otherwise good' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReceivingConfirmationDto {
  @ApiProperty({ example: '2026-03-20' })
  @IsDateString()
  received_date: string;

  @ApiPropertyOptional({ example: 'Miami Distribution Center' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiving_facility?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  receiving_country?: string;

  @ApiProperty({ type: [ReceivingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivingItemDto)
  items: ReceivingItemDto[];

  @ApiPropertyOptional({ description: 'Overall condition score 1–5', minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  overall_condition?: number;

  @ApiPropertyOptional({ description: 'Temperature on arrival in Celsius', example: 12.5 })
  @IsOptional()
  @IsNumber()
  temperature_on_arrival?: number;

  @ApiPropertyOptional({ description: 'Was temperature within acceptable range?' })
  @IsOptional()
  @IsBoolean()
  temperature_compliant?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  has_rejection?: boolean;

  @ApiPropertyOptional({ example: 'Damaged packaging on 10kg of plantain' })
  @IsOptional()
  @IsString()
  rejection_reason?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rejected_quantity?: number;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  rejected_unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivingConfirmationResponseDto {
  id: string;
  order_id: string;
  buyer_org_id: string;
  seller_org_id: string;
  received_date: string;
  received_by: string | null;
  receiving_facility: string | null;
  receiving_country: string;
  items: ReceivingItemDto[];
  overall_condition: number | null;
  temperature_on_arrival: number | null;
  temperature_compliant: boolean | null;
  has_rejection: boolean;
  rejection_reason: string | null;
  rejected_quantity: number | null;
  rejected_unit: string | null;
  notes: string | null;
  created_at: string;
}
