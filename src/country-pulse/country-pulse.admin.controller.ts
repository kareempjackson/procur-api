import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { CountryPulseService } from './country-pulse.service';
import {
  CreatePulseOverrideDto,
  UpdatePulseOverrideDto,
} from './dto/country-pulse.dto';

@ApiTags('Admin — Country Pulse')
@ApiBearerAuth('JWT-auth')
@Controller('admin/country-pulse')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.SUPER_ADMIN)
export class CountryPulseAdminController {
  constructor(private readonly pulseService: CountryPulseService) {}

  @Get(':countryCode')
  @ApiOperation({ summary: 'Get snapshots + overrides for a country' })
  @ApiParam({ name: 'countryCode' })
  async getCountryPulse(@Param('countryCode') countryCode: string) {
    const [snapshots, overrides, merged] = await Promise.all([
      this.pulseService.listSnapshots(countryCode),
      this.pulseService.listOverrides(countryCode),
      this.pulseService.getPulseForCountry(countryCode),
    ]);
    return { snapshots, overrides, merged };
  }

  @Post(':countryCode/overrides')
  @ApiOperation({ summary: 'Create a pulse override for a country' })
  async createOverride(
    @Param('countryCode') countryCode: string,
    @Body() input: CreatePulseOverrideDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.pulseService.createOverride(countryCode, input, user.id);
  }

  @Patch('overrides/:id')
  @ApiOperation({ summary: 'Update a pulse override' })
  async updateOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePulseOverrideDto,
  ) {
    return this.pulseService.updateOverride(id, input);
  }

  @Delete('overrides/:id')
  @ApiOperation({ summary: 'Delete a pulse override' })
  async deleteOverride(@Param('id', ParseUUIDPipe) id: string) {
    await this.pulseService.deleteOverride(id);
    return { success: true };
  }

  @Post(':countryCode/recompute')
  @ApiOperation({ summary: 'Recompute snapshots for a country' })
  async recompute(@Param('countryCode') countryCode: string) {
    return this.pulseService.recomputeCountry(countryCode);
  }

  @Post('recompute-all')
  @ApiOperation({ summary: 'Recompute snapshots for all active countries' })
  async recomputeAll() {
    return this.pulseService.recomputeAll();
  }
}
