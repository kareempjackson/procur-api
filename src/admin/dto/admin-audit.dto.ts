import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class AdminAuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by user id (actor user_id)',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by HTTP method (GET, POST, PATCH, DELETE, etc.)',
  })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiPropertyOptional({
    description: 'Filter by status code (exact match)',
  })
  @IsInt()
  @IsOptional()
  statusCode?: number;

  @ApiPropertyOptional({
    description: 'Filter by action substring (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by route substring (case-insensitive)',
  })
  @IsString()
  @IsOptional()
  routeContains?: string;

  @ApiPropertyOptional({
    description:
      'Free-text search across actor email, action, resource and route',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter logs created after this ISO date',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter logs created before this ISO date',
  })
  @IsDateString()
  @IsOptional()
  to?: string;
}
