import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { TradeService, TradeCheckResult } from './trade.service';

@ApiTags('Trade')
@Controller('trade')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get('restrictions')
  @Public()
  @ApiOperation({
    summary: 'Check trade restrictions for a category to a destination island',
  })
  async getRestrictions(
    @Query('dest') dest: string,
    @Query('category') category?: string,
    @Query('origin') origin?: string,
  ) {
    const restrictions = await this.tradeService.getRestrictions(
      dest,
      category,
      origin,
    );
    return { restrictions };
  }

  @Post('check-cart')
  @ApiOperation({
    summary: 'Validate cart items against trade restrictions',
    description:
      'Check all items in a cart against import/export rules for the buyer destination island.',
  })
  async checkCart(
    @Body()
    body: {
      items: Array<{
        product_id: string;
        product_name: string;
        category: string;
        origin_country: string;
      }>;
      dest_country: string;
    },
  ): Promise<{ results: TradeCheckResult[] }> {
    const results = await this.tradeService.checkCart(
      body.items,
      body.dest_country,
    );
    return { results };
  }
}
