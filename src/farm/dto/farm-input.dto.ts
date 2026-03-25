import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsUUID,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';

const INPUT_TYPES = ['fertilizer', 'pesticide', 'herbicide', 'seed', 'irrigation', 'other'] as const;

export class CreateFarmInputDto {
  @ApiProperty({ enum: INPUT_TYPES, example: 'pesticide' })
  @IsString()
  @IsIn(INPUT_TYPES)
  input_type: string;

  @ApiProperty({ example: 'Roundup Ready' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  product_name: string;

  @ApiPropertyOptional({ example: 'Bayer CropScience' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;

  @ApiPropertyOptional({ example: 'Glyphosate 41%' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  active_ingredient?: string;

  @ApiProperty({ example: '2026-03-10' })
  @IsDateString()
  application_date: string;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'liters' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Days after application before safe to harvest (withdrawal period)',
    example: 14,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawal_period_days?: number;

  @ApiPropertyOptional({ description: 'Plot this input was applied to' })
  @IsOptional()
  @IsUUID()
  plot_id?: string;

  @ApiPropertyOptional({ example: 'Applied at 2.5L/ha before rain' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFarmInputDto {
  @IsOptional() @IsString() @IsIn(INPUT_TYPES) input_type?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) product_name?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() active_ingredient?: string;
  @IsOptional() @IsDateString() application_date?: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) withdrawal_period_days?: number;
  @IsOptional() @IsUUID() plot_id?: string;
  @IsOptional() @IsString() notes?: string;
}

export class FarmInputResponseDto {
  id: string;
  org_id: string;
  plot_id: string | null;
  plot_name?: string | null;
  input_type: string;
  product_name: string;
  brand: string | null;
  active_ingredient: string | null;
  application_date: string;
  quantity: number | null;
  unit: string | null;
  withdrawal_period_days: number;
  safe_to_harvest_after: string; // computed: application_date + withdrawal_period_days
  is_within_withdrawal: boolean; // computed against today
  applied_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
