import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import * as Sentry from '@sentry/node';
import type { UserContext } from '../interfaces/jwt-payload.interface';

@Catch()
export class SentryAllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request | undefined>();
    const executionContext = host as ExecutionContext;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (request) {
      const method = request.method;
      const url = (request as any).originalUrl || request.url; // eslint-disable-line @typescript-eslint/no-explicit-any
      const params = request.params;
      const query = request.query;
      const rawBody = (request as any).body; // eslint-disable-line @typescript-eslint/no-explicit-any
      const user = (request as any).user as UserContext | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

      const sanitizedBody =
        method !== 'GET' && rawBody ? this.sanitizeBody(rawBody) : undefined;

      const headers = this.sanitizeHeaders(request.headers);

      const controller = executionContext.getClass()?.name ?? '';
      const handler = executionContext.getHandler()?.name ?? '';

      Sentry.withScope((scope) => {
        if (user) {
          scope.setUser({
            id: user.id,
            email: user.email,
            // Attach organization metadata as part of user context
            // so it’s visible on the event without polluting tags.
            organizationId: user.organizationId,
            accountType: user.accountType,
          } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        }

        scope.setTag('controller', controller);
        scope.setTag('handler', handler);
        scope.setTag('http.method', method);
        scope.setTag('http.status_code', String(status));

        scope.setContext('request', {
          method,
          url,
          params,
          query,
          body: sanitizedBody,
          headers,
        });

        scope.addBreadcrumb({
          category: 'http',
          message: `${method} ${url} → ${status}`,
          level: status >= 500 ? 'error' : 'warning',
          data: {
            params,
            query,
            body: sanitizedBody,
            userId: user?.id,
            organizationId: user?.organizationId ?? null,
            controller,
            handler,
          },
        });

        Sentry.captureException(exception);
      });
    } else {
      // Non-HTTP context – still capture the exception, but without request data.
      Sentry.captureException(exception);
    }

    if (exception instanceof HttpException) {
      const responseBody = exception.getResponse();

      return response.status(status).json(responseBody);
    }

    // Always log the underlying exception so it surfaces in the API server output —
    // even before Sentry is configured locally, this gives `npm run start:dev` a
    // visible signal instead of a silent 500.
    // eslint-disable-next-line no-console
    console.error('[unhandled exception]', exception);

    // In non-production we include the message / name / code / stack on the
    // response body so the frontend dev tools and curl can see what failed
    // without round-tripping through Sentry. Production stays opaque so we
    // never leak third-party error text (e.g. Stripe internals) to real users.
    const isDev = process.env.NODE_ENV !== 'production';
    const err = exception as Error & { code?: string | number };
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request?.url,
      ...(isDev && {
        message: err?.message,
        name: err?.name,
        code: err?.code,
        // Trim stack to the first ~8 frames so the payload stays scannable
        // in browser devtools / curl.
        stack:
          typeof err?.stack === 'string'
            ? err.stack.split('\n').slice(0, 8)
            : undefined,
      }),
    });
  }

  // Shallow sanitizer for request bodies – mirrors the audit interceptor logic,
  // ensuring we never ship obviously sensitive fields to Sentry.
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

  // Strip obviously sensitive headers before sending to Sentry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitizeHeaders(headers: Record<string, any> | undefined) {
    if (!headers) return undefined;

    const SENSITIVE_HEADER_KEYS = ['authorization', 'cookie', 'x-api-key'];

    const clean: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const [key, value] of Object.entries(headers)) {
      if (SENSITIVE_HEADER_KEYS.includes(key.toLowerCase())) {
        clean[key] = '[redacted]';
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }
}
