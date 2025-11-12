import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SessionStore } from './session.store';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ConfigModule, AuthModule, SellersModule, DatabaseModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, SessionStore],
})
export class WhatsappModule {}
