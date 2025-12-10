import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../database/database.module';
import { FinanceModule } from '../finance/finance.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [
    DatabaseModule,
    FinanceModule,
    WhatsappModule,
    EmailModule,
    SellersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
