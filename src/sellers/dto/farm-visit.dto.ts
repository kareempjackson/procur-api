import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FarmVisitRequestDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seller_org_id: string;

  @ApiProperty()
  requested_by_user_id: string;

  @ApiProperty({ required: false, description: 'Preferred date for the visit' })
  preferred_date?: string | null;

  @ApiProperty({
    required: false,
    description: 'Preferred time window (e.g. morning, afternoon)',
  })
  preferred_time_window?: string | null;

  @ApiProperty({ required: false, description: 'Additional notes from seller' })
  notes?: string | null;

  @ApiProperty({
    description:
      'Current status of the request (pending/scheduled/completed/cancelled)',
  })
  status: string;

  @ApiProperty({
    required: false,
    description: 'Exact scheduled datetime if confirmed by admin',
  })
  scheduled_for?: string | null;

  @ApiProperty({ required: false, description: 'Internal admin notes' })
  admin_notes?: string | null;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}

export class CreateFarmVisitRequestDto {
  @ApiProperty({
    required: false,
    description: 'Preferred date for the visit (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  preferred_date?: string;

  @ApiProperty({
    required: false,
    description: 'Preferred time window (e.g. morning, afternoon)',
  })
  @IsOptional()
  @IsString()
  preferred_time_window?: string;

  @ApiProperty({
    required: false,
    description: 'Additional notes or directions for the farm visit',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
