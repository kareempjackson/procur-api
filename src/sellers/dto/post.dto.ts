import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
  IsDateString,
  Length,
  IsUrl,
  IsObject,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum PostType {
  PRODUCT_PROMOTION = 'product_promotion',
  SALE_ANNOUNCEMENT = 'sale_announcement',
  GENERAL = 'general',
  SEASONAL = 'seasonal',
}

export class TargetAudienceDto {
  @ApiPropertyOptional({ description: 'Minimum age' })
  @IsOptional()
  @IsNumber()
  @Min(13)
  min_age?: number;

  @ApiPropertyOptional({ description: 'Maximum age' })
  @IsOptional()
  @IsNumber()
  @Min(13)
  max_age?: number;

  @ApiPropertyOptional({ description: 'Target locations', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiPropertyOptional({ description: 'Target interests', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ description: 'Target gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Additional targeting criteria' })
  @IsOptional()
  @IsObject()
  additional_criteria?: any;
}

export class CreateScheduledPostDto {
  @ApiProperty({ description: 'Post title' })
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiProperty({ description: 'Post content' })
  @IsString()
  @Length(1, 5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Post type',
    enum: PostType,
    default: PostType.GENERAL,
  })
  @IsOptional()
  @IsEnum(PostType)
  post_type?: PostType;

  @ApiPropertyOptional({
    description: 'Related product ID (for product promotions)',
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Post images (URLs)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Video URL' })
  @IsOptional()
  @IsUrl()
  video_url?: string;

  @ApiProperty({ description: 'Scheduled publication date and time' })
  @IsDateString()
  scheduled_for: string;

  @ApiPropertyOptional({
    description: 'Target audience',
    type: TargetAudienceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TargetAudienceDto)
  target_audience?: TargetAudienceDto;

  @ApiPropertyOptional({
    description: 'Social media platforms to publish to',
    type: [String],
    example: ['facebook', 'instagram', 'twitter', 'linkedin'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];
}

export class UpdateScheduledPostDto {
  @ApiPropertyOptional({ description: 'Post title' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @ApiPropertyOptional({ description: 'Post content' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  content?: string;

  @ApiPropertyOptional({ description: 'Post type', enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  post_type?: PostType;

  @ApiPropertyOptional({ description: 'Related product ID' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Post images (URLs)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Video URL' })
  @IsOptional()
  @IsUrl()
  video_url?: string;

  @ApiPropertyOptional({ description: 'Scheduled publication date and time' })
  @IsOptional()
  @IsDateString()
  scheduled_for?: string;

  @ApiPropertyOptional({
    description: 'Target audience',
    type: TargetAudienceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TargetAudienceDto)
  target_audience?: TargetAudienceDto;

  @ApiPropertyOptional({
    description: 'Social media platforms to publish to',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @ApiPropertyOptional({ description: 'Post status', enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

export class PostQueryDto {
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
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by post status',
    enum: PostStatus,
  })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({ description: 'Filter by post type', enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  post_type?: PostType;

  @ApiPropertyOptional({ description: 'Filter by product ID' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({
    description: 'Filter posts scheduled from date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter posts scheduled to date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  to_date?: string;

  @ApiPropertyOptional({ description: 'Search in title and content' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['scheduled_for', 'created_at', 'title'],
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';
}

export class PublishPostDto {
  @ApiPropertyOptional({
    description: 'Override scheduled time and publish immediately',
  })
  @IsOptional()
  @IsDateString()
  publish_at?: string;

  @ApiPropertyOptional({ description: 'Additional notes for publishing' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}

export class ScheduledPostResponseDto {
  @ApiProperty({ description: 'Post ID' })
  id: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiPropertyOptional({ description: 'Related product ID' })
  product_id?: string;

  @ApiProperty({ description: 'Post title' })
  title: string;

  @ApiProperty({ description: 'Post content' })
  content: string;

  @ApiProperty({ description: 'Post type', enum: PostType })
  post_type: PostType;

  @ApiPropertyOptional({ description: 'Post images', type: [String] })
  images?: string[];

  @ApiPropertyOptional({ description: 'Video URL' })
  video_url?: string;

  @ApiProperty({ description: 'Scheduled for' })
  scheduled_for: string;

  @ApiPropertyOptional({ description: 'Published at' })
  published_at?: string;

  @ApiPropertyOptional({ description: 'Target audience' })
  target_audience?: any;

  @ApiPropertyOptional({ description: 'Platforms', type: [String] })
  platforms?: string[];

  @ApiProperty({ description: 'Post status', enum: PostStatus })
  status: PostStatus;

  @ApiPropertyOptional({ description: 'Failure reason (if failed)' })
  failure_reason?: string;

  @ApiProperty({ description: 'Views count' })
  views_count: number;

  @ApiProperty({ description: 'Likes count' })
  likes_count: number;

  @ApiProperty({ description: 'Shares count' })
  shares_count: number;

  @ApiProperty({ description: 'Comments count' })
  comments_count: number;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  created_by?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updated_by?: string;

  @ApiProperty({ description: 'Created at' })
  created_at: string;

  @ApiProperty({ description: 'Updated at' })
  updated_at: string;
}

export class PostEngagementDto {
  @ApiProperty({ description: 'Total views across all platforms' })
  total_views: number;

  @ApiProperty({ description: 'Total likes across all platforms' })
  total_likes: number;

  @ApiProperty({ description: 'Total shares across all platforms' })
  total_shares: number;

  @ApiProperty({ description: 'Total comments across all platforms' })
  total_comments: number;

  @ApiProperty({ description: 'Engagement rate (percentage)' })
  engagement_rate: number;

  @ApiProperty({ description: 'Platform-specific metrics' })
  platform_metrics: {
    [platform: string]: {
      views: number;
      likes: number;
      shares: number;
      comments: number;
    };
  };

  @ApiProperty({ description: 'Last updated' })
  last_updated: string;
}
