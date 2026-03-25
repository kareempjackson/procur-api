import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { DatabaseModule } from '../database/database.module';
import { BankInfoModule } from '../bank-info/bank-info.module';
import { BuyersModule } from '../buyers/buyers.module';
import { FarmModule } from '../farm/farm.module';

@Module({
  imports: [DatabaseModule, BankInfoModule, BuyersModule, FarmModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
