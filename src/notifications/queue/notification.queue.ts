import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationQueue {
  constructor(@Inject('NOTIFICATION_QUEUE') private readonly queue: Queue) {}

  enqueueFanout(job: { eventId: string }) {
    return this.queue.add('fanout', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  enqueueDeliver(job: {
    notificationId: string;
    channel: 'websocket' | 'email' | 'push';
  }) {
    return this.queue.add('deliver', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
