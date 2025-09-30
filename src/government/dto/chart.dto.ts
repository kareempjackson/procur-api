import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  AREA = 'area',
  SCATTER = 'scatter',
  TABLE = 'table',
  METRIC = 'metric',
  MAP = 'map',
}

export class CreateChartDto {
  @ApiProperty({
    example: 'uuid-table-id',
    description: 'ID of the table this chart is based on',
    required: false,
  })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiProperty({
    example: 'Farmer Registration Trends',
    description: 'Name of the chart',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Shows farmer registration trends over time',
    description: 'Description of the chart',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: ChartType,
    example: ChartType.LINE,
    description: 'Type of chart',
  })
  @IsEnum(ChartType)
  chartType: ChartType;

  @ApiProperty({
    example: {
      colors: ['#3B82F6', '#10B981'],
      showLegend: true,
      showGrid: true,
    },
    description: 'Chart-specific configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiProperty({
    example: {
      xAxis: 'created_at',
      yAxis: 'count',
      groupBy: 'month',
      filters: {},
    },
    description: 'Data configuration for the chart',
  })
  @IsObject()
  dataConfig: any;

  @ApiProperty({
    example: 6,
    description: 'Width of the chart in grid units (1-12)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  width?: number = 6;

  @ApiProperty({
    example: 4,
    description: 'Height of the chart in grid units',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  height?: number = 4;

  @ApiProperty({
    example: { x: 0, y: 0 },
    description: 'Position of the chart',
    required: false,
  })
  @IsOptional()
  @IsObject()
  position?: any;
}

export class UpdateChartDto {
  @ApiProperty({
    example: 'Updated Chart Name',
    description: 'Updated name of the chart',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'Updated description of the chart',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: ChartType,
    example: ChartType.BAR,
    description: 'Updated chart type',
    required: false,
  })
  @IsOptional()
  @IsEnum(ChartType)
  chartType?: ChartType;

  @ApiProperty({
    example: { colors: ['#EF4444', '#F59E0B'] },
    description: 'Updated chart configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiProperty({
    example: { xAxis: 'date', yAxis: 'revenue' },
    description: 'Updated data configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  dataConfig?: any;

  @ApiProperty({
    example: 8,
    description: 'Updated width',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  width?: number;

  @ApiProperty({
    example: 6,
    description: 'Updated height',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  height?: number;

  @ApiProperty({
    example: { x: 6, y: 0 },
    description: 'Updated position',
    required: false,
  })
  @IsOptional()
  @IsObject()
  position?: any;

  @ApiProperty({
    example: true,
    description: 'Whether the chart is active',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ChartDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  governmentOrgId: string;

  @ApiProperty({ example: 'uuid' })
  tableId?: string;

  @ApiProperty({ example: 'Farmer Registration Trends' })
  name: string;

  @ApiProperty({ example: 'Shows trends over time' })
  description?: string;

  @ApiProperty({ enum: ChartType })
  chartType: ChartType;

  @ApiProperty({ example: { colors: ['#3B82F6'] } })
  config: any;

  @ApiProperty({ example: { xAxis: 'created_at', yAxis: 'count' } })
  dataConfig: any;

  @ApiProperty({ example: 6 })
  width: number;

  @ApiProperty({ example: 4 })
  height: number;

  @ApiProperty({ example: { x: 0, y: 0 } })
  position: any;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'uuid' })
  createdBy?: string;

  @ApiProperty({ example: 'uuid' })
  updatedBy?: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  updatedAt: string;
}

export class ChartQueryDto {
  @ApiProperty({
    example: 'trends',
    description: 'Search term for chart name or description',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    example: 'uuid-table-id',
    description: 'Filter by table ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiProperty({
    enum: ChartType,
    example: ChartType.LINE,
    description: 'Filter by chart type',
    required: false,
  })
  @IsOptional()
  @IsEnum(ChartType)
  chartType?: ChartType;
}
