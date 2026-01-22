import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EventProcessJobData } from './events.interface';

@Injectable()
export class EventsQueue {
  constructor(@Inject('EVENTS_QUEUE') private readonly queue: Queue) {}

  /**
   * Enqueue an event for async processing by handlers (analytics, webhooks, etc.)
   */
  enqueueProcess(job: EventProcessJobData) {
    return this.queue.add('process', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  /**
   * Get queue stats for monitoring
   */
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}

