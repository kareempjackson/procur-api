import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSellerMarketplaceHiddenDto {
  @ApiProperty({
    description:
      'When true, hide this seller (and their products) from public marketplace and buyer-facing marketplace UIs.',
    example: false,
  })
  @IsBoolean()
  hidden: boolean;
}


