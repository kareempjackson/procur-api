import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CountriesService } from '../countries/countries.service';
import {
  CountryPulseSignal,
  DatabaseCountryPulseOverride,
  DatabaseCountryPulseSnapshot,
} from '../database/types/database.types';
import {
  COUNTRY_PULSE_SIGNALS,
  CountryPulseResponseDto,
  CreatePulseOverrideDto,
  PulseEntryDto,
  UpdatePulseOverrideDto,
} from './dto/country-pulse.dto';

const PER_SIGNAL_LIMIT = 8;
const SCARCE_STOCK_THRESHOLD = 10;
const SURPLUS_STOCK_THRESHOLD = 200;
const IN_DEMAND_WINDOW_DAYS = 30;
const TRENDING_WINDOW_DAYS = 14;

@Injectable()
export class CountryPulseService {
  private readonly logger = new Logger(CountryPulseService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly countriesService: CountriesService,
  ) {}

  // ==================== Public read ====================

  /**
   * Flat cross-country ticker for the landing-page marquee.
   * Iterates all active, pulse-enabled countries, pulls their top signals
   * (in_demand / scarce / trending — surplus is skipped because "plenty
   * available" is off-brand for a price ticker), hydrates with real
   * product names + prices, and interleaves them round-robin so a single
   * country can't monopolise the ticker.
   */
  async getTicker(): Promise<
    Array<{
      country_code: string;
      country_name: string;
      country_iso: string;
      crop: string;
      price: number | null;
      currency: string | null;
      hot: boolean;
    }>
  > {
    const countries = await this.countriesService.getActiveCountries();
    const client = this.supabaseService.getClient();

    const byCountry = new Map<
      string,
      Array<{
        country_code: string;
        country_name: string;
        country_iso: string;
        crop: string;
        price: number | null;
        currency: string | null;
        hot: boolean;
      }>
    >();

    for (const country of countries) {
      // Ticker has its own independent flag so admins can hide the
      // landing-page section while still contributing to the ticker.
      // Defaults to true when absent.
      const tickerEnabled =
        (country.config as Record<string, unknown> | undefined)
          ?.pulse_ticker_enabled !== false;
      if (!tickerEnabled) continue;

      const { data: snapshots } = await client
        .from('country_pulse_snapshots')
        .select('*')
        .eq('country_id', country.code)
        .in('signal_type', ['in_demand', 'scarce', 'trending'])
        .order('rank', { ascending: true })
        .limit(3);

      const rows = (snapshots as DatabaseCountryPulseSnapshot[]) || [];
      if (rows.length === 0) continue;

      // Hydrate prices from products table
      const productIds = rows
        .map((r) => r.product_id)
        .filter((id): id is string => !!id);
      const productMap = new Map<
        string,
        { name: string; base_price: number; currency: string }
      >();
      if (productIds.length > 0) {
        const { data: products } = await client
          .from('products')
          .select('id, name, base_price, currency')
          .in('id', productIds);
        for (const p of (products as any[]) || []) {
          productMap.set(p.id, p);
        }
      }

      const perCountry = rows.map((r) => {
        const product = r.product_id ? productMap.get(r.product_id) : undefined;
        return {
          country_code: country.code,
          country_name: country.name,
          country_iso: country.country_code,
          crop: product?.name || r.label,
          price: product?.base_price ?? null,
          currency: product?.currency || country.currency || null,
          hot: r.signal_type === 'scarce' || r.signal_type === 'in_demand',
        };
      });

      byCountry.set(country.code, perCountry);
    }

    // Round-robin interleave so the ticker rotates across countries
    // instead of showing all of Grenada, then all of Trinidad, etc.
    const interleaved: Array<{
      country_code: string;
      country_name: string;
      country_iso: string;
      crop: string;
      price: number | null;
      currency: string | null;
      hot: boolean;
    }> = [];
    let idx = 0;
    let anyAtIdx = true;
    while (anyAtIdx) {
      anyAtIdx = false;
      for (const list of byCountry.values()) {
        if (list[idx]) {
          interleaved.push(list[idx]);
          anyAtIdx = true;
        }
      }
      idx++;
    }

    return interleaved;
  }


