import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload for PATCH /sellers/self-delivery-settings.
 *
 * Set `enabled` to false to opt out (clears the zone server-side). When true,
 * `localities` must be non-empty — the service enforces this so that an
 * "enabled but empty" state can't slip into the buyer checkout.
 */
export class UpdateSellerSelfDeliverySettingsDto {
  @ApiProperty({
    description:
      'Whether this seller offers self-delivery. When false, the buyer checkout will not show the "seller delivers it" option.',
  })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    description:
      'Cities or parishes (free text) the seller personally delivers to. Compared case-insensitively against the buyer\'s shipping address.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  localities?: string[];

  @ApiPropertyOptional({
    description:
      'Free-text note shown to the buyer when picking seller delivery (e.g. "Wed & Sat after 3pm only"). Pass an empty string to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SellerSelfDeliverySettingsResponse {
  @ApiProperty() enabled: boolean;
  @ApiProperty({ type: [String] }) localities: string[];
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
}
