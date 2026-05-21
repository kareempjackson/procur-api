import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { StripeModule } from '../stripe/stripe.module';
import { CreditNoteService } from './credit-note.service';
import { RefundsService } from './refunds.service';

@Module({
  imports: [DatabaseModule, EmailModule, StripeModule],
  providers: [RefundsService, CreditNoteService],
  exports: [RefundsService, CreditNoteService],
})
export class RefundsModule {}