  async getPulseForCountry(countryCode: string): Promise<CountryPulseResponseDto> {
    const country = await this.countriesService.getCountryByCode(countryCode);

    // Feature flag: controls the landing-page Country Pulse section only.
    // The ticker has its own independent flag (`pulse_ticker_enabled`).
    // `pulse_section_enabled` is the canonical key; `pulse_enabled` is
    // preserved as a legacy fallback for countries toggled before the split.
    const config = country.config as Record<string, unknown> | undefined;
    const sectionEnabled =
      config?.pulse_section_enabled !== undefined
        ? config.pulse_section_enabled !== false
        : config?.pulse_enabled !== false;
    if (!sectionEnabled) {
      return {
        country_id: country.code,
        computed_at: null,
        signals: {
          in_demand: [],
          scarce: [],
          trending: [],
          surplus: [],
        },
      };
    }

    const client = this.supabaseService.getClient();

    const [{ data: snapshots }, { data: overrides }] = await Promise.all([
      client
        .from('country_pulse_snapshots')
        .select('*')
        .eq('country_id', country.code)
        .order('rank', { ascending: true }),
      client
        .from('country_pulse_overrides')
        .select('*')
        .eq('country_id', country.code),
    ]);

    const merged = this.mergeSnapshotsAndOverrides(
      (snapshots as DatabaseCountryPulseSnapshot[]) || [],
      (overrides as DatabaseCountryPulseOverride[]) || [],
    );

    await this.hydrateProductDetails(merged);

    const computedAt =
      (snapshots && snapshots.length > 0
        ? (snapshots[0] as DatabaseCountryPulseSnapshot).computed_at
        : null) || null;

    return {
      country_id: country.code,
      computed_at: computedAt,
      signals: merged,
    };
  }

  private mergeSnapshotsAndOverrides(
    snapshots: DatabaseCountryPulseSnapshot[],
    overrides: DatabaseCountryPulseOverride[],
  ): Record<CountryPulseSignal, PulseEntryDto[]> {
    const now = Date.now();
    const activeOverrides = overrides.filter((o) => {
      if (o.valid_from && new Date(o.valid_from).getTime() > now) return false;
      if (o.valid_until && new Date(o.valid_until).getTime() < now) return false;
      return true;
    });

    const result = {} as Record<CountryPulseSignal, PulseEntryDto[]>;

    for (const signal of COUNTRY_PULSE_SIGNALS) {
      const pinned: PulseEntryDto[] = [];
      const hiddenKeys = new Set<string>();

      for (const o of activeOverrides) {
        if (o.signal_type !== signal) continue;
        if (o.is_hidden) {
          if (o.product_id) hiddenKeys.add(`p:${o.product_id}`);
          if (o.category) hiddenKeys.add(`c:${o.category}`);
          continue;
        }
        if (o.is_pinned) {
          pinned.push(this.overrideToEntry(o));
        }
      }
      pinned.sort((a, b) => a.rank - b.rank);

      const fromSnapshots: PulseEntryDto[] = [];
      for (const s of snapshots) {
        if (s.signal_type !== signal) continue;
        const key = s.product_id
          ? `p:${s.product_id}`
          : s.category
          ? `c:${s.category}`
          : `l:${s.label}`;
        if (hiddenKeys.has(key)) continue;
        fromSnapshots.push(this.snapshotToEntry(s));
      }

      result[signal] = [...pinned, ...fromSnapshots].slice(0, PER_SIGNAL_LIMIT);
    }
    return result;
  }

  private snapshotToEntry(s: DatabaseCountryPulseSnapshot): PulseEntryDto {
    return {
      id: s.id,
      source: 'snapshot',
      signal_type: s.signal_type,
      rank: s.rank,
      label: s.label,
      product_id: s.product_id ?? null,
      category: s.category ?? null,
      score: Number(s.score),
      metrics: s.metrics,
    };
  }

  private overrideToEntry(o: DatabaseCountryPulseOverride): PulseEntryDto {
    return {
      id: o.id,
      source: 'override',
      signal_type: o.signal_type,
      rank: o.rank,
      label: o.label,
      note: o.note ?? null,
      product_id: o.product_id ?? null,
      category: o.category ?? null,
      is_pinned: o.is_pinned,
    };
  }

