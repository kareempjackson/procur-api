import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
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
