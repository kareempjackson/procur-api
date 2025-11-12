import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+1-555-123-4567',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 50)
  phone?: string;

  @ApiPropertyOptional({ description: 'User first name', example: 'Jane' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Organization legal business name',
    example: 'Acme Foods LLC',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 255)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Organization display name',
    example: 'Acme',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Organization business type',
    example: 'farmers',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 100)
  businessType?: string;

  @ApiPropertyOptional({
    description: 'Organization address line',
    example: '123 Market St',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 255)
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'San Francisco' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({ description: 'State or province', example: 'CA' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '94103' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'United States' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Organization website',
    example: 'https://acmefoods.example',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 255)
  website?: string;

  @ApiPropertyOptional({ description: 'Organization description' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 2000)
  description?: string;

  @ApiPropertyOptional({
    description: "URL to farmer's ID image stored in Supabase Storage",
    example:
      'https://xyz.supabase.co/storage/v1/object/public/ids/farmers/abc123.jpg',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 2048)
  farmersIdUrl?: string;

  @ApiPropertyOptional({
    description: "Private storage path for farmer's ID (preferred)",
    example: 'ids/private/farmers/<organizationId>/<uuid>.jpg',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 2048)
  farmersIdPath?: string;

  @ApiPropertyOptional({
    description: "Private storage path for user's avatar (preferred)",
    example: 'avatars/users/<userId>/<uuid>.jpg',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @Length(1, 2048)
  avatarPath?: string;
}
