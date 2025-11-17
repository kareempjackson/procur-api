import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: '+15551234567',
    description: 'User phone in E.164 format',
  })
  @IsString()
  phoneNumber!: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}
