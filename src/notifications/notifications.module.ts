import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationQueue } from './queue/notification.queue';
import { WebsocketProvider } from './providers/websocket.provider';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, EmailModule, AuthModule],
  providers: [
    NotificationsService,
    NotificationsGateway,
    WebsocketProvider,
    EmailProvider,
    PushProvider,
    NotificationQueue,
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        if (!url) {
          return new IORedis({ maxRetriesPerRequest: null });
        }
        return new IORedis(url, { maxRetriesPerRequest: null });
      },
    },
    {
      provide: 'NOTIFICATION_QUEUE',
      inject: ['REDIS'],
      useFactory: (redis: IORedis) => {
        return new Queue('notification-delivery', { connection: redis });
      },
    },
  ],
  controllers: [NotificationsController],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationQueue,
    'REDIS',
  ],
})
export class NotificationsModule {}
