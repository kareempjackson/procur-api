import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminOrderItemAdjustmentDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  unit_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;
}

export class AdminOrderInspectionApprovalDto {
  @IsIn(['approved', 'rejected'])
  inspection_status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  approval_notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminOrderItemAdjustmentDto)
  items?: AdminOrderItemAdjustmentDto[];
}
