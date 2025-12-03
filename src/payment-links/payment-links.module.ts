import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PaymentLinksService } from './payment-links.service';
import { PaymentLinksController } from './payment-links.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentLinksController],
  providers: [PaymentLinksService],
  exports: [PaymentLinksService],
})
export class PaymentLinksModule {}
