import { Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StoredEvent, EventHandler } from './events.interface';

/**
 * Configuration for the events worker
 */
export interface EventsWorkerConfig {
  redisUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  handlers?: EventHandler[];
}

/**
 * Start the events worker that processes events asynchronously.
 * 
 * This worker:
 * 1. Picks up events from the BullMQ queue
 * 2. Runs registered handlers (analytics, webhooks, etc.)
 * 3. Marks events as processed
 * 
 * Handlers are optional - if none are registered, events are just marked processed.
 * You can add handlers for analytics, webhooks, notifications, etc.
 */
export function startEventsWorker(config: EventsWorkerConfig) {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  const handlers = config.handlers ?? [];

  const processor = async (job: Job) => {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    if (job.name === 'process') {
      const eventId = job.data.eventId as string;
      
      // Fetch the event
      const event = await fetchEvent(supabase, eventId);
      if (!event) {
        console.warn(`[EventsWorker] Event ${eventId} not found, skipping`);
        return;
      }

      // Run handlers
      for (const handler of handlers) {
        // Skip if handler only wants specific event types and this isn't one
        if (
          handler.eventTypes &&
          handler.eventTypes.length > 0 &&
          !handler.eventTypes.includes(event.event_type as any)
        ) {
          continue;
        }

        try {
          await handler.handle(event);
        } catch (error) {
          console.error(
            `[EventsWorker] Handler "${handler.name}" failed for event ${eventId}:`,
            error,
          );
          // Continue with other handlers even if one fails
        }
      }

      // Mark as processed
      await markEventProcessed(supabase, eventId);
    }
  };

  const worker = new Worker('events-pipeline', processor, {
    connection,
    concurrency: 10,
  });

  // Log events for monitoring
  const queueEvents = new QueueEvents('events-pipeline', { connection });

  queueEvents.on('completed', ({ jobId }) => {
    console.log(`[EventsWorker] Job ${jobId} completed`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[EventsWorker] Job ${jobId} failed: ${failedReason}`);
  });

  worker.on('error', (err) => {
    console.error('[EventsWorker] Worker error:', err);
  });

  console.log('[EventsWorker] Started events worker');

  return worker;
}

async function fetchEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<StoredEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as StoredEvent;
}

async function markEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  await supabase
    .from('events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', eventId);
}

