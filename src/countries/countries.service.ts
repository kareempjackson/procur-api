import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { DatabaseCountry } from '../database/types/database.types';

@Injectable()
export class CountriesService {
  private cache: DatabaseCountry[] = [];
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private supabaseService: SupabaseService) {}

  async getActiveCountries(): Promise<DatabaseCountry[]> {
    if (Date.now() < this.cacheExpiry && this.cache.length > 0) {
      return this.cache;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('countries')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    this.cache = (data as DatabaseCountry[]) || [];
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  async getAllCountries(): Promise<DatabaseCountry[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('countries')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data as DatabaseCountry[]) || [];
  }

  async getCountryByCode(code: string): Promise<DatabaseCountry> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('countries')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Country '${code}' not found`);
    }

    return data as DatabaseCountry;
  }

  async isValidActiveCountry(code: string): Promise<boolean> {
    const countries = await this.getActiveCountries();
    return countries.some((c) => c.code === code);
  }

  /** Invalidate cache (called after admin creates/updates/deletes countries) */
  invalidateCache(): void {
    this.cacheExpiry = 0;
    this.cache = [];
  }

  async setUserDefaultCountry(
    userId: string,
    countryCode: string,
  ): Promise<void> {
    const country = await this.getCountryByCode(countryCode);
    if (!country.is_active) {
      throw new NotFoundException(`Country '${countryCode}' is not active`);
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({ default_country_id: countryCode })
      .eq('id', userId);

    if (error) throw error;
  }
}
