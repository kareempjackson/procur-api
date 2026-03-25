import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsUUID,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreatePackingRecordDto {
  @ApiProperty({ example: '2026-03-16', description: 'Date produce was packed' })
  @IsDateString()
  packing_date: string;

  @ApiProperty({ example: 'Grenada Agricultural Processing Centre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  packing_facility_name: string;

  @ApiPropertyOptional({ example: 'Frequente Industrial Park, St. George' })
  @IsOptional()
  @IsString()
  packing_facility_address?: string;

  @ApiPropertyOptional({ example: 'GD', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  packing_facility_country?: string;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @IsNumber()
  quantity_packed?: number;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ example: 'US', description: 'Destination country (ISO 3166-1 alpha-2)' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  ship_to_country?: string;

  @ApiPropertyOptional({ enum: ['air', 'sea', 'road'], example: 'air' })
  @IsOptional()
  @IsString()
  @IsIn(['air', 'sea', 'road'])
  transport_mode?: string;

  @ApiPropertyOptional({ example: 'Caribbean Airlines Cargo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  carrier_name?: string;

  @ApiPropertyOptional({ example: 'BL-2026-001234' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bill_of_lading?: string;

  @ApiPropertyOptional({ example: '2026-03-18' })
  @IsOptional()
  @IsDateString()
  expected_ship_date?: string;

  @ApiPropertyOptional({ example: 'Packed in 20kg cartons, pre-cooled to 12°C' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PackingRecordResponseDto {
  id: string;
  harvest_log_id: string;
  seller_org_id: string;
  packing_date: string;
  packing_facility_name: string;
  packing_facility_address: string | null;
  packing_facility_country: string;
  quantity_packed: number | null;
  unit: string | null;
  ship_to_country: string | null;
  transport_mode: string | null;
  carrier_name: string | null;
  bill_of_lading: string | null;
  expected_ship_date: string | null;
  notes: string | null;
  responsible_party: string | null;
  created_at: string;
  updated_at: string;
}

export class UpdatePackingRecordDto {
  @IsOptional() @IsDateString()         packing_date?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) packing_facility_name?: string;
  @IsOptional() @IsString()             packing_facility_address?: string;
  @IsOptional() @IsString() @MaxLength(2) packing_facility_country?: string;
  @IsOptional() @IsNumber()             quantity_packed?: number;
  @IsOptional() @IsString() @MaxLength(50) unit?: string;
  @IsOptional() @IsString() @MaxLength(2)  ship_to_country?: string;
  @IsOptional() @IsString() @IsIn(['air', 'sea', 'road']) transport_mode?: string;
  @IsOptional() @IsString() @MaxLength(255) carrier_name?: string;
  @IsOptional() @IsString() @MaxLength(100) bill_of_lading?: string;
  @IsOptional() @IsDateString()         expected_ship_date?: string;
  @IsOptional() @IsString()             notes?: string;
}
