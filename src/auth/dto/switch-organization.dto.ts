import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { AccountType } from '../../common/enums/account-type.enum';

export class SwitchOrganizationDto {
  @ApiProperty({
    example: '660e8400-e29b-41d4-a716-446655440050',
    description: 'ID of an organization the authenticated user is a member of',
  })
  @IsNotEmpty()
  @IsUUID()
  organizationId: string;
}

export class OrganizationMembershipDto {
  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440050' })
  id: string;

  @ApiProperty({ example: "Maria's Farm" })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.SELLER })
  accountType: AccountType;

  @ApiProperty({ example: 'admin' })
  role: string;

  @ApiProperty({
    example: true,
    description:
      'True for the org currently driving the active session (matches users.active_organization_id, or the fallback first membership).',
  })
  isActive: boolean;
}

export class ListOrganizationsResponseDto {
  @ApiProperty({ type: [OrganizationMembershipDto] })
  organizations: OrganizationMembershipDto[];
}
