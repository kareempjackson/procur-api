import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateFarmersIdVerificationDto {
  @ApiProperty({
    description: 'Whether the farmer ID has been verified',
    example: true,
  })
  @IsBoolean()
  verified: boolean;
}

export class UpdateFarmVerificationDto {
  @ApiProperty({
    description: 'Whether the farm itself has been verified',
    example: true,
  })
  @IsBoolean()
  verified: boolean;
}
