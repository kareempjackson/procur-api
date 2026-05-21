import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payload for PATCH /sellers/pickup-address. To disable pickup (set the column to NULL),
 * send { disabled: true }; the service ignores all other fields in that case.
 */
export class UpdateSellerPickupAddressDto {
  @ApiPropertyOptional({
    description:
      'When true, clears the pickup_address (sets to NULL). The seller stops offering pickup.',
  })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  street_address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  city?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  state?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  postal_code?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  country?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  contact_name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  contact_phone?: string;

  @ApiPropertyOptional({
    description: 'Free-text instructions shown to buyers on their order confirmation.',
  })
  @IsOptional() @IsString() @MaxLength(500)
  instructions?: string;

  @ApiPropertyOptional({ description: 'Display hours e.g. "Mon-Sat 9am-6pm".' })
  @IsOptional() @IsString() @MaxLength(120)
  hours?: string;
}

export class SellerPickupAddressResponse {
  @ApiProperty() enabled: boolean;
  @ApiPropertyOptional() street_address?: string;
  @ApiPropertyOptional() address_line2?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() postal_code?: string;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() contact_name?: string;
  @ApiPropertyOptional() contact_phone?: string;
  @ApiPropertyOptional() instructions?: string;
  @ApiPropertyOptional() hours?: string;
}
