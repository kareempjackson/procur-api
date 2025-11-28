import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { DatabaseModule } from '../database/database.module';
import { OrderClearingService } from './order-clearing.service';
import { BankInfoModule } from '../bank-info/bank-info.module';

@Module({
  imports: [DatabaseModule, BankInfoModule],
  controllers: [FinanceController],
  providers: [FinanceService, OrderClearingService],
  exports: [OrderClearingService],
})
export class FinanceModule {}
