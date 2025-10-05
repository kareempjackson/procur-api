import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SortOrder } from './marketplace.dto';

export enum HarvestSortBy {
  CREATED_AT = 'created_at',
  LIKES = 'likes_count',
  COMMENTS = 'comments_count',
}

// Query DTO
export class HarvestUpdatesQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by crop/product name' })
  @IsOptional()
  @IsString()
  crop?: string;

  @ApiPropertyOptional({ description: 'Filter by seller/farm ID' })
  @IsOptional()
  @IsUUID()
  seller_org_id?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: HarvestSortBy,
    default: HarvestSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(HarvestSortBy)
  sort_by?: HarvestSortBy = HarvestSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}

// Response DTOs
export class HarvestUpdateDto {
  @ApiProperty({ description: 'Harvest update ID' })
  id: string;

  @ApiProperty({ description: 'Seller/Farm organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller/Farm name' })
  farm_name: string;

  @ApiPropertyOptional({ description: 'Farm avatar/logo URL' })
  farm_avatar?: string;

  @ApiPropertyOptional({ description: 'Farm location' })
  location?: string;

  @ApiProperty({ description: 'Crop/Product name' })
  crop: string;

  @ApiPropertyOptional({ description: 'Post content/description' })
  content?: string;

  @ApiPropertyOptional({ description: 'Harvest window/date information' })
  expected_harvest_window?: string;

  @ApiPropertyOptional({ description: 'Available quantity' })
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  unit?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  notes?: string;

  @ApiProperty({ description: 'Array of image URLs', type: [String] })
  images: string[];

  @ApiProperty({ description: 'Number of likes' })
  likes_count: number;

  @ApiProperty({ description: 'Number of comments' })
  comments_count: number;

  @ApiProperty({ description: 'Number of buyer requests' })
  requests_count: number;

  @ApiProperty({ description: 'Is seller verified' })
  is_verified: boolean;

  @ApiProperty({ description: 'Has current user liked this' })
  is_liked: boolean;

  @ApiProperty({ description: 'Time posted (ISO string)' })
  created_at: string;

  @ApiPropertyOptional({ description: 'Time ago string (e.g., "2 hours ago")' })
  time_ago?: string;

  @ApiPropertyOptional({ description: 'Next planting crop' })
  next_planting_crop?: string;

  @ApiPropertyOptional({ description: 'Next planting date' })
  next_planting_date?: string;

  @ApiPropertyOptional({ description: 'Next planting area' })
  next_planting_area?: string;
}

export class HarvestUpdateDetailDto extends HarvestUpdateDto {
  @ApiProperty({ description: 'Recent comments', type: [Object] })
  recent_comments: HarvestCommentDto[];

  @ApiPropertyOptional({ description: 'Seller contact info' })
  seller_contact?: {
    email?: string;
    phone?: string;
  };
}

export class HarvestCommentDto {
  @ApiProperty({ description: 'Comment ID' })
  id: string;

  @ApiProperty({ description: 'Commenter organization ID' })
  buyer_org_id: string;

  @ApiProperty({ description: 'Commenter user ID' })
  buyer_user_id: string;

  @ApiProperty({ description: 'Commenter name' })
  commenter_name: string;

  @ApiPropertyOptional({ description: 'Commenter avatar URL' })
  commenter_avatar?: string;

  @ApiProperty({ description: 'Comment content' })
  content: string;

  @ApiProperty({ description: 'Created at timestamp' })
  created_at: string;

  @ApiPropertyOptional({ description: 'Time ago string' })
  time_ago?: string;
}

// Create/Update DTOs
export class CreateHarvestCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsString()
  content: string;
}

export class ToggleHarvestLikeDto {
  @ApiProperty({ description: 'Whether to like (true) or unlike (false)' })
  @IsBoolean()
  is_like: boolean;
}

export class CreateHarvestRequestDto {
  @ApiProperty({ description: 'Requested quantity' })
  @IsNumber()
  @Min(0)
  requested_quantity: number;

  @ApiProperty({ description: 'Unit of measurement' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ description: 'Requested date' })
  @IsOptional()
  @IsDateString()
  requested_date?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
