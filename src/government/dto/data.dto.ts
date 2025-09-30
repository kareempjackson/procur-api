import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';

export class DataSourceDto {
  @ApiProperty({ example: 'farmers' })
  id: string;

  @ApiProperty({ example: 'Farmers' })
  name: string;

  @ApiProperty({ example: 'All farmer organizations in the country' })
  description: string;

  @ApiProperty({ example: 'organizations' })
  table: string;

  @ApiProperty({
    example: { account_type: 'seller', business_type: 'farmers' },
  })
  filters?: any;

  @ApiProperty({ example: [] })
  joins?: any[];
}

export class TableDataQueryDto {
  @ApiProperty({
    example: 'uuid-view-id',
    description: 'View ID to apply (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  viewId?: string;

  @ApiProperty({
    example: { name: 'Green Valley' },
    description: 'Additional filters to apply',
    required: false,
  })
  @IsOptional()
  @IsObject()
  filters?: any;

  @ApiProperty({
    example: { field: 'created_at', direction: 'desc' },
    description: 'Sorting configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  sort?: any;

  @ApiProperty({
    example: 1,
    description: 'Page number',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiProperty({
    example: 50,
    description: 'Number of items per page',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit: number = 50;

  @ApiProperty({
    example: ['id', 'name', 'created_at'],
    description: 'Fields to include in the response',
    required: false,
  })
  @IsOptional()
  @IsArray()
  fields?: string[];
}

export class TableDataResponseDto {
  @ApiProperty({ example: [] })
  data: any[];

  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: { name: 'text', size: 'number' } })
  schema?: any;
}

export class ChartDataQueryDto {
  @ApiProperty({
    example: { startDate: '2023-01-01', endDate: '2023-12-31' },
    description: 'Additional filters for chart data',
    required: false,
  })
  @IsOptional()
  @IsObject()
  filters?: any;

  @ApiProperty({
    example: 'month',
    description: 'Time grouping for time-based charts',
    required: false,
  })
  @IsOptional()
  @IsString()
  timeGrouping?: string;
}

export class ChartDataResponseDto {
  @ApiProperty({ example: [] })
  data: any[];

  @ApiProperty({ example: { xAxis: 'date', yAxis: 'count' } })
  config: any;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  generatedAt: string;

  @ApiProperty({ example: 300 })
  cacheDuration: number; // seconds
}
