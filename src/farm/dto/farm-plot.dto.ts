import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreatePlotDto {
  @ApiProperty({ example: 'North Field' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Main plantain growing area' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  area_acreage?: number;

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
}

export class UpdatePlotDto {
  @ApiPropertyOptional({ example: 'South Field' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  area_acreage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  gps_lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  gps_lng?: number;
}

export class PlotResponseDto {
  id: string;
  farm_profile_id: string;
  org_id: string;
  name: string;
  description: string | null;
  area_acreage: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
}
