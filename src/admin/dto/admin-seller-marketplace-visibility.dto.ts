import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateSellerMarketplaceVisibilityDto {
  @ApiProperty({
    description:
      'If true, seller is hidden from public marketplace and buyer marketplace browsing',
    example: true,
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hidden: boolean;
}


