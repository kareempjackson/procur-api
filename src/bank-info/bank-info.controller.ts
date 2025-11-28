import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BankInfoService } from './bank-info.service';
import { UpdateFarmerBankInfoDto } from './dto/update-farmer-bank-info.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';

@ApiTags('Bank Info')
@ApiBearerAuth('JWT-auth')
@Controller('admin/farmers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.SUPER_ADMIN)
export class BankInfoController {
  constructor(private readonly bankInfo: BankInfoService) {}

  @Get(':orgId/bank-info')
  @ApiOperation({
    summary: 'Get masked farmer bank information',
    description:
      'Returns masked bank info for a farmer organization (admin-only).',
  })
  async getMasked(@Param('orgId') orgId: string): Promise<{
    account_name: string | null;
    bank_name: string | null;
    account_last4: string | null;
    bank_branch: string | null;
    has_bank_info: boolean;
  }> {
    return this.bankInfo.getMaskedBankInfo(orgId);
  }

  @Patch(':orgId/bank-info')
  @ApiOperation({
    summary: 'Set or update farmer bank information',
    description:
      'Creates or updates encrypted bank information for a farmer organization.',
  })
  async updateBankInfo(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateFarmerBankInfoDto,
    @CurrentUser() user: UserContext,
  ): Promise<{ success: boolean }> {
    await this.bankInfo.setBankInfo(orgId, dto, user.id);
    return { success: true };
  }
}
