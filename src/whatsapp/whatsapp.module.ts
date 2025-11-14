import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SessionStore } from './session.store';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { SessionStoreRedis } from './session.store.redis';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { WaQueue } from './wa.queue';
import { startWaWorker } from './wa.worker';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { SendService } from './send/send.service';
import { TemplateService } from './templates/template.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    SellersModule,
    DatabaseModule,
    AiModule,
    NotificationsModule,
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    SessionStore,
    WaQueue,
    SendService,
    {
      provide: TemplateService,
      inject: [SendService, 'REDIS'],
      useFactory: (send: SendService, redis: IORedis) => {
        // TemplateService expects SendService and Redis instance
        return new TemplateService(send as any, redis);
      },
    },
    {
      provide: 'WA_QUEUE',
      inject: ['REDIS'],
      useFactory: (redis: IORedis) => {
        return new Queue('wa-send', { connection: redis });
      },
    },
    {
      provide: 'WA_WORKER',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('redis.url');
        return startWaWorker({ redisUrl: redisUrl || undefined });
      },
    },
  ],
})
export class WhatsappModule {}
