import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CountriesService } from './countries.service';
import { DatabaseCountry } from '../database/types/database.types';

@ApiTags('Countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List Active Countries',
    description: 'Returns all active countries supported by Procur.',
  })
  @ApiResponse({ status: 200, description: 'Countries retrieved successfully' })
  async listCountries(): Promise<{ countries: DatabaseCountry[] }> {
    const countries = await this.countriesService.getActiveCountries();
    return { countries };
  }

  @Get(':code')
  @Public()
  @ApiOperation({
    summary: 'Get Country Details',
    description: 'Get details for a specific country by its code.',
  })
  @ApiParam({ name: 'code', description: 'Country code (e.g. gda, tnt, svg)' })
  @ApiResponse({ status: 200, description: 'Country retrieved successfully' })
  async getCountry(
    @Param('code') code: string,
  ): Promise<DatabaseCountry> {
    return this.countriesService.getCountryByCode(code);
  }

  @Patch('me/default')
  @ApiOperation({
    summary: 'Set Default Country',
    description:
      "Set the authenticated user's default country preference for marketplace browsing.",
  })
  @ApiResponse({ status: 200, description: 'Default country updated' })
  async setDefaultCountry(
    @Req() req: Request,
    @Body() body: { country_code: string },
  ): Promise<{ success: boolean }> {
    await this.countriesService.setUserDefaultCountry(
      req.user!.id,
      body.country_code,
    );
    return { success: true };
  }
}
