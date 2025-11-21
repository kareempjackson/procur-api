import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdminOrderQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by order status (accepted, shipped, delivered, etc.)',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment status (paid, pending, failed, etc.)',
  })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by buyer organization id',
  })
  @IsString()
  @IsOptional()
  buyerOrgId?: string;

  @ApiPropertyOptional({
    description: 'Filter by seller organization id',
  })
  @IsString()
  @IsOptional()
  sellerOrgId?: string;

  @ApiPropertyOptional({
    description: 'Free text search across order number and organization names',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
