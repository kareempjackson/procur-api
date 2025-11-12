import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Post('payout-batches')
  async createBatch(@Body() dto: { min_amount_cents?: number }) {
    return this.svc.createPayoutBatch(dto?.min_amount_cents ?? 0);
  }

  @Get('payout-batches')
  async listBatches(
    @Query() q: { status?: string; page?: number; limit?: number },
  ) {
    return this.svc.listBatches(q);
  }

  @Get('payout-batches/:id/export')
  async exportBatch(@Param('id') id: string) {
    return this.svc.exportBatchCsv(id);
  }

  @Patch('payout-batches/:id/mark-paid')
  async markPaid(@Param('id') id: string, @Body() dto: { notes?: string }) {
    return this.svc.markBatchPaid(id, dto?.notes);
  }
}
