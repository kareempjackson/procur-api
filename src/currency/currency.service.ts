import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { DatabaseExchangeRate } from '../database/types/database.types';

export interface CurrencyConversion {
  converted: number;
  rate: number;
  from: string;
  to: string;
}

@Injectable()
export class CurrencyService {
  private ratesCache: DatabaseExchangeRate[] = [];
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private supabaseService: SupabaseService) {}

  async convert(
    amount: number,
    from: string,
    to: string,
  ): Promise<CurrencyConversion> {
    if (from === to) {
      return { converted: amount, rate: 1, from, to };
    }

    const rates = await this.getRates();
    const match = rates.find(
      (r) => r.from_currency === from && r.to_currency === to,
    );

    if (!match) {
      // No direct rate — return unconverted with rate 0 to signal unavailable
      return { converted: amount, rate: 0, from, to };
    }

    return {
      converted: Math.round(amount * match.rate * 100) / 100,
      rate: match.rate,
      from,
      to,
    };
  }

  async getRates(): Promise<DatabaseExchangeRate[]> {
    if (Date.now() < this.cacheExpiry && this.ratesCache.length > 0) {
      return this.ratesCache;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('exchange_rates')
      .select('*')
      .order('from_currency');

    if (error) throw error;

    this.ratesCache = (data as DatabaseExchangeRate[]) || [];
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    return this.ratesCache;
  }

  invalidateCache(): void {
    this.cacheExpiry = 0;
    this.ratesCache = [];
  }
}
