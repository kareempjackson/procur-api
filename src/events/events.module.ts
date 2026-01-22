import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { EventsService } from './events.service';
import { EventsQueue } from './events.queue';
import { startEventsWorker } from './events.worker';
import { DatabaseModule } from '../database/database.module';

/**
 * Events Module - Central event pipeline for the Procur platform.
 * 
 * This module provides:
 * - EventsService: Emit domain events from anywhere in the app
 * - EventsQueue: BullMQ queue for async processing
 * - EventsWorker: Background worker for handling events
 * 
 * Usage:
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly events: EventsService) {}
 * 
 *   async createOrder(...) {
 *     // ... create order logic
 *     
 *     await this.events.emit({
 *       type: EventTypes.Order.CREATED,
 *       aggregateType: AggregateTypes.ORDER,
 *       aggregateId: order.id,
 *       actorId: userId,
 *       organizationId: buyerOrgId,
 *       payload: { orderNumber, sellerOrgId, totalAmount },
 *     });
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    EventsService,
    EventsQueue,
    {
      provide: 'EVENTS_REDIS',
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
      provide: 'EVENTS_QUEUE',
      inject: ['EVENTS_REDIS'],
      useFactory: (redis: IORedis) => {
        return new Queue('events-pipeline', { connection: redis });
      },
    },
    {
      provide: 'EVENTS_WORKER',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('redis.url') || '';
        const supabaseUrl = config.get<string>('database.supabaseUrl') || '';
        const supabaseServiceKey =
          config.get<string>('database.supabaseServiceRoleKey') || '';

        // Only start worker if Redis is configured
        if (!redisUrl) {
          console.warn(
            '[EventsModule] Redis URL not configured, events worker not started',
          );
          return null;
        }

        // Start the worker with no handlers initially
        // Handlers can be added via configuration or separate provider
        return startEventsWorker({
          redisUrl,
          supabaseUrl,
          supabaseServiceKey,
          handlers: [
            // Add handlers here or via a separate configuration
            // Example:
            // {
            //   name: 'analytics',
            //   handle: async (event) => {
            //     console.log('[Analytics]', event.event_type, event.payload);
            //   },
            // },
          ],
        });
      },
    },
  ],
  exports: [EventsService, EventsQueue],
})
export class EventsModule {}

