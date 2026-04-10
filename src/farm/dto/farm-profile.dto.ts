import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class CertificationDto {
  @ApiProperty({ example: 'organic' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 'USDA' })
  @IsOptional()
  @IsString()
  certifier?: string;

  @ApiPropertyOptional({ example: 'ORG-12345' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsString()
  issued?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  expires?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  document_url?: string;
}

export class UpsertFarmProfileDto {
  @ApiPropertyOptional({ example: 12.1165 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  gps_lat?: number;

  @ApiPropertyOptional({ example: -61.679 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  gps_lng?: number;

  @ApiPropertyOptional({ example: 'St. Andrew' })
  @IsOptional()
  @IsString()
  parish?: string;

  @ApiPropertyOptional({ example: 'GD' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '123 Main Road, Basseterre' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_acreage?: number;

  @ApiPropertyOptional({ example: ['plantain', 'bok choi'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primary_crops?: string[];

  @ApiPropertyOptional({ type: [CertificationDto] })
  @IsOptional()
  @IsArray()
  certifications?: CertificationDto[];
}

export class FarmProfileResponseDto {
  id: string;
  org_id: string;
  gps_lat: number | null;
  gps_lng: number | null;
  parish: string | null;
  country: string;
  address: string | null;
  total_acreage: number | null;
  primary_crops: string[] | null;
  certifications: CertificationDto[];
  created_at: string;
  updated_at: string;
}
