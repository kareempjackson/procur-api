import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
  IsObject,
} from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({ description: 'URL path prefix (e.g. gda, tnt, svg)', example: 'gda' })
  @IsString()
  @Length(2, 4)
  @Matches(/^[a-z]+$/, { message: 'Code must be lowercase letters only' })
  code: string;

  @ApiProperty({ description: 'Display name', example: 'Grenada' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code', example: 'GD' })
  @IsString()
  @Length(2, 2)
  country_code: string;

  @ApiProperty({ description: 'Currency code', example: 'XCD' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'IANA timezone', example: 'America/Grenada' })
  @IsString()
  timezone: string;

  @ApiPropertyOptional({ description: 'Branding overrides and feature flags' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class UpdateCountryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class CountryResponseDto {
  code: string;
  name: string;
  country_code: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
  // Stats (populated on detail view)
  org_count?: number;
  product_count?: number;
  seller_count?: number;
}
