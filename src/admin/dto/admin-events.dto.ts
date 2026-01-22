import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AdminEventsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by event type (partial match, e.g. "admin.user")',
  })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Filter by aggregate type (e.g. "user", "order", "product")',
  })
  @IsString()
  @IsOptional()
  aggregateType?: string;

  @ApiPropertyOptional({
    description: 'Filter by aggregate ID (the target entity ID)',
  })
  @IsUUID()
  @IsOptional()
  aggregateId?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor (admin) user ID',
  })
  @IsUUID()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by organization ID',
  })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across event type and aggregate type',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter events created after this ISO date',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter events created before this ISO date',
  })
  @IsDateString()
  @IsOptional()
  to?: string;
}

