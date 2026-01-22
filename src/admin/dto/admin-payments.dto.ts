import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AdminPaymentsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class MarkBuyerSettlementCompletedDto {
  @IsOptional()
  @IsString()
  bank_reference?: string;

  @IsOptional()
  @IsString()
  proof_url?: string;
}

export class MarkFarmerPayoutCompletedDto {
  @IsOptional()
  @IsString()
  proof_url?: string;
}

export class UpdateFarmerPayoutStatusDto {
  @IsString()
  status!: 'pending' | 'scheduled' | 'completed';

  @IsOptional()
  @IsString()
  proof_url?: string;
}

export class AdminPaymentIdParamDto {
  @IsUUID()
  id!: string;
}
