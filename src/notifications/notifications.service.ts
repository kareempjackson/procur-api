import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { NotificationQueue } from './queue/notification.queue';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: NotificationQueue,
  ) {}

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let t: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          t = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async emitEvent(input: {
    eventType: string;
    actorUserId?: string;
    organizationId?: string;
    payload: any;
    dedupeKey?: string;
  }) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('notification_events')
      .insert({
        event_type: input.eventType,
        actor_user_id: input.actorUserId ?? null,
        organization_id: input.organizationId ?? null,
        payload: input.payload,
        dedupe_key: input.dedupeKey ?? null,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to insert notification event', error);
      throw error;
    }

    // Queue fanout is best-effort: do not block critical flows (like checkout)
    // on Redis/BullMQ health. Timebox to avoid hanging requests.
    try {
      await this.withTimeout(
        this.queue.enqueueFanout({ eventId: data.id }),
        1500,
        'notification enqueueFanout',
      );
    } catch (e: any) {
      this.logger.warn(
        `Failed to enqueue notification fanout for event ${data.id}: ${String(
          e?.message || e,
        )}`,
      );
    }
    return data.id as string;
  }
}
