import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SellerStatusUpdateRequestDto {
  @ApiProperty({
    description: 'Status the seller is requesting (e.g. shipped, delivered)',
    example: 'shipped',
  })
  @IsString()
  @IsNotEmpty()
  requested_status!: string;

  @ApiProperty({
    description: 'Optional notes for the admin reviewing this request',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
