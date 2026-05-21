import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DisputeResponse {
  @ApiProperty() id: string;
  @ApiProperty() order_id: string;
  @ApiPropertyOptional() parent_order_id?: string | null;
  @ApiProperty() stripe_dispute_id: string;
  @ApiPropertyOptional() stripe_charge_id?: string | null;
  @ApiPropertyOptional() stripe_payment_intent_id?: string | null;
  @ApiProperty() amount_cents: number;
  @ApiProperty() currency: string;
  @ApiPropertyOptional() reason?: string | null;
  @ApiProperty() status: string;
  @ApiPropertyOptional() network_reason_code?: string | null;
  @ApiPropertyOptional() evidence_due_by?: string | null;
  @ApiPropertyOptional() is_charge_refundable?: boolean | null;
  @ApiProperty() is_final: boolean;
  @ApiPropertyOptional() outcome?: 'won' | 'lost' | 'warning_closed' | 'charge_refunded' | null;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
  @ApiPropertyOptional() resolved_at?: string | null;
}
