import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { EventsQueue } from './events.queue';
import { EmitEventInput, StoredEvent } from './events.interface';
import { ActorTypes } from './event-types';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: EventsQueue,
  ) {}

  /**
   * Emit a domain event to the events pipeline.
   * 
   * The event is immediately written to the events table (source of truth),
   * then enqueued for async processing by handlers (analytics, webhooks, etc.).
   * 
   * @param input - Event data
   * @returns The event ID
   * 
   * @example
   * ```typescript
   * await this.eventsService.emit({
   *   type: EventTypes.Order.CREATED,
   *   aggregateType: AggregateTypes.ORDER,
   *   aggregateId: order.id,
   *   actorId: userId,
   *   organizationId: buyerOrgId,
   *   payload: {
   *     orderNumber: order.order_number,
   *     sellerOrgId: order.seller_organization_id,
   *     totalAmount: order.total,
   *   },
   * });
   * ```
   */
  async emit<T = Record<string, unknown>>(
    input: EmitEventInput<T>,
  ): Promise<string> {
    const client = this.supabase.getClient();

    // Insert event into database
    const { data, error } = await client
      .from('events')
      .insert({
        event_type: input.type,
        event_version: input.version ?? 1,
        aggregate_type: input.aggregateType ?? null,
        aggregate_id: input.aggregateId ?? null,
        actor_id: input.actorId ?? null,
        actor_type: input.actorType ?? ActorTypes.USER,
        organization_id: input.organizationId ?? null,
        payload: input.payload,
        metadata: input.metadata ?? null,
        idempotency_key: input.idempotencyKey ?? null,
      })
      .select('id')
      .single();

    if (error) {
      // If it's a duplicate idempotency key, log and return gracefully
      if (error.code === '23505' && input.idempotencyKey) {
        this.logger.debug(
          `Duplicate event ignored (idempotency_key: ${input.idempotencyKey})`,
        );
        // Fetch the existing event ID
        const { data: existing } = await client
          .from('events')
          .select('id')
          .eq('idempotency_key', input.idempotencyKey)
          .single();
        return existing?.id ?? '';
      }

      this.logger.error('Failed to insert event', { error, input });
      throw error;
    }

    const eventId = data.id as string;

    // Queue for async processing - best effort, don't block the caller
    try {
      await this.withTimeout(
        this.queue.enqueueProcess({ eventId }),
        1500,
        'events enqueue',
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Failed to enqueue event ${eventId} for processing: ${message}`,
      );
    }

    return eventId;
  }

  /**
   * Emit multiple events in a batch (within a single transaction).
   * Useful for operations that produce multiple related events.
   */
  async emitBatch<T = Record<string, unknown>>(
    inputs: EmitEventInput<T>[],
  ): Promise<string[]> {
    if (inputs.length === 0) return [];

    const client = this.supabase.getClient();

    const rows = inputs.map((input) => ({
      event_type: input.type,
      event_version: input.version ?? 1,
      aggregate_type: input.aggregateType ?? null,
      aggregate_id: input.aggregateId ?? null,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType ?? ActorTypes.USER,
      organization_id: input.organizationId ?? null,
      payload: input.payload,
      metadata: input.metadata ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    }));

    const { data, error } = await client
      .from('events')
      .insert(rows)
      .select('id');

    if (error) {
      this.logger.error('Failed to insert event batch', { error });
      throw error;
    }

    const eventIds = (data ?? []).map((row) => row.id as string);

    // Queue all for processing
    for (const eventId of eventIds) {
      try {
        await this.queue.enqueueProcess({ eventId });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `Failed to enqueue event ${eventId} for processing: ${message}`,
        );
      }
    }

    return eventIds;
  }

  /**
   * Query events by type, aggregate, or time range.
   */
  async queryEvents(query: {
    eventType?: string;
    aggregateType?: string;
    aggregateId?: string;
    organizationId?: string;
    actorId?: string;
    since?: Date;
    until?: Date;
    limit?: number;
    offset?: number;
  }): Promise<StoredEvent[]> {
    const client = this.supabase.getClient();

    let q = client
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (query.eventType) {
      q = q.eq('event_type', query.eventType);
    }
    if (query.aggregateType) {
      q = q.eq('aggregate_type', query.aggregateType);
    }
    if (query.aggregateId) {
      q = q.eq('aggregate_id', query.aggregateId);
    }
    if (query.organizationId) {
      q = q.eq('organization_id', query.organizationId);
    }
    if (query.actorId) {
      q = q.eq('actor_id', query.actorId);
    }
    if (query.since) {
      q = q.gte('created_at', query.since.toISOString());
    }
    if (query.until) {
      q = q.lte('created_at', query.until.toISOString());
    }

    q = q.limit(query.limit ?? 100);
    if (query.offset) {
      q = q.range(query.offset, query.offset + (query.limit ?? 100) - 1);
    }

    const { data, error } = await q;

    if (error) {
      this.logger.error('Failed to query events', { error, query });
      throw error;
    }

    return (data ?? []) as StoredEvent[];
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<StoredEvent | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as StoredEvent;
  }

  /**
   * Mark an event as processed
   */
  async markProcessed(eventId: string): Promise<void> {
    const client = this.supabase.getClient();

    await client
      .from('events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventId);
  }

  /**
   * Timeout wrapper for async operations
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let t: NodeJS.Timeout | undefined;
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
}

