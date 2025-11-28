import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum ProductUnit {
  KG = 'kg',
  LB = 'lb',
  G = 'g',
  OZ = 'oz',
  L = 'l',
  ML = 'ml',
  GAL = 'gal',
  PIECE = 'piece',
  DOZEN = 'dozen',
  BOX = 'box',
  BAG = 'bag',
  BUNCH = 'bunch',
  CASE = 'case',
}

export enum ProductCategory {
  FRUITS = 'Fruits',
  VEGETABLES = 'Vegetables',
  HERBS = 'Herbs & Spices',
  GRAINS = 'Grains & Cereals',
  DAIRY = 'Dairy & Eggs',
  MEAT = 'Meat & Poultry',
  SEAFOOD = 'Seafood',
  BAKERY = 'Bakery',
  BEVERAGES = 'Beverages',
  OILS = 'Oils & Fats',
  CONDIMENTS = 'Condiments & Sauces',
  SNACKS = 'Snacks',
  FROZEN = 'Frozen Foods',
  CANNED = 'Canned Goods',
  OTHER = 'Other',
}

export class AdminProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ enum: ProductCategory })
  category?: ProductCategory | null;

  @ApiProperty({ enum: ProductUnit })
  unit: ProductUnit;

  @ApiProperty()
  basePrice: number;

  @ApiProperty()
  markupPercent: number;

  @ApiPropertyOptional()
  minSellerPrice?: number | null;

  @ApiPropertyOptional()
  maxSellerPrice?: number | null;

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

  @ApiProperty({ enum: ProductUnit })
  @IsEnum(ProductUnit)
  @IsNotEmpty()
  unit: ProductUnit;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty()
  @IsNumber()
  markupPercent: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  minSellerPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSellerPrice?: number;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

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

  @ApiPropertyOptional({ enum: ProductUnit })
  @IsEnum(ProductUnit)
  @IsOptional()
  unit?: ProductUnit;

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
  @IsNumber()
  @Min(0)
  @IsOptional()
  minSellerPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSellerPrice?: number;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

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
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}
