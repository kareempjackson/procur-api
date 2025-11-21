import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrganizationStatus } from '../../common/enums/organization-status.enum';

export class UpdateAdminOrganizationStatusDto {
  @ApiProperty({
    description: 'New organization status',
    enum: OrganizationStatus,
  })
  @IsEnum(OrganizationStatus)
  status: OrganizationStatus;
}
