import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CountryPulseSignal } from '../../database/types/database.types';

export const COUNTRY_PULSE_SIGNALS: CountryPulseSignal[] = [
  'in_demand',
  'scarce',
  'trending',
  'surplus',
];

export class PulseEntryDto {
  id!: string;
  source!: 'snapshot' | 'override';
  signal_type!: CountryPulseSignal;
  rank!: number;
  label!: string;
  note?: string | null;
  product_id?: string | null;
  category?: string | null;
  score?: number;
  metrics?: Record<string, unknown>;
  is_pinned?: boolean;
  // Hydrated product fields (best-effort)
  product_name?: string | null;
  product_image_url?: string | null;
  seller_name?: string | null;
  stock_quantity?: number | null;
  base_price?: number | null;
  currency?: string | null;
}

export class CountryPulseResponseDto {
  country_id!: string;
  computed_at?: string | null;
  signals!: Record<CountryPulseSignal, PulseEntryDto[]>;
}

export class CreatePulseOverrideDto {
  @IsEnum(['in_demand', 'scarce', 'trending', 'surplus'])
  signal_type!: CountryPulseSignal;

  @IsString()
  @MaxLength(255)
  label!: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  is_hidden?: boolean;

  @IsOptional()
  @IsString()
  valid_from?: string;

  @IsOptional()
  @IsString()
  valid_until?: string;
}

export class UpdatePulseOverrideDto {
  @IsOptional()
  @IsEnum(['in_demand', 'scarce', 'trending', 'surplus'])
  signal_type?: CountryPulseSignal;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  is_hidden?: boolean;

  @IsOptional()
  @IsString()
  valid_from?: string | null;

  @IsOptional()
  @IsString()
  valid_until?: string | null;
}
