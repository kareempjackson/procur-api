import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, tap } from 'rxjs';
import { AuditService } from './audit.service';
import type { UserContext } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();

    // Only handle HTTP requests
    if (!req) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap(async () => {
        const res = ctx.getResponse();
        const statusCode = res?.statusCode ?? 200;
        await this.logRequest(context, statusCode, Date.now() - startedAt);
      }),
      catchError((err) => {
        const res = ctx.getResponse();
        const statusCode = res?.statusCode ?? 500;
        // Fire-and-forget – do not await so we don't interfere with error pipeline
        void this.logRequest(context, statusCode, Date.now() - startedAt, err);
        throw err;
      }),
    );
  }

  private async logRequest(
    context: ExecutionContext,
    statusCode: number,
    durationMs: number,
    error?: unknown,
  ): Promise<void> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    if (!req) return;

    // Basic request info
    const method = (req.method || 'GET').toUpperCase();
    const url = (req as any).originalUrl || req.url; // eslint-disable-line @typescript-eslint/no-explicit-any
    const path = req.path || url;

    // Skip very noisy/irrelevant routes
    if (
      path.startsWith('/api/docs') ||
      path.includes('/swagger-ui') ||
      path.startsWith('/health')
    ) {
      return;
    }

    const user = (req as any).user as UserContext | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

    const controller = context.getClass()?.name ?? '';
    const handler = context.getHandler()?.name ?? '';

    const { resource, resourceId } = this.deriveResource(path, req);

    const action = this.buildActionDescription({
      method,
      path,
      controller,
      handler,
      resource,
      resourceId,
      statusCode,
      durationMs,
      user,
    });

    const meta: Record<string, any> = {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      summary: action,
      params: req.params,
      query: req.query,
      durationMs,
    };

    // Only include a sanitized body for non-GET requests
    if (method !== 'GET' && req.body) {
      meta.body = this.sanitizeBody(req.body);
    }

    if (error instanceof Error) {
      meta.error = {
        name: error.name,
        message: error.message,
      };
    }

    await this.auditService.log({
      userId: user?.id,
      organizationId: user?.organizationId ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      actorAccountType: user?.accountType ?? null,
      action,
      resource,
      resourceId,
      route: url,
      method,
      statusCode,
      ipAddress:
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ??
        req.ip ??
        null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      meta,
    });
  }

  private buildActionDescription(input: {
    method: string;
    path: string;
    controller: string;
    handler: string;
    resource: string | null;
    resourceId: string | null;
    statusCode: number;
    durationMs: number;
    user?: UserContext;
  }): string {
    const {
      method,
      path,
      controller,
      handler,
      resource,
      resourceId,
      statusCode,
      durationMs,
      user,
    } = input;

    const cleanController = controller.replace(/Controller$/u, '');
    const cleanHandler = handler || 'handler';

    const prettyResource = (resource || cleanController || 'request')
      .replace(/[_-]+/gu, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    let verb: string;
    switch (method) {
      case 'GET':
        verb = resourceId ? 'View' : 'List';
        break;
      case 'POST':
        verb = 'Create';
        break;
      case 'PUT':
      case 'PATCH':
        verb = 'Update';
        break;
      case 'DELETE':
        verb = 'Delete';
        break;
      default:
        verb = method;
    }

    const actor = user?.email ?? user?.id ?? 'anonymous';
    const roleFragment = user?.role ? ` as ${user.role}` : '';

    const resourceFragment = resourceId
      ? `${prettyResource} (${resourceId})`
      : prettyResource;

    const base = `${verb} ${resourceFragment}`.trim();

    const technicalRef =
      cleanController && cleanHandler
        ? ` – ${cleanController}.${cleanHandler}`
        : '';

    return `${actor}${roleFragment}: ${base} [${method} ${path}] → ${statusCode} in ${durationMs}ms${technicalRef}`;
  }

  private deriveResource(
    path: string,
    req: Request,
  ): { resource: string | null; resourceId: string | null } {
    const segments = path.split('/').filter(Boolean);

    // Try to find the logical resource segment (e.g. admin/buyers/:id → "buyers")
    let resource: string | null = null;
    const adminIdx = segments.indexOf('admin');
    if (adminIdx >= 0 && segments.length > adminIdx + 1) {
      resource = segments[adminIdx + 1];
    } else if (segments.length > 0) {
      // Fallback: first segment after API prefix
      const apiIdx = segments.indexOf('api');
      if (apiIdx >= 0 && segments.length > apiIdx + 2) {
        resource = segments[apiIdx + 2];
      } else {
        resource = segments[0];
      }
    }

    // Convention: most routes use :id as primary identifier
    const rawId = (req.params as any)?.id as string | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

    return {
      resource,
      resourceId: rawId ?? null,
    };
  }

  // Shallow sanitizer for request bodies – removes obvious sensitive fields
  // and trims large payloads while preserving useful structure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitizeBody(body: any): any {
    const SENSITIVE_KEYS = [
      'password',
      'newPassword',
      'oldPassword',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
    ];

    if (!body || typeof body !== 'object') return body;

    if (Array.isArray(body)) {
      return body.slice(0, 50).map((item) => this.sanitizeBody(item));
    }

    const clone: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const [key, value] of Object.entries(body)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((k) => lower.includes(k.toLowerCase()))) {
        clone[key] = '[redacted]';
      } else if (value && typeof value === 'object') {
        clone[key] = this.sanitizeBody(value);
      } else {
        clone[key] = value;
      }
    }

    return clone;
  }
}