  private async hydrateProductDetails(
    signals: Record<CountryPulseSignal, PulseEntryDto[]>,
  ): Promise<void> {
    const productIds = new Set<string>();
    for (const key of COUNTRY_PULSE_SIGNALS) {
      for (const e of signals[key]) {
        if (e.product_id) productIds.add(e.product_id);
      }
    }
    if (productIds.size === 0) return;

    const client = this.supabaseService.getClient();
    const { data: products } = await client
      .from('products')
      .select(
        'id, name, base_price, currency, stock_quantity, seller_org_id, organizations!inner(name)',
      )
      .in('id', Array.from(productIds));

    const { data: images } = await client
      .from('product_images')
      .select('product_id, image_url, is_primary, display_order')
      .in('product_id', Array.from(productIds))
      .order('display_order', { ascending: true });

    const productMap = new Map<string, any>();
    for (const p of (products as any[]) || []) productMap.set(p.id, p);

    const imageMap = new Map<string, string>();
    for (const img of (images as any[]) || []) {
      if (!imageMap.has(img.product_id) || img.is_primary) {
        imageMap.set(img.product_id, img.image_url);
      }
    }

    for (const key of COUNTRY_PULSE_SIGNALS) {
      for (const e of signals[key]) {
        if (!e.product_id) continue;
        const p = productMap.get(e.product_id);
        if (!p) continue;
        e.product_name = p.name;
        e.base_price = p.base_price;
        e.currency = p.currency;
        e.stock_quantity = p.stock_quantity;
        e.seller_name = p.organizations?.name ?? null;
        e.product_image_url = imageMap.get(e.product_id) ?? null;
      }
    }
  }

  // ==================== Admin: overrides CRUD ====================

  async listOverrides(countryCode: string): Promise<DatabaseCountryPulseOverride[]> {
    const country = await this.countriesService.getCountryByCode(countryCode);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('country_pulse_overrides')
      .select('*')
      .eq('country_id', country.code)
      .order('signal_type')
      .order('rank');
    if (error) throw error;
    return (data as DatabaseCountryPulseOverride[]) || [];
  }

  async listSnapshots(countryCode: string): Promise<DatabaseCountryPulseSnapshot[]> {
    const country = await this.countriesService.getCountryByCode(countryCode);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('country_pulse_snapshots')
      .select('*')
      .eq('country_id', country.code)
      .order('signal_type')
      .order('rank');
    if (error) throw error;
    return (data as DatabaseCountryPulseSnapshot[]) || [];
  }

