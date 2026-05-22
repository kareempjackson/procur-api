import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class OnboardBecomeRoleDto {
  @ApiProperty({
    example: "Maria's Farm",
    description:
      'Display name for the new organization. Shown in marketplace listings and order receipts.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName: string;

  @ApiProperty({
    example: 'farmers',
    required: false,
    description:
      'Business category. Valid values come from BuyerBusinessType / SellerBusinessType depending on the role being created. Defaults to "general" when omitted; the user can refine it later in business settings.',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiProperty({
    example: 'gda',
    required: false,
    description:
      'ISO/internal country code for the new org. Defaults to the user\'s home country (users.default_country_id) if omitted.',
  })
  @IsOptional()
  @IsString()
  countryId?: string;
}
