import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSellerHarvestDto {
  @ApiProperty({ description: 'Primary crop being harvested' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  crop!: string;

  @ApiPropertyOptional({
    description: 'Expected harvest window (e.g., Oct 15 – Oct 30)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  expected_harvest_window?: string;

  @ApiPropertyOptional({ description: 'Estimated quantity' })
  @IsNumber({}, { message: 'quantity must be a number' })
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit of measure for quantity' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ description: 'Additional notes about the harvest' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Next crop being planted' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  next_planting_crop?: string;

  @ApiPropertyOptional({ description: 'Date of next planting' })
  @IsDateString()
  @IsOptional()
  next_planting_date?: string;

  @ApiPropertyOptional({ description: 'Area/bed details for next planting' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  next_planting_area?: string;
}

export class HarvestRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  seller_org_id!: string;

  @ApiProperty()
  crop!: string;

  @ApiProperty({ required: false })
  expected_harvest_window?: string | null;

  @ApiProperty({ required: false })
  quantity?: number | null;

  @ApiProperty({ required: false })
  unit?: string | null;

  @ApiProperty({ required: false })
  notes?: string | null;

  @ApiProperty({ required: false })
  next_planting_crop?: string | null;

  @ApiProperty({ required: false })
  next_planting_date?: string | null;

  @ApiProperty({ required: false })
  next_planting_area?: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty({ required: false })
  created_by?: string | null;
}

export class SellerHarvestCommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  harvest_id!: string;

  @ApiProperty()
  buyer_org_id!: string;

  @ApiProperty()
  buyer_user_id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  created_at!: string;
}

export class CreateSellerHarvestCommentDto {
  @ApiProperty({ description: 'Comment text' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class CreateHarvestBuyerRequestDto {
  @ApiProperty({ description: 'Requested quantity' })
  @IsNumber()
  quantity!: number;

  @ApiProperty({ description: 'Unit of measurement' })
  @IsString()
  unit!: string;

  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requested_date?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class HarvestBuyerRequestDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  harvest_id!: string;

  @ApiProperty()
  seller_org_id!: string;

  @ApiProperty()
  buyer_org_id!: string;

  @ApiProperty()
  buyer_user_id!: string;

  @ApiProperty()
  requested_quantity!: number;

  @ApiProperty()
  unit!: string;

  @ApiPropertyOptional()
  requested_date?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  status!: 'pending' | 'acknowledged_yes' | 'acknowledged_no';

  @ApiPropertyOptional()
  acknowledged_at?: string | null;

  @ApiPropertyOptional()
  acknowledged_by?: string | null;

  @ApiPropertyOptional()
  seller_message?: string | null;

  @ApiProperty()
  created_at!: string;
}

export class AcknowledgeHarvestBuyerRequestDto {
  @ApiProperty({ description: 'Whether seller can fulfill the request' })
  @IsNotEmpty()
  can_fulfill!: boolean;

  @ApiPropertyOptional({ description: 'Optional message to buyer' })
  @IsOptional()
  @IsString()
  seller_message?: string;
}

export class HarvestFeedItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  seller_org_id!: string;

  @ApiProperty()
  crop!: string;

  @ApiPropertyOptional()
  expected_harvest_window?: string | null;

  @ApiPropertyOptional()
  quantity?: number | null;

  @ApiPropertyOptional()
  unit?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty({ description: 'Number of comments' })
  comments_count!: number;

  @ApiProperty({ description: 'Number of buyer requests' })
  requests_count!: number;

  @ApiProperty({ type: [SellerHarvestCommentDto] })
  comments!: SellerHarvestCommentDto[];

  @ApiProperty({ type: [HarvestBuyerRequestDto] })
  requests!: HarvestBuyerRequestDto[];
}
