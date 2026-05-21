import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmPaymentMethodDto {
  @ApiProperty({
    description: 'Stripe PaymentMethod id (pm_...) returned by the client SDK after SetupIntent confirmation',
    example: 'pm_1Abc23def45',
  })
  @IsString()
  @IsNotEmpty()
  stripe_payment_method_id: string;
}

export class SavedPaymentMethodResponse {
  @ApiProperty() id: string;
  @ApiProperty() stripe_payment_method_id: string;
  @ApiPropertyOptional() brand?: string | null;
  @ApiPropertyOptional() last4?: string | null;
  @ApiPropertyOptional() exp_month?: number | null;
  @ApiPropertyOptional() exp_year?: number | null;
  @ApiPropertyOptional() cardholder_name?: string | null;
  @ApiProperty() is_default: boolean;
  @ApiProperty() created_at: string;
}

export class SetupIntentResponse {
  @ApiProperty() client_secret: string;
  @ApiProperty() customer_id: string;
}
