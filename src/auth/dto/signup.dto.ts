import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { AccountType } from '../../common/enums/account-type.enum';
import { BuyerBusinessType } from '../../common/enums/buyer-business-type.enum';
import { SellerBusinessType } from '../../common/enums/seller-business-type.enum';
import { IsValidBusinessTypeForAccount } from '../../common/validators/business-type.validator';

export class SignupDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'User password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
  })
  @IsString()
  fullname: string;

  @ApiProperty({
    example: 'Acme Imports Ltd.',
    description: 'Business legal name (required for buyer/seller accounts)',
    required: false,
  })
  @ValidateIf(
    (o) =>
      o.accountType === AccountType.BUYER ||
      o.accountType === AccountType.SELLER,
  )
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @ApiProperty({
    enum: AccountType,
    example: AccountType.BUYER,
    description: 'Type of account being created',
  })
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiProperty({
    example: 'United States',
    description: 'Country (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'Business type (required for buyer/seller accounts)',
    enum: { BuyerBusinessType, SellerBusinessType },
    required: false,
  })
  @ValidateIf(
    (o) =>
      o.accountType === AccountType.BUYER ||
      o.accountType === AccountType.SELLER,
  )
  @IsString()
  @IsNotEmpty()
  @IsValidBusinessTypeForAccount('accountType', {
    message: 'Business type must be valid for the selected account type',
  })
  businessType?: string;
}
