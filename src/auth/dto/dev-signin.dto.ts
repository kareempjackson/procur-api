import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class DevSigninDto {
  @ApiProperty({
    example: 'seller',
    description: 'Account type to sign in as (dev only)',
    enum: ['seller', 'buyer', 'government'],
  })
  @IsString()
  @IsIn(['seller', 'buyer', 'government'])
  accountType: 'seller' | 'buyer' | 'government';
}
