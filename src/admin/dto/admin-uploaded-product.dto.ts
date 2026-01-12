import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUploadedProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category?: string | null;

  @ApiPropertyOptional()
  unitOfMeasurement?: string | null;

  @ApiProperty({ description: 'Base price per unit' })
  basePrice: number;

  @ApiPropertyOptional({ description: 'Sale price per unit (optional)' })
  salePrice?: number | null;

  @ApiProperty({ description: 'Currency code (e.g. XCD)' })
  currency: string;

  @ApiProperty({ description: 'Current stock quantity for this seller product' })
  stockQuantity: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  sellerOrgId: string;

  @ApiPropertyOptional()
  sellerOrgName?: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class AdminUploadedProductAggregateResponseDto {
  @ApiProperty({
    description:
      'Aggregation id. Uses admin_product_id when present, otherwise a derived key.',
  })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category?: string | null;

  @ApiPropertyOptional()
  unitOfMeasurement?: string | null;

  @ApiProperty({ description: 'Currency code or MIXED' })
  currency: string;

  @ApiProperty({ description: 'Total stock quantity across all sellers' })
  totalQuantity: number;

  @ApiProperty({ description: 'Number of distinct sellers carrying this item' })
  sellerCount: number;

  @ApiProperty({ description: 'Minimum observed price across sellers' })
  minPrice: number;

  @ApiProperty({ description: 'Maximum observed price across sellers' })
  maxPrice: number;

  @ApiProperty({ description: 'Average observed price across sellers' })
  avgPrice: number;
}

export class AdminUploadedProductQueryDto {
  @ApiPropertyOptional({
    description: 'Search by product name (case-insensitive, partial match)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by seller organization id' })
  @IsString()
  @IsOptional()
  sellerOrgId?: string;

  @ApiPropertyOptional({ description: 'Filter by product status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by product category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'View mode',
    enum: ['by_seller', 'aggregate'],
    default: 'by_seller',
  })
  @IsString()
  @IsOptional()
  view?: 'by_seller' | 'aggregate';

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}