  async createOverride(
    countryCode: string,
    input: CreatePulseOverrideDto,
    userId: string,
  ): Promise<DatabaseCountryPulseOverride> {
    const country = await this.countriesService.getCountryByCode(countryCode);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('country_pulse_overrides')
      .insert({
        country_id: country.code,
        signal_type: input.signal_type,
        product_id: input.product_id ?? null,
        category: input.category ?? null,
        label: input.label,
        note: input.note ?? null,
        rank: input.rank ?? 0,
        is_pinned: input.is_pinned ?? false,
        is_hidden: input.is_hidden ?? false,
        valid_from: input.valid_from ?? null,
        valid_until: input.valid_until ?? null,
        created_by: userId,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data as DatabaseCountryPulseOverride;
  }

  async updateOverride(
    id: string,
    input: UpdatePulseOverrideDto,
  ): Promise<DatabaseCountryPulseOverride> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('country_pulse_overrides')
      .update(input as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Override ${id} not found`);
    return data as DatabaseCountryPulseOverride;
  }

  async deleteOverride(id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('country_pulse_overrides')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
  }

  // ==================== Aggregator (recompute) ====================

  async recomputeCountry(countryCode: string): Promise<{ country_id: string; total: number }> {
    const country = await this.countriesService.getCountryByCode(countryCode);
    const client = this.supabaseService.getClient();

    // Fetch products in this country with seller + image
    const { data: products } = await client
      .from('products')
      .select('id, name, category, stock_quantity, base_price, currency, created_at, status')
      .eq('country_id', country.code)
      .eq('status', 'active');

    const productList = (products as any[]) || [];
    const productIds = productList.map((p) => p.id);

    // Orders in the last window (for trending/surplus velocity)
    const trendingSince = new Date(
      Date.now() - TRENDING_WINDOW_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const orderCountsByProduct = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: orderItems } = await client
        .from('order_items')
        .select('product_id, quantity, created_at')
        .in('product_id', productIds)
        .gte('created_at', trendingSince);
      for (const oi of (orderItems as any[]) || []) {
        orderCountsByProduct.set(
          oi.product_id,
          (orderCountsByProduct.get(oi.product_id) || 0) + Number(oi.quantity || 1),
        );
      }
    }

    // Buyer RFQs for "in demand" — filter by buyer org country_id
    const rfqSince = new Date(
      Date.now() - IN_DEMAND_WINDOW_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const { data: rfqs } = await client
      .from('product_requests')
      .select('product_name, category, quantity, created_at, buyer_org_id, organizations!inner(country_id)')
      .eq('organizations.country_id', country.code)
      .gte('created_at', rfqSince)
      .eq('status', 'active');

    const demandByKey = new Map<string, { label: string; category: string | null; count: number; qty: number }>();
    for (const r of (rfqs as any[]) || []) {
      const label: string = (r.product_name || '').trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const bucket = demandByKey.get(key) || {
        label,
        category: r.category || null,
        count: 0,
        qty: 0,
      };
      bucket.count += 1;
      bucket.qty += Number(r.quantity || 0);
      demandByKey.set(key, bucket);
    }

    // ---- Build signal arrays ----

    const inDemand = Array.from(demandByKey.values())
      .sort((a, b) => b.count - a.count || b.qty - a.qty)
      .slice(0, PER_SIGNAL_LIMIT)
      .map((d, idx) => ({
        signal_type: 'in_demand' as const,
        rank: idx,
        label: d.label,
        category: d.category,
        product_id: null as string | null,
        score: d.count,
        metrics: { rfq_count: d.count, requested_qty: d.qty },
      }));

    const scarce = productList
      .filter((p) => Number(p.stock_quantity) <= SCARCE_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity))
      .slice(0, PER_SIGNAL_LIMIT)
      .map((p, idx) => ({
        signal_type: 'scarce' as const,
        rank: idx,
        label: p.name,
        category: p.category,
        product_id: p.id,
        score: SCARCE_STOCK_THRESHOLD - Number(p.stock_quantity),
        metrics: { stock_quantity: Number(p.stock_quantity) },
      }));

    const trendingSinceDate = new Date(
      Date.now() - TRENDING_WINDOW_DAYS * 24 * 3600 * 1000,
    );
    const trending = productList
      .map((p) => {
        const orderCount = orderCountsByProduct.get(p.id) || 0;
        const isNew = new Date(p.created_at) > trendingSinceDate;
        const score = orderCount * 2 + (isNew ? 5 : 0);
        return { p, score, orderCount, isNew };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_SIGNAL_LIMIT)
      .map((x, idx) => ({
        signal_type: 'trending' as const,
        rank: idx,
        label: x.p.name,
        category: x.p.category,
        product_id: x.p.id,
        score: x.score,
        metrics: { order_count: x.orderCount, is_new: x.isNew },
      }));

    const surplus = productList
      .filter(
        (p) =>
          Number(p.stock_quantity) >= SURPLUS_STOCK_THRESHOLD &&
          (orderCountsByProduct.get(p.id) || 0) === 0,
      )
      .sort((a, b) => Number(b.stock_quantity) - Number(a.stock_quantity))
      .slice(0, PER_SIGNAL_LIMIT)
      .map((p, idx) => ({
        signal_type: 'surplus' as const,
        rank: idx,
        label: p.name,
        category: p.category,
        product_id: p.id,
        score: Number(p.stock_quantity),
        metrics: {
          stock_quantity: Number(p.stock_quantity),
          recent_orders: orderCountsByProduct.get(p.id) || 0,
        },
      }));

    const allRows = [...inDemand, ...scarce, ...trending, ...surplus].map((r) => ({
      country_id: country.code,
      signal_type: r.signal_type,
      rank: r.rank,
      label: r.label,
      category: r.category,
      product_id: r.product_id,
      score: r.score,
      metrics: r.metrics,
      computed_at: new Date().toISOString(),
    }));

    // Truncate existing snapshots for this country and insert fresh
    const { error: delErr } = await client
      .from('country_pulse_snapshots')
      .delete()
      .eq('country_id', country.code);
    if (delErr) throw new BadRequestException(delErr.message);

    if (allRows.length > 0) {
      const { error: insErr } = await client
        .from('country_pulse_snapshots')
        .insert(allRows);
      if (insErr) throw new BadRequestException(insErr.message);
    }

    this.logger.log(
      `Country pulse recomputed for ${country.code}: ${allRows.length} entries`,
    );
    return { country_id: country.code, total: allRows.length };
  }

  async recomputeAll(): Promise<{ total: number; countries: number }> {
    const countries = await this.countriesService.getActiveCountries();
    let total = 0;
    for (const c of countries) {
      try {
        const res = await this.recomputeCountry(c.code);
        total += res.total;
      } catch (err) {
        this.logger.error(
          `Failed to recompute pulse for ${c.code}: ${(err as Error).message}`,
        );
      }
    }
    return { total, countries: countries.length };
  }
}
