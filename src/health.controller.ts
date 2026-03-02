import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { SupabaseService } from './database/supabase.service';
import IORedis from 'ioredis';

@Controller()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject('REDIS') private readonly redis: IORedis,
  ) {}

  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }

  @Public()
  @Get('readyz')
  @HttpCode(200)
  async readyz() {
    const checks: Record<string, 'ok' | 'error'> = {};

    // Redis liveness
    try {
      const pong = await this.redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks.redis = 'error';
    }

    // Supabase liveness (lightweight query)
    try {
      const client = this.supabase.getClient();
      const { error } = await client.from('users').select('id').limit(1);
      checks.supabase = error ? 'error' : 'ok';
    } catch {
      checks.supabase = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    return { status: allOk ? 'ready' : 'degraded', checks };
  }
}
