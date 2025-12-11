import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsBoolean } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class AdminUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullname: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional({
    description:
      'Last time this admin user logged in (ISO 8601), null if never',
  })
  lastLogin?: string | null;
}

export class CreateAdminUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fullname: string;

  @ApiProperty({
    enum: UserRole,
    description: 'Role for the new admin user (admin or super_admin)',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    minLength: 8,
    description: 'Initial password for the admin (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullname?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Updated role for the admin user (admin or super_admin)',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    minLength: 8,
    description:
      'Optional new password for the admin (min 8 characters). If omitted, password is unchanged.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Whether the admin account is active. Setting to false effectively disables admin access.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
