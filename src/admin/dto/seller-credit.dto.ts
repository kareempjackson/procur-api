import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsIn,
  Min,
} from 'class-validator';

export class AdjustSellerCreditDto {
  @ApiProperty({ description: 'Seller organization ID' })
  @IsUUID()
  seller_org_id: string;

  @ApiProperty({ description: 'Amount in cents (positive for credit, negative for debit)' })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Type of adjustment',
    enum: ['credit', 'debit'],
  })
  @IsIn(['credit', 'debit'])
  type: 'credit' | 'debit';

  @ApiProperty({
    description: 'Reason for the adjustment',
    enum: ['change_owed', 'overpayment', 'adjustment', 'payout_deduction', 'refund', 'other'],
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional note about the adjustment' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'External reference (e.g., receipt number)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Optional related order ID' })
  @IsOptional()
  @IsUUID()
  order_id?: string;
}

export class SellerCreditTransactionDto {
  id: string;
  seller_org_id: string;
  amount_cents: number;
  amount: number;
  balance_after_cents: number;
  balance_after: number;
  type: string;
  reason: string;
  note: string | null;
  reference: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  seller_name?: string;
}

export class SellerCreditBalanceDto {
  seller_org_id: string;
  seller_name: string;
  credit_amount_cents: number;
  credit_amount: number;
  currency: string;
}

