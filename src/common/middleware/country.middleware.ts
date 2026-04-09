import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../../database/supabase.service';
import { DatabaseCountry } from '../../database/types/database.types';

// Extend Express Request to include countryCode
declare module 'express-serve-static-core' {
  interface Request {
    countryCode?: string;
  }
}

@Injectable()
export class CountryMiddleware implements NestMiddleware {
  private countriesCache: DatabaseCountry[] = [];
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private supabaseService: SupabaseService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const headerValue = req.headers['x-country-code'] as string | undefined;

    if (headerValue) {
      const islands = await this.getActiveCountries();
      const valid = islands.some(
        (i) => i.code === headerValue && i.is_active,
      );
      if (valid) {
        req.countryCode = headerValue;
        return next();
      }
    }

    // Fall back to authenticated user's default island
    if (req.user?.id) {
      const { data } = await this.supabaseService
        .getClient()
        .from('users')
        .select('default_country_id')
        .eq('id', req.user.id)
        .single();

      if (data?.default_country_id) {
        req.countryCode = data.default_country_id;
        return next();
      }
    }

    // No island context — req.countryCode stays undefined (global view)
    next();
  }

  private async getActiveCountries(): Promise<DatabaseCountry[]> {
    if (Date.now() < this.cacheExpiry && this.countriesCache.length > 0) {
      return this.countriesCache;
    }

    const { data } = await this.supabaseService
      .getClient()
      .from('countries')
      .select('*')
      .eq('is_active', true);

    this.countriesCache = (data as DatabaseCountry[]) || [];
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    return this.countriesCache;
  }
}
