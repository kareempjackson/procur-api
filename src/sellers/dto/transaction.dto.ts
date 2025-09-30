import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  Min,
  IsDateString,
  Length,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransactionType {
  SALE = 'sale',
  REFUND = 'refund',
  FEE = 'fee',
  PAYOUT = 'payout',
  DISPUTE_HOLD = 'dispute_hold',
  DISPUTE_RELEASE = 'dispute_release',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export class TransactionQueryDto {
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
    description: 'Filter by transaction type',
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    enum: TransactionStatus,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsUUID()
  order_id?: string;

  @ApiPropertyOptional({ description: 'Filter by buyer organization ID' })
  @IsOptional()
  @IsUUID()
  buyer_org_id?: string;

  @ApiPropertyOptional({ description: 'Search by transaction number' })
  @IsOptional()
  @IsString()
  transaction_number?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions from date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions to date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  to_date?: string;

  @ApiPropertyOptional({ description: 'Minimum amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_amount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  max_amount?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['created_at', 'amount', 'status'],
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

export class CreateDisputeDto {
  @ApiProperty({ description: 'Reason for dispute' })
  @IsString()
  @Length(10, 1000)
  reason: string;

  @ApiPropertyOptional({ description: 'Additional details about the dispute' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  details?: string;

  @ApiPropertyOptional({
    description: 'Evidence or supporting documents (URLs)',
  })
  @IsOptional()
  @IsString({ each: true })
  evidence?: string[];
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction number' })
  transaction_number: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  order_id?: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiPropertyOptional({ description: 'Buyer organization ID' })
  buyer_org_id?: string;

  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ description: 'Transaction status', enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Payment reference' })
  payment_reference?: string;

  @ApiPropertyOptional({ description: 'Gateway transaction ID' })
  gateway_transaction_id?: string;

  @ApiProperty({ description: 'Platform fee' })
  platform_fee: number;

  @ApiProperty({ description: 'Payment processing fee' })
  payment_processing_fee: number;

  @ApiPropertyOptional({ description: 'Net amount after fees' })
  net_amount?: number;

  @ApiPropertyOptional({ description: 'Transaction description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;

  @ApiPropertyOptional({ description: 'Processed at' })
  processed_at?: string;

  @ApiPropertyOptional({ description: 'Settled at' })
  settled_at?: string;

  @ApiProperty({ description: 'Created at' })
  created_at: string;

  @ApiProperty({ description: 'Updated at' })
  updated_at: string;
}

export class TransactionSummaryDto {
  @ApiProperty({ description: 'Total sales amount' })
  total_sales: number;

  @ApiProperty({ description: 'Total refunds amount' })
  total_refunds: number;

  @ApiProperty({ description: 'Total fees paid' })
  total_fees: number;

  @ApiProperty({ description: 'Net earnings' })
  net_earnings: number;

  @ApiProperty({ description: 'Pending transactions count' })
  pending_count: number;

  @ApiProperty({ description: 'Completed transactions count' })
  completed_count: number;

  @ApiProperty({ description: 'Failed transactions count' })
  failed_count: number;

  @ApiProperty({ description: 'Disputed transactions count' })
  disputed_count: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Summary period start date' })
  period_start: string;

  @ApiProperty({ description: 'Summary period end date' })
  period_end: string;
}
