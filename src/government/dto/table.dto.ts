import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
} from 'class-validator';

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  CURRENCY = 'currency',
  PERCENTAGE = 'percentage',
  RATING = 'rating',
  FILE = 'file',
  RELATION = 'relation',
}

export class FieldDefinition {
  @ApiProperty({ example: 'farm_name' })
  id: string;

  @ApiProperty({ example: 'Farm Name' })
  name: string;

  @ApiProperty({ enum: FieldType })
  type: FieldType;

  @ApiProperty({ example: { required: true, placeholder: 'Enter farm name' } })
  config?: any;

  @ApiProperty({ example: true })
  visible?: boolean;

  @ApiProperty({ example: 200 })
  width?: number;
}

export class ViewDefinition {
  @ApiProperty({ example: 'all_farmers' })
  id: string;

  @ApiProperty({ example: 'All Farmers' })
  name: string;

  @ApiProperty({ example: 'table' })
  type: string; // table, kanban, calendar, gallery

  @ApiProperty({ example: {} })
  filters?: any;

  @ApiProperty({ example: {} })
  sorts?: any;

  @ApiProperty({ example: {} })
  grouping?: any;
}

export class CreateTableDto {
  @ApiProperty({
    example: 'Farmer Registry',
    description: 'Name of the table',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Registry of all farmers in our jurisdiction',
    description: 'Description of the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '🌾',
    description: 'Icon for the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    example: '#10B981',
    description: 'Color for the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    example: [{ id: 'farmers', name: 'Farmers' }],
    description: 'Data sources for the table',
  })
  @IsArray()
  dataSources: any[];

  @ApiProperty({
    example: [
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'size', name: 'Farm Size', type: 'number' },
    ],
    description: 'Field definitions for the table',
    required: false,
  })
  @IsOptional()
  @IsArray()
  fields?: FieldDefinition[];

  @ApiProperty({
    example: [{ id: 'default', name: 'Default View', type: 'table' }],
    description: 'View configurations',
    required: false,
  })
  @IsOptional()
  @IsArray()
  views?: ViewDefinition[];

  @ApiProperty({
    example: false,
    description: 'Whether the table is publicly accessible',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateTableDto {
  @ApiProperty({
    example: 'Updated Farmer Registry',
    description: 'Updated name of the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'Updated description of the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '🚜',
    description: 'Updated icon for the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    example: '#059669',
    description: 'Updated color for the table',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    example: [{ id: 'farmers', name: 'Farmers', filters: {} }],
    description: 'Updated data sources',
    required: false,
  })
  @IsOptional()
  @IsArray()
  dataSources?: any[];

  @ApiProperty({
    example: [{ id: 'name', name: 'Farm Name', type: 'text' }],
    description: 'Updated field definitions',
    required: false,
  })
  @IsOptional()
  @IsArray()
  fields?: FieldDefinition[];

  @ApiProperty({
    example: [{ id: 'default', name: 'All Records', type: 'table' }],
    description: 'Updated view configurations',
    required: false,
  })
  @IsOptional()
  @IsArray()
  views?: ViewDefinition[];

  @ApiProperty({
    example: true,
    description: 'Updated public accessibility',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class TableDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  governmentOrgId: string;

  @ApiProperty({ example: 'Farmer Registry' })
  name: string;

  @ApiProperty({ example: 'Registry of all farmers' })
  description?: string;

  @ApiProperty({ example: '🌾' })
  icon?: string;

  @ApiProperty({ example: '#10B981' })
  color?: string;

  @ApiProperty({ example: [{ id: 'farmers', name: 'Farmers' }] })
  dataSources: any[];

  @ApiProperty({ example: [{ id: 'name', name: 'Name', type: 'text' }] })
  fields: FieldDefinition[];

  @ApiProperty({ example: [{ id: 'default', name: 'Default View' }] })
  views: ViewDefinition[];

  @ApiProperty({ example: false })
  isPublic: boolean;

  @ApiProperty({ example: [] })
  allowedUsers: string[];

  @ApiProperty({ example: 'uuid' })
  createdBy?: string;

  @ApiProperty({ example: 'uuid' })
  updatedBy?: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  updatedAt: string;
}

export class TableQueryDto {
  @ApiProperty({
    example: 'farmer',
    description: 'Search term for table name or description',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    example: 1,
    description: 'Page number',
    required: false,
  })
  @IsOptional()
  page: number = 1;

  @ApiProperty({
    example: 20,
    description: 'Number of items per page',
    required: false,
  })
  @IsOptional()
  limit: number = 20;
}
