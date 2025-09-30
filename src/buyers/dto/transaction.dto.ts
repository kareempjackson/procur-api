import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
  Max,
  Length,
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

export class BuyerTransactionQueryDto {
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
  @Max(100)
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

  @ApiPropertyOptional({ description: 'Filter by seller ID' })
  @IsOptional()
  @IsUUID()
  seller_id?: string;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsUUID()
  order_id?: string;

  @ApiPropertyOptional({ description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Minimum amount filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_amount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_amount?: number;

  @ApiPropertyOptional({
    description: 'Search term (transaction number, description)',
  })
  @IsOptional()
  @IsString()
  search?: string;

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

export class BuyerTransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction number' })
  transaction_number: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  order_id?: string;

  @ApiPropertyOptional({ description: 'Order number' })
  order_number?: string;

  @ApiProperty({ description: 'Seller organization ID' })
  seller_org_id: string;

  @ApiProperty({ description: 'Seller name' })
  seller_name: string;

  @ApiProperty({ description: 'Transaction type' })
  type: string;

  @ApiProperty({ description: 'Transaction status' })
  status: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiPropertyOptional({ description: 'Payment method used' })
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Payment reference' })
  payment_reference?: string;

  @ApiProperty({ description: 'Platform fee charged' })
  platform_fee: number;

  @ApiProperty({ description: 'Payment processing fee' })
  payment_processing_fee: number;

  @ApiProperty({ description: 'Net amount (amount - fees)' })
  net_amount: number;

  @ApiPropertyOptional({ description: 'Transaction description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;

  @ApiPropertyOptional({ description: 'When transaction was processed' })
  processed_at?: string;

  @ApiPropertyOptional({ description: 'When transaction was settled' })
  settled_at?: string;

  @ApiProperty({ description: 'Transaction created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Transaction updated timestamp' })
  updated_at: string;

  @ApiPropertyOptional({ description: 'Can this transaction be disputed?' })
  can_dispute?: boolean;

  @ApiPropertyOptional({ description: 'Related order items' })
  order_items?: any[];
}

export class BuyerTransactionSummaryDto {
  @ApiProperty({ description: 'Total number of transactions' })
  total_transactions: number;

  @ApiProperty({ description: 'Total amount spent' })
  total_spent: number;

  @ApiProperty({ description: 'Total refunds received' })
  total_refunds: number;

  @ApiProperty({ description: 'Total fees paid' })
  total_fees: number;

  @ApiProperty({ description: 'Net amount spent (spent - refunds)' })
  net_spent: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Transactions by status' })
  transactions_by_status: Record<string, number>;

  @ApiProperty({ description: 'Transactions by type' })
  transactions_by_type: Record<string, number>;

  @ApiProperty({ description: 'Monthly spending data' })
  monthly_spending: {
    month: string;
    amount: number;
    transaction_count: number;
  }[];

  @ApiProperty({ description: 'Top sellers by transaction volume' })
  top_sellers: {
    seller_id: string;
    seller_name: string;
    total_amount: number;
    transaction_count: number;
  }[];

  @ApiProperty({ description: 'Average transaction amount' })
  average_transaction_amount: number;

  @ApiProperty({ description: 'Largest transaction amount' })
  largest_transaction: number;

  @ApiProperty({ description: 'Most recent transaction date' })
  last_transaction_date?: string;
}

export class CreateDisputeDto {
  @ApiProperty({ description: 'Reason for the dispute' })
  @IsString()
  @Length(1, 500)
  reason: string;

  @ApiPropertyOptional({ description: 'Detailed description of the issue' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Requested resolution (refund, replacement, etc.)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  requested_resolution?: string;

  @ApiPropertyOptional({
    description: 'Supporting evidence/documentation URLs',
  })
  @IsOptional()
  @IsString({ each: true })
  evidence_urls?: string[];
}

export class DisputeResponseDto {
  @ApiProperty({ description: 'Dispute ID' })
  id: string;

  @ApiProperty({ description: 'Transaction ID' })
  transaction_id: string;

  @ApiProperty({ description: 'Order ID' })
  order_id?: string;

  @ApiProperty({ description: 'Dispute reason' })
  reason: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Requested resolution' })
  requested_resolution?: string;

  @ApiProperty({ description: 'Dispute status' })
  status: string;

  @ApiProperty({ description: 'Disputed amount' })
  amount: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiPropertyOptional({ description: 'Evidence URLs' })
  evidence_urls?: string[];

  @ApiPropertyOptional({ description: 'Resolution details' })
  resolution?: string;

  @ApiPropertyOptional({ description: 'When dispute was resolved' })
  resolved_at?: string;

  @ApiProperty({ description: 'Dispute created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Dispute updated timestamp' })
  updated_at: string;
}
