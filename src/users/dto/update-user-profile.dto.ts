import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Trim a string field without coercing empty strings into undefined.
// Empty string → empty string (the user explicitly cleared the field).
// Non-string → passed through (lets @IsOptional handle null/undefined).
const trimPreserveEmpty = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'Kevin Durant',
  })
  // Required-when-present: if the caller sends fullname at all, it can't be
  // an empty string. Omitting the field entirely (typical save paths that
  // only send changed sections) is still allowed.
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 200, { message: 'Full name cannot be empty.' })
  fullname?: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+1-555-123-4567',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'User first name', example: 'Jane' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Organization legal business name',
    example: 'Acme Foods LLC',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Organization display name',
    example: 'Acme',
  })
  // Required-when-present: org display name can't be cleared.
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 255, { message: 'Organization name cannot be empty.' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Organization business type',
    example: 'farmers',
  })
  // Required-when-present: business type drives discovery and access rules.
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 100, { message: 'Business type cannot be empty.' })
  businessType?: string;

  @ApiPropertyOptional({
    description: 'Organization address line',
    example: '123 Market St',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'San Francisco' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'State or province', example: 'CA' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '94103' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'United States' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Organization website',
    example: 'https://acmefoods.example',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ description: 'Organization description' })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Preferred payout method for this organization',
    example: 'cash',
    enum: ['cash', 'cheque'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === '' ? undefined : v;
    }
    return value;
  })
  @IsString()
  @IsIn(['cash', 'cheque'])
  payoutMethod?: 'cash' | 'cheque';

  @ApiPropertyOptional({
    description: "URL to farmer's ID image stored in Supabase Storage",
    example:
      'https://xyz.supabase.co/storage/v1/object/public/ids/farmers/abc123.jpg',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 2048)
  farmersIdUrl?: string;

  @ApiPropertyOptional({
    description: "Private storage path for farmer's ID (preferred)",
    example: 'ids/private/farmers/<organizationId>/<uuid>.jpg',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 2048)
  farmersIdPath?: string;

  @ApiPropertyOptional({
    description: 'Organization tax ID or business number',
    example: '123-456-789',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Organization registration number',
    example: 'BRN-987654',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({
    description:
      'Private storage path for organization logo (in public bucket)',
    example: 'logos/organizations/<orgId>/<uuid>.jpg',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 2048)
  logoPath?: string;

  @ApiPropertyOptional({
    description:
      'Private storage path for organization header image (in public bucket)',
    example: 'headers/organizations/<orgId>/<uuid>.jpg',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 2048)
  headerImagePath?: string;

  @ApiPropertyOptional({
    description: "Private storage path for user's avatar (preferred)",
    example: 'avatars/users/<userId>/<uuid>.jpg',
  })
  @IsOptional()
  @Transform(trimPreserveEmpty)
  @IsString()
  @Length(1, 2048)
  avatarPath?: string;
}
