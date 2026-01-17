import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
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

export class CreateDriverImageUploadUrlDto {
  @ApiProperty({ enum: ['profile', 'license'] })
  @IsString()
  @IsIn(['profile', 'license'])
  kind!: 'profile' | 'license';

  @ApiProperty({
    description: 'Original filename (used to infer extension for the storage key)',
    example: 'driver_license.jpg',
  })
  @IsString()
  @MaxLength(255)
  filename!: string;
}

export class DriverImageUploadUrlResponseDto {
  @ApiProperty()
  bucket!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  signedUrl!: string;

  @ApiProperty()
  token!: string;

  @ApiProperty({
    description:
      'Public URL for the uploaded object (suitable to store on the driver record)',
  })
  publicUrl!: string;
}
