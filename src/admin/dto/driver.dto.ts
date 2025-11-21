import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminDriverResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullname: string;

  @ApiPropertyOptional()
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  profileImg?: string | null;

  @ApiPropertyOptional({
    description: 'Driver license image URL or identifier',
  })
  driverLicenseImg?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  lastLogin?: string | null;

  @ApiProperty()
  createdAt: string;
}

export class CreateDriverDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fullname: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  profileImg?: string;

  @ApiPropertyOptional({
    description: 'Driver license image URL or identifier',
  })
  @IsString()
  @IsOptional()
  driverLicenseImg?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fullname?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  profileImg?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  driverLicenseImg?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
