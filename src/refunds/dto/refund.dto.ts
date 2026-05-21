import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum RefundReasonCode {
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  ORDER_CANCELLED = 'order_cancelled',
  QUALITY_ISSUE = 'quality_issue',
  OTHER = 'other',
}

export enum RefundMethod {
  CARD = 'card',
  BUYER_CREDIT = 'buyer_credit',
}

export enum RefundStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export class IssueRefundDto {
  @ApiProperty({
    description: 'Amount to refund in cents (cannot exceed remaining refundable amount)',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount_cents: number;

  @ApiProperty({
    description: 'Free-text reason captured for audit',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ enum: RefundReasonCode })
  @IsEnum(RefundReasonCode)
  reason_code: RefundReasonCode;

  @ApiProperty({ enum: RefundMethod })
  @IsEnum(RefundMethod)
  refund_method: RefundMethod;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notify_buyer?: boolean;
}

export class ResendRefundEmailDto {
  @ApiPropertyOptional({
    description: 'Override recipient email; defaults to the buyer org primary email',
  })
  @IsOptional()
  @IsString()
  email?: string;
}

export class RefundResponse {
  @ApiProperty() id: string;
  @ApiProperty() order_id: string;
  @ApiPropertyOptional() parent_order_id?: string | null;
  @ApiProperty() refund_number: string;
  @ApiProperty() credit_note_number: string;
  @ApiProperty() amount_cents: number;
  @ApiProperty() currency: string;
  @ApiProperty() reason: string;
  @ApiProperty({ enum: RefundReasonCode }) reason_code: RefundReasonCode;
  @ApiProperty({ enum: RefundMethod }) refund_method: RefundMethod;
  @ApiProperty({ enum: RefundStatus }) status: RefundStatus;
  @ApiPropertyOptional() stripe_refund_id?: string | null;
  @ApiPropertyOptional() stripe_payment_intent_id?: string | null;
  @ApiProperty() initiated_by_role: 'admin' | 'buyer' | 'system';
  @ApiProperty() notify_buyer: boolean;
  @ApiPropertyOptional() buyer_notified_at?: string | null;
  @ApiPropertyOptional() failure_reason?: string | null;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional() succeeded_at?: string | null;
  @ApiPropertyOptional() failed_at?: string | null;
}
