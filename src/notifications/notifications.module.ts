import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { NotificationQueue } from './queue/notification.queue';
import { WebsocketProvider } from './providers/websocket.provider';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { startNotificationWorker } from './queue/notification.worker';

const redisLogger = new Logger('Redis');

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
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
          redisLogger.warn(
            'REDIS_URL is not set — cache is disabled. Set REDIS_URL in Railway environment variables.',
          );
        } else {
          // Mask credentials in log output
          const safeUrl = url.replace(/:\/\/[^@]+@/, '://*****@');
          redisLogger.log(`Connecting to Redis: ${safeUrl}`);
        }

        const client = url
          ? new IORedis(url, { maxRetriesPerRequest: null })
          : new IORedis({ maxRetriesPerRequest: null });

        client.on('ready', () =>
          redisLogger.log('Redis connection established ✓'),
        );
        client.on('error', (err: Error) =>
          redisLogger.error(`Redis error: ${err.message}`),
        );
        client.on('close', () =>
          redisLogger.warn('Redis connection closed'),
        );
        client.on('reconnecting', () =>
          redisLogger.warn('Redis reconnecting…'),
        );

        return client;
      },
    },
    {
      provide: 'NOTIFICATION_QUEUE',
      inject: ['REDIS'],
      useFactory: (redis: IORedis) => {
        return new Queue('notification-delivery', { connection: redis });
      },
    },
    {
      provide: 'NOTIFICATIONS_WORKER',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('redis.url') || '';
        const supabaseUrl = config.get<string>('database.supabaseUrl') || '';
        const supabaseServiceKey =
          config.get<string>('database.supabaseServiceRoleKey') || '';
        // Start a worker in the API process; safe to start multiple (BullMQ handles concurrency)
        return startNotificationWorker({
          redisUrl,
          supabaseUrl,
          supabaseServiceKey,
        });
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
