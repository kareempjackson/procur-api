import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PaymentLinksService } from './payment-links.service';
import { PaymentLinksController } from './payment-links.controller';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [DatabaseModule, SellersModule],
  controllers: [PaymentLinksController],
  providers: [PaymentLinksService],
  exports: [PaymentLinksService],
})
export class PaymentLinksModule {}
