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

    await this.queue.enqueueFanout({ eventId: data.id });
    return data.id as string;
  }
}
