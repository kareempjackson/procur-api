import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface AuditLogEntry {
  userId?: string;
  organizationId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorAccountType?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  meta?: Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const client = this.supabase.getClient();

      const safeResourceId =
        entry.resourceId && this.isUuid(entry.resourceId)
          ? entry.resourceId
          : null;

      await client.from('audit_log').insert({
        user_id: entry.userId ?? null,
        organization_id: entry.organizationId ?? null,
        actor_email: entry.actorEmail ?? null,
        actor_role: entry.actorRole ?? null,
        actor_account_type: entry.actorAccountType ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        resource_id: safeResourceId,
        route: entry.route ?? null,
        method: entry.method ?? null,
        status_code: entry.statusCode ?? null,
        ip_address: entry.ipAddress ?? null,
        user_agent: entry.userAgent ?? null,
        meta: entry.meta ?? null,
      });
    } catch (e) {
      // Never throw from audit logging – just warn
      this.logger.warn('Audit log insert failed', e as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
