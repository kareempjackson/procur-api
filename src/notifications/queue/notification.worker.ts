import { Worker, QueueEvents, Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';

export function startNotificationWorker(env: {
  redisUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}) {
  const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

  const deliveryQueue = new Queue('notification-delivery', { connection });

  const processor = async (job: Job) => {
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);

    if (job.name === 'fanout') {
      const eventId = job.data.eventId as string;
      const { data: ev } = await supabase
        .from('notification_events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (!ev) return;

      const recipients: string[] = ev.payload?.recipients ?? [];
      if (!recipients.length) return;

      const rows = recipients.map((uid) => ({
        event_id: ev.id,
        recipient_user_id: uid,
        title: ev.payload?.title ?? 'Notification',
        body: ev.payload?.body ?? '',
        data: ev.payload ?? {},
        category: ev.payload?.category ?? null,
        priority: ev.payload?.priority ?? 'normal',
      }));

      const { data: inserted } = await supabase
        .from('notifications')
        .insert(rows)
        .select('id, recipient_user_id');

      for (const n of inserted ?? []) {
        await deliveryQueue.add('deliver', {
          notificationId: n.id,
          channel: 'websocket',
        });
        await deliveryQueue.add('deliver', {
          notificationId: n.id,
          channel: 'push',
        });
      }

      await supabase
        .from('notification_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', ev.id);
    }

    if (job.name === 'deliver') {
      const { notificationId, channel } = job.data as {
        notificationId: string;
        channel: string;
      };
      const { data: notif } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();
      if (!notif) return;

      try {
        if (channel === 'websocket') {
          // The API process will deliver via gateway; here we only log attempt.
        } else if (channel === 'email') {
          // integrate email provider in API process or here via Postmark
        } else if (channel === 'push') {
          // integrate push providers
        }

        await supabase.from('notification_delivery_attempts').insert({
          notification_id: notificationId,
          channel,
          status: 'success',
        });
      } catch (e: any) {
        await supabase.from('notification_delivery_attempts').insert({
          notification_id: notificationId,
          channel,
          status:
            job.attemptsMade < (job.opts.attempts ?? 1) ? 'retry' : 'failed',
          error: String(e?.message ?? e),
        });
        throw e;
      }
    }
  };

  const worker = new Worker('notification-delivery', processor, { connection });
  new QueueEvents('notification-delivery', { connection });
  return worker;
}
