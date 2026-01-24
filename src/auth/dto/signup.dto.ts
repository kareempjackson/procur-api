import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  ValidateIf,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
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
  @Transform(({ value }) => value?.toLowerCase().trim())
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
  @MinLength(5, { message: 'Full name must be at least 5 characters long' })
  @Matches(/^[A-Za-zÀ-ÖØ-öø-ÿ.'-]+\s+[A-Za-zÀ-ÖØ-öø-ÿ.'-]+.*$/, {
    message: 'Please enter your real first and last name',
  })
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

  @ApiProperty({
    description: 'Business website honeypot. Real users must leave this empty.',
    required: false,
  })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({
    description: 'CAPTCHA verification token from the client',
  })
  @IsString()
  captchaToken: string;
}
