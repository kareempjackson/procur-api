import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { AccountType } from '../../common/enums/account-type.enum';

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
}
