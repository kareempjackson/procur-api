import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class WaQueue {
  constructor(@Inject('WA_QUEUE') private readonly queue: Queue) {}

  enqueueSendMessage(job: { payload: any; meta?: Record<string, any> }) {
    return this.queue.add('send', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
