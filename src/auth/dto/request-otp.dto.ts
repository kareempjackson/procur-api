import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '+15551234567',
    description: 'User phone in E.164 format',
  })
  @IsString()
  phoneNumber!: string;

  @ApiProperty({ enum: ['whatsapp', 'email'], required: false })
  @IsOptional()
  @IsIn(['whatsapp', 'email'])
  channel?: 'whatsapp' | 'email';
}
