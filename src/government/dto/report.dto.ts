import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
} from 'class-validator';

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ReportFormat {
  PDF = 'pdf',
  XLSX = 'xlsx',
  CSV = 'csv',
}

export class CreateReportDto {
  @ApiProperty({
    example: 'Monthly Agricultural Report',
    description: 'Name of the report',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Comprehensive monthly report on agricultural activities',
    description: 'Description of the report',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['uuid-table-1', 'uuid-table-2'],
    description: 'Array of table IDs to include in the report',
    required: false,
  })
  @IsOptional()
  @IsArray()
  tables?: string[];

  @ApiProperty({
    example: ['uuid-chart-1', 'uuid-chart-2'],
    description: 'Array of chart IDs to include in the report',
    required: false,
  })
  @IsOptional()
  @IsArray()
  charts?: string[];

  @ApiProperty({
    example: {
      dateRange: { start: '2023-01-01', end: '2023-01-31' },
      regions: ['North', 'South'],
    },
    description: 'Global filters for the report',
    required: false,
  })
  @IsOptional()
  @IsObject()
  filters?: any;

  @ApiProperty({
    example: {
      includeCoverPage: true,
      includeTableOfContents: true,
      pageOrientation: 'portrait',
    },
    description: 'Report template configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  template?: any;

  @ApiProperty({
    enum: ReportFormat,
    example: ReportFormat.PDF,
    description: 'Output format for the report',
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat = ReportFormat.PDF;

  @ApiProperty({
    example: {
      frequency: 'monthly',
      dayOfMonth: 1,
      time: '09:00',
    },
    description: 'Scheduling configuration for automatic report generation',
    required: false,
  })
  @IsOptional()
  @IsObject()
  schedule?: any;
}

export class UpdateReportDto {
  @ApiProperty({
    example: 'Updated Report Name',
    description: 'Updated name of the report',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'Updated description of the report',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['uuid-table-3'],
    description: 'Updated array of table IDs',
    required: false,
  })
  @IsOptional()
  @IsArray()
  tables?: string[];

  @ApiProperty({
    example: ['uuid-chart-3'],
    description: 'Updated array of chart IDs',
    required: false,
  })
  @IsOptional()
  @IsArray()
  charts?: string[];

  @ApiProperty({
    example: { regions: ['East', 'West'] },
    description: 'Updated global filters',
    required: false,
  })
  @IsOptional()
  @IsObject()
  filters?: any;

  @ApiProperty({
    example: { pageOrientation: 'landscape' },
    description: 'Updated template configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  template?: any;

  @ApiProperty({
    enum: ReportFormat,
    example: ReportFormat.XLSX,
    description: 'Updated output format',
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiProperty({
    example: { frequency: 'weekly' },
    description: 'Updated scheduling configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  schedule?: any;
}

export class ReportDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  governmentOrgId: string;

  @ApiProperty({ example: 'Monthly Agricultural Report' })
  name: string;

  @ApiProperty({ example: 'Comprehensive monthly report' })
  description?: string;

  @ApiProperty({ example: ['uuid-table-1'] })
  tables: string[];

  @ApiProperty({ example: ['uuid-chart-1'] })
  charts: string[];

  @ApiProperty({ example: { dateRange: { start: '2023-01-01' } } })
  filters?: any;

  @ApiProperty({ example: { includeCoverPage: true } })
  template?: any;

  @ApiProperty({ enum: ReportFormat })
  format: ReportFormat;

  @ApiProperty({ example: { frequency: 'monthly' } })
  schedule?: any;

  @ApiProperty({ enum: ReportStatus })
  status: ReportStatus;

  @ApiProperty({ example: 'https://storage.example.com/reports/report.pdf' })
  fileUrl?: string;

  @ApiProperty({ example: '2023-02-01T10:30:00Z' })
  generatedAt?: string;

  @ApiProperty({ example: '2023-03-01T10:30:00Z' })
  expiresAt?: string;

  @ApiProperty({ example: 'uuid' })
  createdBy?: string;

  @ApiProperty({ example: 'uuid' })
  updatedBy?: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  updatedAt: string;
}

export class ReportQueryDto {
  @ApiProperty({
    example: 'agricultural',
    description: 'Search term for report name or description',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: ReportStatus,
    example: ReportStatus.COMPLETED,
    description: 'Filter by report status',
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiProperty({
    enum: ReportFormat,
    example: ReportFormat.PDF,
    description: 'Filter by report format',
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;
}

export class GenerateReportResponseDto {
  @ApiProperty({ example: 'uuid' })
  reportId: string;

  @ApiProperty({ enum: ReportStatus })
  status: ReportStatus;

  @ApiProperty({ example: 'Report generation started successfully' })
  message: string;

  @ApiProperty({ example: 120 })
  estimatedCompletionTime?: number; // seconds
}
