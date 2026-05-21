import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  imports: [DatabaseModule, StripeModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
