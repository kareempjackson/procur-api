import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrencyService } from './currency.service';

@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @Public()
  @ApiOperation({
    summary: 'Get exchange rates',
    description: 'Returns all currency exchange rates for cross-country price conversion.',
  })
  async getRates() {
    const rates = await this.currencyService.getRates();
    return { rates };
  }
}
