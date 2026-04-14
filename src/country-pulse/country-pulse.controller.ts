import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CountryPulseService } from './country-pulse.service';
import { CountryPulseResponseDto } from './dto/country-pulse.dto';

@ApiTags('Country Pulse')
@Controller('country-pulse')
export class CountryPulseController {
  constructor(private readonly pulseService: CountryPulseService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get Country Pulse',
    description:
      'Returns per-country supply/demand signals (In Demand, Scarce, Trending, Surplus) for the marketplace landing page. Uses X-Country-Code header if countryCode query param is omitted.',
  })
  @ApiQuery({ name: 'countryCode', required: false })
  async getPulse(
    @Req() req: Request,
    @Query('countryCode') countryCode?: string,
  ): Promise<CountryPulseResponseDto> {
    const code = countryCode || req.countryCode || 'gda';
    return this.pulseService.getPulseForCountry(code);
  }

  @Get('ticker')
  @Public()
  @ApiOperation({
    summary: 'Get Cross-Country Ticker',
    description:
      'Flat list of top signals across all active pulse-enabled countries, used by the landing page marquee ticker. Interleaved round-robin so no single country dominates.',
  })
  async getTicker() {
    const entries = await this.pulseService.getTicker();
    return { entries };
  }
}
