import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHarvestLogDto {
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

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  harvest_date: string;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity_harvested?: number;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ example: 'Good quality, no visible disease' })
  @IsOptional()
  @IsString()
  quality_notes?: string;

  @ApiPropertyOptional({ description: 'Plot ID this harvest came from' })
  @IsOptional()
  @IsUUID()
  plot_id?: string;
}

export class UpdateHarvestLogDto {
  @ApiPropertyOptional({ example: 'Plantain' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  crop?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  variety?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  harvest_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity_harvested?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quality_notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  plot_id?: string;
}

export class HarvestLogQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'plantain' })
  @IsOptional()
  @IsString()
  crop?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  plot_id?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class HarvestLogResponseDto {
  id: string;
  seller_org_id: string;
  plot_id: string | null;
  plot?: { id: string; name: string } | null;
  crop: string;
  variety: string | null;
  harvest_date: string;
  quantity_harvested: number | null;
  unit: string | null;
  quality_notes: string | null;
  lot_code: string;
  responsible_party: string | null;
  created_at: string;
  updated_at: string;
}
