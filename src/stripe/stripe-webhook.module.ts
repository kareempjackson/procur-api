import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RefundsModule } from '../refunds/refunds.module';
import { DisputesModule } from '../disputes/disputes.module';
import { StripeModule } from './stripe.module';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [DatabaseModule, StripeModule, RefundsModule, DisputesModule],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
})
export class StripeWebhookModule {}
