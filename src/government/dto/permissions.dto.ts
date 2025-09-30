import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsUUID } from 'class-validator';

export class RolePermissionDto {
  @ApiProperty({ example: 'uuid' })
  roleId: string;

  @ApiProperty({ example: 'inspector' })
  roleName: string;

  @ApiProperty({ example: 'Inspector' })
  roleDisplayName: string;

  @ApiProperty({ example: ['view_government_data', 'edit_seller_data'] })
  permissions: string[];

  @ApiProperty({ example: 5 })
  userCount: number;
}

export class AvailablePermissionDto {
  @ApiProperty({ example: 'manage_government_tables' })
  name: string;

  @ApiProperty({ example: 'Manage Government Tables' })
  displayName: string;

  @ApiProperty({ example: 'Create, edit, and delete government data tables' })
  description: string;

  @ApiProperty({ example: 'government' })
  category: string;
}

export class AssignPermissionsDto {
  @ApiProperty({
    example: 'uuid-role-id',
    description: 'ID of the role to assign permissions to',
  })
  @IsUUID()
  roleId: string;

  @ApiProperty({
    example: ['manage_government_tables', 'create_government_charts'],
    description: 'Array of permission names to assign',
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({
    example: 'Granting additional permissions for data analysis',
    description: 'Reason for assigning these permissions',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokePermissionsDto {
  @ApiProperty({
    example: 'uuid-role-id',
    description: 'ID of the role to revoke permissions from',
  })
  @IsUUID()
  roleId: string;

  @ApiProperty({
    example: ['manage_government_tables'],
    description: 'Array of permission names to revoke',
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({
    example: 'Removing permissions due to role change',
    description: 'Reason for revoking these permissions',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PermissionChangeLogDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  roleId: string;

  @ApiProperty({ example: 'inspector' })
  roleName: string;

  @ApiProperty({ example: 'manage_government_tables' })
  permissionName: string;

  @ApiProperty({ example: 'granted' })
  action: 'granted' | 'revoked';

  @ApiProperty({ example: 'uuid' })
  grantedBy: string;

  @ApiProperty({ example: 'John Admin' })
  grantedByName: string;

  @ApiProperty({ example: 'Granting additional permissions for data analysis' })
  reason?: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  grantedAt: string;
}

export class CreateCustomRoleDto {
  @ApiProperty({
    example: 'data_analyst',
    description: 'Unique name for the role (lowercase, underscores)',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Data Analyst',
    description: 'Display name for the role',
  })
  @IsString()
  displayName: string;

  @ApiProperty({
    example: 'Analyzes government data and creates reports',
    description: 'Description of the role',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['view_government_data', 'create_government_charts'],
    description: 'Initial permissions to assign to this role',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateCustomRoleDto {
  @ApiProperty({
    example: 'Senior Data Analyst',
    description: 'Updated display name for the role',
    required: false,
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    example: 'Senior analyst with advanced data access',
    description: 'Updated description of the role',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
