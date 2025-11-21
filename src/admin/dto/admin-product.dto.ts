import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category?: string | null;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  basePrice: number;

  @ApiProperty()
  markupPercent: number;

  @ApiPropertyOptional()
  shortDescription?: string | null;

  @ApiPropertyOptional()
  longDescription?: string | null;

  @ApiPropertyOptional({ type: [String] })
  imageUrls?: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: string;
}

export class CreateAdminProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty()
  @IsNumber()
  markupPercent: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(280)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  longDescription?: string;

  @ApiPropertyOptional({ type: [String], description: 'Up to 5 image URLs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];
}

export class UpdateAdminProductDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  basePrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  markupPercent?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(280)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  longDescription?: string;

  @ApiPropertyOptional({ type: [String], description: 'Up to 5 image URLs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AdminProductQueryDto {
  @ApiPropertyOptional({ description: 'Search by name or category' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsNumber()
  @IsOptional()
  limit?: number;
}


