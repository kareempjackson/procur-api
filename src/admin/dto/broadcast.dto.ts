import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class BroadcastDto {
  @ApiProperty({
    description: 'Recipient segment',
    enum: ['all_sellers', 'all_buyers', 'all_users'],
  })
  @IsString()
  @IsIn(['all_sellers', 'all_buyers', 'all_users'])
  segment: 'all_sellers' | 'all_buyers' | 'all_users';

  @ApiProperty({
    description: 'Template to send',
    enum: ['kyc_reminder', 'onboarding_start_bot'],
    example: 'kyc_reminder',
  })
  @IsString()
  template: string;

  @ApiPropertyOptional({
    description: 'Template variable overrides (e.g. { deadline: "March 10" })',
  })
  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'If true, returns recipient count without sending',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;
}
