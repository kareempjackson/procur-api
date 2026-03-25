import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateCropSeasonDto {
  @ApiProperty({ example: 'Plantain' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  crop: string;

  @ApiPropertyOptional({ example: 'Dwarf Cavendish' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  variety?: string;

  @ApiPropertyOptional({ description: 'Month planting starts (1–12)', example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  plant_month_start?: number;

  @ApiPropertyOptional({ description: 'Month planting ends (1–12)', example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  plant_month_end?: number;

  @ApiProperty({ description: 'Month harvest starts (1–12)', example: 8 })
  @IsNumber()
  @Min(1)
  @Max(12)
  harvest_month_start: number;

  @ApiProperty({ description: 'Month harvest ends (1–12)', example: 11 })
  @IsNumber()
  @Min(1)
  @Max(12)
  harvest_month_end: number;

  @ApiPropertyOptional({ description: 'Typical yield in kg per acre', example: 4000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  typical_yield_kg_per_acre?: number;

  @ApiPropertyOptional({ example: 'Best yield in drier months' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCropSeasonDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) crop?: string;
  @IsOptional() @IsString() variety?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(12) plant_month_start?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(12) plant_month_end?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(12) harvest_month_start?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(12) harvest_month_end?: number;
  @IsOptional() @IsNumber() @Min(0) typical_yield_kg_per_acre?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CropSeasonResponseDto {
  id: string;
  org_id: string;
  crop: string;
  variety: string | null;
  plant_month_start: number | null;
  plant_month_end: number | null;
  harvest_month_start: number;
  harvest_month_end: number;
  typical_yield_kg_per_acre: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
