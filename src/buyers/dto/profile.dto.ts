import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsObject,
  ValidateNested,
  Length,
  IsPhoneNumber,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiPropertyOptional({
    description: 'Address label (e.g., Home, Office)',
    example: 'Office',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;

  @ApiProperty({
    description: 'Street address',
    example: '123 Main Street, Apt 4B',
  })
  @IsString()
  street_address: string;

  @ApiProperty({ description: 'City', example: 'New York' })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiPropertyOptional({ description: 'State/Province', example: 'NY' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal/ZIP code', example: '10001' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postal_code?: string;

  @ApiProperty({ description: 'Country', example: 'United States' })
  @IsString()
  @Length(1, 100)
  country: string;

  @ApiPropertyOptional({ description: 'Contact name for this address' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  contact_name?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  contact_phone?: string;

  @ApiPropertyOptional({
    description: 'Set as default address',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ description: 'Use for billing', default: false })
  @IsOptional()
  @IsBoolean()
  is_billing?: boolean;

  @ApiPropertyOptional({ description: 'Use for shipping', default: true })
  @IsOptional()
  @IsBoolean()
  is_shipping?: boolean;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'Address label' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  street_address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({ description: 'State/Province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal/ZIP code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postal_code?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  @ApiPropertyOptional({ description: 'Contact name for this address' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  contact_name?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  contact_phone?: string;

  @ApiPropertyOptional({ description: 'Set as default address' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ description: 'Use for billing' })
  @IsOptional()
  @IsBoolean()
  is_billing?: boolean;

  @ApiPropertyOptional({ description: 'Use for shipping' })
  @IsOptional()
  @IsBoolean()
  is_shipping?: boolean;
}

export class AddressResponseDto {
  @ApiProperty({ description: 'Address ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Address label' })
  label?: string;

  @ApiProperty({ description: 'Street address' })
  street_address: string;

  @ApiProperty({ description: 'City' })
  city: string;

  @ApiPropertyOptional({ description: 'State/Province' })
  state?: string;

  @ApiPropertyOptional({ description: 'Postal/ZIP code' })
  postal_code?: string;

  @ApiProperty({ description: 'Country' })
  country: string;

  @ApiPropertyOptional({ description: 'Contact name' })
  contact_name?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  contact_phone?: string;

  @ApiProperty({ description: 'Is default address' })
  is_default: boolean;

  @ApiProperty({ description: 'Is billing address' })
  is_billing: boolean;

  @ApiProperty({ description: 'Is shipping address' })
  is_shipping: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updated_at: string;
}

export class DeliveryWindowDto {
  @ApiProperty({ description: 'Start time (HH:MM)', example: '09:00' })
  @IsString()
  start_time: string;

  @ApiProperty({ description: 'End time (HH:MM)', example: '17:00' })
  @IsString()
  end_time: string;

  @ApiProperty({
    description: 'Days of week',
    example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  })
  @IsString({ each: true })
  days: string[];
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Enable email notifications',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable SMS notifications',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sms_notifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable order update notifications',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  order_updates?: boolean;

  @ApiPropertyOptional({
    description: 'Enable price alert notifications',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  price_alerts?: boolean;

  @ApiPropertyOptional({
    description: 'Enable new product alert notifications',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  new_product_alerts?: boolean;

  @ApiPropertyOptional({ description: 'Preferred currency', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  preferred_currency?: string;

  @ApiPropertyOptional({
    description: 'Enable auto-reorder for frequent purchases',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  auto_reorder?: boolean;

  @ApiPropertyOptional({ description: 'Preferred delivery time window' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryWindowDto)
  preferred_delivery_window?: DeliveryWindowDto;

  @ApiPropertyOptional({
    description: 'Make reviews public by default',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  public_reviews?: boolean;

  @ApiPropertyOptional({
    description: 'Share purchase history with sellers for recommendations',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  share_purchase_history?: boolean;

  @ApiPropertyOptional({ description: 'Additional custom preferences' })
  @IsOptional()
  @IsObject()
  preferences_data?: any;
}

export class PreferencesResponseDto {
  @ApiProperty({ description: 'Email notifications enabled' })
  email_notifications: boolean;

  @ApiProperty({ description: 'SMS notifications enabled' })
  sms_notifications: boolean;

  @ApiProperty({ description: 'Order update notifications enabled' })
  order_updates: boolean;

  @ApiProperty({ description: 'Price alert notifications enabled' })
  price_alerts: boolean;

  @ApiProperty({ description: 'New product alert notifications enabled' })
  new_product_alerts: boolean;

  @ApiProperty({ description: 'Preferred currency' })
  preferred_currency: string;

  @ApiProperty({ description: 'Auto-reorder enabled' })
  auto_reorder: boolean;

  @ApiPropertyOptional({ description: 'Preferred delivery window' })
  preferred_delivery_window?: DeliveryWindowDto;

  @ApiProperty({ description: 'Public reviews by default' })
  public_reviews: boolean;

  @ApiProperty({ description: 'Share purchase history' })
  share_purchase_history: boolean;

  @ApiPropertyOptional({ description: 'Custom preferences' })
  preferences_data?: any;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updated_at: string;
}

export class BuyerProfileResponseDto {
  @ApiProperty({ description: 'Organization ID' })
  id: string;

  @ApiProperty({ description: 'Organization name' })
  name: string;

  @ApiPropertyOptional({ description: 'Organization description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Organization logo URL' })
  logo_url?: string;

  @ApiPropertyOptional({ description: 'Organization website' })
  website?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  contact_email?: string;

  @ApiPropertyOptional({ description: 'Primary contact phone' })
  contact_phone?: string;

  @ApiProperty({ description: 'Account type' })
  account_type: string;

  @ApiPropertyOptional({ description: 'Business type' })
  business_type?: string;

  @ApiProperty({ description: 'Organization status' })
  status: string;

  @ApiProperty({ description: 'Total orders placed' })
  total_orders: number;

  @ApiProperty({ description: 'Total amount spent' })
  total_spent: number;

  @ApiProperty({ description: 'Preferred currency' })
  preferred_currency: string;

  @ApiProperty({ description: 'Member since' })
  created_at: string;

  @ApiProperty({ description: 'Last updated' })
  updated_at: string;

  @ApiProperty({ description: 'Saved addresses' })
  addresses: AddressResponseDto[];

  @ApiProperty({ description: 'Buyer preferences' })
  preferences: PreferencesResponseDto;
}

export class FavoriteProductDto {
  @ApiProperty({ description: 'Product ID' })
  product_id: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiProperty({ description: 'Current price' })
  current_price: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiPropertyOptional({ description: 'Product image URL' })
  image_url?: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'In stock' })
  in_stock: boolean;

  @ApiProperty({ description: 'Added to favorites timestamp' })
  created_at: string;
}

export class FavoriteSellerDto {
  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiPropertyOptional({ description: 'Seller logo URL' })
  logo_url?: string;

  @ApiPropertyOptional({ description: 'Seller description' })
  description?: string;

  @ApiProperty({ description: 'Average rating' })
  average_rating?: number;

  @ApiProperty({ description: 'Number of products' })
  product_count: number;

  @ApiProperty({ description: 'Added to favorites timestamp' })
  created_at: string;
}
