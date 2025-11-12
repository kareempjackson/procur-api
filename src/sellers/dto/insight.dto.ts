import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SellerInsightDto {
  @ApiProperty({ description: 'Insight identifier' })
  id!: string;

  @ApiProperty({ description: 'Primary title/summary' })
  title!: string;

  @ApiPropertyOptional({ description: 'Supporting subtitle/description' })
  sub?: string;

  @ApiPropertyOptional({ description: 'CTA label for actionable insights' })
  cta?: string;

  @ApiPropertyOptional({ description: 'Whether the insight is urgent' })
  urgent?: boolean;

  @ApiPropertyOptional({ description: 'Action ID to execute on CTA click' })
  actionId?: string;
}

export class ExecuteSellerInsightResponseDto {
  @ApiProperty({ description: 'Whether the action executed successfully' })
  success!: boolean;
}

