import { EventType, AggregateType, ActorType } from './event-types';

/**
 * Input for emitting a new event
 */
export interface EmitEventInput<T = Record<string, unknown>> {
  /** The event type from EventTypes registry */
  type: EventType;
  
  /** Schema version for this event type (default: 1) */
  version?: number;
  
  /** The domain entity type this event is about */
  aggregateType?: AggregateType | string;
  
  /** The ID of the entity this event is about */
  aggregateId?: string;
  
  /** User ID who triggered this event (null for system events) */
  actorId?: string;
  
  /** What triggered this event */
  actorType?: ActorType;
  
  /** Organization context if applicable */
  organizationId?: string;
  
  /** Event-specific data */
  payload: T;
  
  /** Request context, trace IDs, etc. */
  metadata?: EventMetadata;
  
  /** Optional key to prevent duplicate events from retries */
  idempotencyKey?: string;
}

/**
 * Event metadata for tracing and debugging
 */
export interface EventMetadata {
  /** Request trace ID for distributed tracing */
  correlationId?: string;
  
  /** Parent event ID (for event chains) */
  causationId?: string;
  
  /** Source of the event */
  source?: 'api' | 'whatsapp' | 'admin' | 'mobile' | 'cron' | 'webhook';
  
  /** Client IP address */
  ipAddress?: string;
  
  /** Client user agent */
  userAgent?: string;
  
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Stored event record from database
 */
export interface StoredEvent<T = Record<string, unknown>> {
  id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string | null;
  aggregate_id: string | null;
  actor_id: string | null;
  actor_type: string;
  organization_id: string | null;
  payload: T;
  metadata: EventMetadata | null;
  idempotency_key: string | null;
  processed_at: string | null;
  created_at: string;
}

/**
 * Event handler interface for processing events
 */
export interface EventHandler {
  /** Unique name for this handler */
  name: string;
  
  /** Event types this handler processes (empty = all events) */
  eventTypes?: EventType[];
  
  /** Process the event */
  handle(event: StoredEvent): Promise<void>;
}

/**
 * Queue job data for event processing
 */
export interface EventProcessJobData {
  eventId: string;
}

