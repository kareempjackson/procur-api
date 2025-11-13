import { Inject, Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { Session } from './session.store';

@Injectable()
export class SessionStoreRedis {
  private readonly logger = new Logger(SessionStoreRedis.name);
  private readonly ttlSeconds = 60 * 30;
  private readonly keyPrefix = 'wa:session:';

  constructor(@Inject('REDIS') private readonly redis: IORedis) {}

  private key(id: string) {
    return `${this.keyPrefix}${id}`;
  }

  async get(id: string): Promise<Session> {
    try {
      const raw = await this.redis.get(this.key(id));
      if (!raw) {
        const fresh: Session = {
          flow: 'menu',
          data: {},
          updatedAt: Date.now(),
        };
        await this.redis.set(
          this.key(id),
          JSON.stringify(fresh),
          'EX',
          this.ttlSeconds,
        );
        return fresh;
      }
      const parsed = JSON.parse(raw) as Session;
      // refresh TTL
      await this.redis.expire(this.key(id), this.ttlSeconds);
      return parsed;
    } catch (e) {
      this.logger.error(
        'Redis get session failed; falling back to fresh',
        e as any,
      );
      return { flow: 'menu', data: {}, updatedAt: Date.now() };
    }
  }

  async set(id: string, patch: Partial<Session>) {
    const cur = await this.get(id);
    const next: Session = {
      ...cur,
      ...patch,
      data: { ...cur.data, ...(patch.data || {}) },
      updatedAt: Date.now(),
    };
    await this.redis.set(
      this.key(id),
      JSON.stringify(next),
      'EX',
      this.ttlSeconds,
    );
    return next;
  }

  async clear(id: string) {
    await this.redis.del(this.key(id));
  }
}
