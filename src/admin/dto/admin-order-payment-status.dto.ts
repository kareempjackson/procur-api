import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAdminOrderPaymentStatusDto {
  @ApiProperty({
    description: 'New payment status for the order',
    enum: ['pending', 'scheduled', 'paid', 'failed', 'refunded', 'partially_refunded'],
  })
  @IsString()
  @IsIn(['pending', 'scheduled', 'paid', 'failed', 'refunded', 'partially_refunded'])
  payment_status!: string;

  @ApiProperty({
    description: 'Optional note about this payment update',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Optional external payment reference (e.g. bank transfer ID)',
    required: false,
  })
  @IsOptional()
  @IsString()
  reference?: string;
}
