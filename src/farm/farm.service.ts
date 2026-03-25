import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import {
  UpsertFarmProfileDto,
  FarmProfileResponseDto,
  CreatePlotDto,
  UpdatePlotDto,
  PlotResponseDto,
  CreateHarvestLogDto,
  UpdateHarvestLogDto,
  HarvestLogQueryDto,
  HarvestLogResponseDto,
  CreatePackingRecordDto,
  UpdatePackingRecordDto,
  PackingRecordResponseDto,
  CreateFarmInputDto,
  UpdateFarmInputDto,
  FarmInputResponseDto,
  CreateCropSeasonDto,
  UpdateCropSeasonDto,
  CropSeasonResponseDto,
} from './dto';

@Injectable()
export class FarmService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ─── Farm Profile ─────────────────────────────────────────────────────────

  async getFarmProfile(orgId: string): Promise<FarmProfileResponseDto | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('farm_profiles')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async upsertFarmProfile(
    orgId: string,
    dto: UpsertFarmProfileDto,
  ): Promise<FarmProfileResponseDto> {
    const client = this.supabaseService.getClient();

    const payload = {
      org_id: orgId,
      ...dto,
      certifications: dto.certifications ?? [],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('farm_profiles')
      .upsert(payload, { onConflict: 'org_id' })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Farm Plots ───────────────────────────────────────────────────────────

  async getPlots(orgId: string): Promise<PlotResponseDto[]> {
    const client = this.supabaseService.getClient();

    // Ensure farm profile exists
    const profile = await this.getFarmProfile(orgId);
    if (!profile) return [];

    const { data, error } = await client
      .from('farm_plots')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createPlot(orgId: string, dto: CreatePlotDto): Promise<PlotResponseDto> {
    const client = this.supabaseService.getClient();

    // Ensure farm profile exists before adding plots
    let profile = await this.getFarmProfile(orgId);
    if (!profile) {
      profile = await this.upsertFarmProfile(orgId, {});
    }

    const { data, error } = await client
      .from('farm_plots')
      .insert({
        farm_profile_id: profile.id,
        org_id: orgId,
        ...dto,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updatePlot(
    orgId: string,
    plotId: string,
    dto: UpdatePlotDto,
  ): Promise<PlotResponseDto> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('farm_plots')
      .update(dto)
      .eq('id', plotId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Plot not found');
    return data;
  }

  async deletePlot(orgId: string, plotId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('farm_plots')
      .delete()
      .eq('id', plotId)
      .eq('org_id', orgId);

    if (error) throw new BadRequestException(error.message);
  }

  // ─── Harvest Logs ─────────────────────────────────────────────────────────

  async getHarvestLogs(
    orgId: string,
    query: HarvestLogQueryDto,
  ): Promise<{ data: HarvestLogResponseDto[]; total: number }> {
    const client = this.supabaseService.getClient();
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    let q = client
      .from('harvest_logs')
      .select('*, farm_plots(id, name)', { count: 'exact' })
      .eq('seller_org_id', orgId)
      .order('harvest_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.crop) q = q.ilike('crop', `%${query.crop}%`);
    if (query.plot_id) q = q.eq('plot_id', query.plot_id);
    if (query.from) q = q.gte('harvest_date', query.from);
    if (query.to) q = q.lte('harvest_date', query.to);

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    return {
      data: (data ?? []).map(this.mapHarvestLog),
      total: count ?? 0,
    };
  }

  async getHarvestLogById(
    orgId: string,
    logId: string,
  ): Promise<HarvestLogResponseDto> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('harvest_logs')
      .select('*, farm_plots(id, name)')
      .eq('id', logId)
      .eq('seller_org_id', orgId)
      .single();

    if (error || !data) throw new NotFoundException('Harvest log not found');
    return this.mapHarvestLog(data);
  }

  async createHarvestLog(
    orgId: string,
    userId: string,
    dto: CreateHarvestLogDto,
  ): Promise<HarvestLogResponseDto> {
    const client = this.supabaseService.getClient();

    // Verify plot belongs to this org (if provided)
    if (dto.plot_id) {
      const { data: plot } = await client
        .from('farm_plots')
        .select('id')
        .eq('id', dto.plot_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!plot) throw new BadRequestException('Plot not found or does not belong to your farm');
    }

    const lotCode = await this.generateTlcCode(orgId, dto.crop, dto.harvest_date);

    const { data, error } = await client
      .from('harvest_logs')
      .insert({
        seller_org_id: orgId,
        plot_id: dto.plot_id ?? null,
        crop: dto.crop,
        variety: dto.variety ?? null,
        harvest_date: dto.harvest_date,
        quantity_harvested: dto.quantity_harvested ?? null,
        unit: dto.unit ?? null,
        quality_notes: dto.quality_notes ?? null,
        lot_code: lotCode,
        responsible_party: userId,
      })
      .select('*, farm_plots(id, name)')
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapHarvestLog(data);
  }

  async updateHarvestLog(
    orgId: string,
    logId: string,
    dto: UpdateHarvestLogDto,
  ): Promise<HarvestLogResponseDto> {
    const client = this.supabaseService.getClient();

    // Verify plot belongs to this org (if changing)
    if (dto.plot_id) {
      const { data: plot } = await client
        .from('farm_plots')
        .select('id')
        .eq('id', dto.plot_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!plot) throw new BadRequestException('Plot not found or does not belong to your farm');
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.crop !== undefined) updatePayload.crop = dto.crop;
    if (dto.variety !== undefined) updatePayload.variety = dto.variety;
    if (dto.harvest_date !== undefined) updatePayload.harvest_date = dto.harvest_date;
    if (dto.quantity_harvested !== undefined) updatePayload.quantity_harvested = dto.quantity_harvested;
    if (dto.unit !== undefined) updatePayload.unit = dto.unit;
    if (dto.quality_notes !== undefined) updatePayload.quality_notes = dto.quality_notes;
    if (dto.plot_id !== undefined) updatePayload.plot_id = dto.plot_id;

    const { data, error } = await client
      .from('harvest_logs')
      .update(updatePayload)
      .eq('id', logId)
      .eq('seller_org_id', orgId)
      .select('*, farm_plots(id, name)')
      .single();

    if (error || !data) throw new NotFoundException('Harvest log not found');
    return this.mapHarvestLog(data);
  }

  // ─── Packing Records ──────────────────────────────────────────────────────

  async getPackingRecords(
    orgId: string,
    harvestLogId: string,
  ): Promise<PackingRecordResponseDto[]> {
    const client = this.supabaseService.getClient();

    // Verify harvest log belongs to this org
    const { data: log } = await client
      .from('harvest_logs')
      .select('id')
      .eq('id', harvestLogId)
      .eq('seller_org_id', orgId)
      .maybeSingle();
    if (!log) throw new NotFoundException('Harvest log not found');

    const { data, error } = await client
      .from('packing_records')
      .select('*')
      .eq('harvest_log_id', harvestLogId)
      .eq('seller_org_id', orgId)
      .order('packing_date', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createPackingRecord(
    orgId: string,
    userId: string,
    harvestLogId: string,
    dto: CreatePackingRecordDto,
  ): Promise<PackingRecordResponseDto> {
    const client = this.supabaseService.getClient();

    // Verify harvest log belongs to this org
    const { data: log } = await client
      .from('harvest_logs')
      .select('id')
      .eq('id', harvestLogId)
      .eq('seller_org_id', orgId)
      .maybeSingle();
    if (!log) throw new NotFoundException('Harvest log not found');

    const { data, error } = await client
      .from('packing_records')
      .insert({
        harvest_log_id: harvestLogId,
        seller_org_id: orgId,
        responsible_party: userId,
        packing_facility_country: dto.packing_facility_country ?? 'GD',
        ...dto,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updatePackingRecord(
    orgId: string,
    recordId: string,
    dto: UpdatePackingRecordDto,
  ): Promise<PackingRecordResponseDto> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('packing_records')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', recordId)
      .eq('seller_org_id', orgId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Packing record not found');
    return data;
  }

  // ─── Chain of Custody (CTE timeline) ──────────────────────────────────────

  async getChainOfCustody(orgId: string, logId: string): Promise<{
    lot_code: string;
    harvest: Record<string, unknown>;
    packing: PackingRecordResponseDto[];
    shipping: unknown[];
    receiving: unknown | null;
  }> {
    const client = this.supabaseService.getClient();

    // 1. Fetch harvest log
    const harvestLog = await this.getHarvestLogById(orgId, logId);

    // 2. Fetch packing records
    const { data: packingRecords } = await client
      .from('packing_records')
      .select('*')
      .eq('harvest_log_id', logId)
      .eq('seller_org_id', orgId)
      .order('packing_date', { ascending: true });

    // 3. Fetch shipping events (order items with this lot code)
    const { data: orderItems } = await client
      .from('order_items')
      .select(`
        id, lot_code, quantity, unit_price,
        orders!inner(id, order_number, status, shipped_at, tracking_number, shipping_method,
          organizations!seller_org_id(name),
          buyer_org:organizations!buyer_org_id(name)
        )
      `)
      .eq('lot_code', harvestLog.lot_code);

    const shipping = (orderItems ?? []).map((item: any) => ({
      event: 'shipping',
      order_item_id: item.id,
      order_id: item.orders?.id,
      order_number: item.orders?.order_number,
      status: item.orders?.status,
      shipped_at: item.orders?.shipped_at,
      tracking_number: item.orders?.tracking_number,
      shipping_method: item.orders?.shipping_method,
      quantity: item.quantity,
      buyer_name: item.orders?.buyer_org?.name,
    }));

    // 4. Fetch receiving confirmations (for orders that include this lot code)
    const orderIds = [...new Set((orderItems ?? []).map((i: any) => i.orders?.id).filter(Boolean))];
    let receiving = null;
    if (orderIds.length > 0) {
      const { data: rcRows } = await client
        .from('receiving_confirmations')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
        .limit(1);
      receiving = rcRows?.[0] ?? null;
    }

    return {
      lot_code: harvestLog.lot_code,
      harvest: {
        event: 'harvest',
        id: harvestLog.id,
        crop: harvestLog.crop,
        variety: harvestLog.variety,
        harvest_date: harvestLog.harvest_date,
        quantity_harvested: harvestLog.quantity_harvested,
        unit: harvestLog.unit,
        plot_name: harvestLog.plot?.name ?? null,
        quality_notes: harvestLog.quality_notes,
        responsible_party: harvestLog.responsible_party,
        created_at: harvestLog.created_at,
      },
      packing: packingRecords ?? [],
      shipping,
      receiving,
    };
  }

  // ─── FSMA 204 CSV Export ───────────────────────────────────────────────────

  async exportFsmaCsv(
    orgId: string,
    from?: string,
    to?: string,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    // Get farm profile for location data
    const profile = await this.getFarmProfile(orgId);
    const farmCountry = profile?.country ?? 'GD';
    const farmParish = profile?.parish ?? '';

    // Fetch harvest logs in range
    let q = client
      .from('harvest_logs')
      .select('*, farm_plots(name, gps_lat, gps_lng), organizations!seller_org_id(name, business_name)')
      .eq('seller_org_id', orgId)
      .order('harvest_date', { ascending: false });
    if (from) q = q.gte('harvest_date', from);
    if (to)   q = q.lte('harvest_date', to);

    const { data: logs, error } = await q;
    if (error) throw new BadRequestException(error.message);

    // Fetch packing records for these logs
    const logIds = (logs ?? []).map((l) => l.id);
    let packingRows: any[] = [];
    if (logIds.length > 0) {
      const { data: pr } = await client
        .from('packing_records')
        .select('*')
        .in('harvest_log_id', logIds);
      packingRows = pr ?? [];
    }

    // Build CSV — FDA Electronic Sortable Spreadsheet (ESS) format columns
    const headers = [
      'TLC (Traceability Lot Code)',
      'CTE Type',
      'Date',
      'Traceability Food (Commodity)',
      'Variety',
      'Quantity',
      'Unit',
      'Location Name',
      'Location Address',
      'Location Country',
      'GPS Latitude',
      'GPS Longitude',
      'Reference Document Type',
      'Reference Document Number',
      'Notes',
    ];

    const rows: string[][] = [];

    for (const log of logs ?? []) {
      const org = log.organizations as any;
      const plot = log.farm_plots as any;
      const farmName = org?.business_name ?? org?.name ?? '';
      const gpsLat = plot?.gps_lat ?? '';
      const gpsLng = plot?.gps_lng ?? '';
      const location = plot?.name ? `${farmParish} — ${plot.name}` : farmParish;

      // Harvest CTE row
      rows.push([
        log.lot_code,
        'Harvesting',
        log.harvest_date,
        log.crop,
        log.variety ?? '',
        String(log.quantity_harvested ?? ''),
        log.unit ?? '',
        farmName,
        location,
        farmCountry,
        String(gpsLat),
        String(gpsLng),
        'Harvest Log',
        log.id,
        log.quality_notes ?? '',
      ]);

      // Packing CTE rows for this log
      for (const pr of packingRows.filter((p) => p.harvest_log_id === log.id)) {
        rows.push([
          log.lot_code,
          'Packing',
          pr.packing_date,
          log.crop,
          log.variety ?? '',
          String(pr.quantity_packed ?? ''),
          pr.unit ?? '',
          pr.packing_facility_name,
          pr.packing_facility_address ?? '',
          pr.packing_facility_country,
          '',
          '',
          pr.bill_of_lading ? 'Bill of Lading' : 'Packing Record',
          pr.bill_of_lading ?? pr.id,
          pr.notes ?? '',
        ]);
      }
    }

    // Escape CSV values
    const escape = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const csv = [
      headers.map(escape).join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\r\n');

    return csv;
  }

  // ─── Public Lot Code Lookup (no auth) ─────────────────────────────────────

  async getLotCodePublic(lotCode: string): Promise<{
    lot_code: string;
    crop: string;
    variety: string | null;
    harvest_date: string;
    quantity_harvested: number | null;
    unit: string | null;
    quality_notes: string | null;
    plot_name: string | null;
    farm: {
      parish: string | null;
      country: string;
      primary_crops: string[] | null;
      certifications: unknown[];
    } | null;
    seller: {
      name: string;
      business_name: string | null;
    } | null;
  }> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('harvest_logs')
      .select(`
        lot_code, crop, variety, harvest_date,
        quantity_harvested, unit, quality_notes,
        farm_plots(name),
        organizations!seller_org_id(
          name, business_name,
          farm_profiles(parish, country, primary_crops, certifications)
        )
      `)
      .eq('lot_code', lotCode)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Lot code ${lotCode} not found`);

    const org = data.organizations as any;
    const farmProfile = org?.farm_profiles?.[0] ?? org?.farm_profiles ?? null;

    return {
      lot_code: data.lot_code,
      crop: data.crop,
      variety: data.variety,
      harvest_date: data.harvest_date,
      quantity_harvested: data.quantity_harvested,
      unit: data.unit,
      quality_notes: data.quality_notes,
      plot_name: (data.farm_plots as any)?.name ?? null,
      farm: farmProfile
        ? {
            parish: farmProfile.parish,
            country: farmProfile.country,
            primary_crops: farmProfile.primary_crops,
            certifications: farmProfile.certifications ?? [],
          }
        : null,
      seller: org
        ? { name: org.name, business_name: org.business_name }
        : null,
    };
  }

  // ─── Used by SellersService to assign lot codes at order acceptance ────────

  async verifyLotCodeOwnership(
    orgId: string,
    lotCode: string,
  ): Promise<string | null> {
    const client = this.supabaseService.getClient();
    const { data } = await client
      .from('harvest_logs')
      .select('id')
      .eq('lot_code', lotCode)
      .eq('seller_org_id', orgId)
      .maybeSingle();
    return data?.id ?? null;
  }

  // ─── Farm Inputs ──────────────────────────────────────────────────────────

  async getFarmInputs(
    orgId: string,
    plotId?: string,
  ): Promise<FarmInputResponseDto[]> {
    const client = this.supabaseService.getClient();
    let q = client
      .from('farm_inputs')
      .select('*, farm_plots(name)')
      .eq('org_id', orgId)
      .order('application_date', { ascending: false });

    if (plotId) q = q.eq('plot_id', plotId);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    const today = new Date();
    return (data ?? []).map((row: any) => {
      const safeDate = new Date(row.application_date);
      safeDate.setDate(safeDate.getDate() + (row.withdrawal_period_days ?? 0));
      return {
        ...row,
        plot_name: row.farm_plots?.name ?? null,
        safe_to_harvest_after: safeDate.toISOString().slice(0, 10),
        is_within_withdrawal: today < safeDate,
      };
    });
  }

  async createFarmInput(
    orgId: string,
    userId: string,
    dto: CreateFarmInputDto,
  ): Promise<FarmInputResponseDto> {
    const client = this.supabaseService.getClient();

    if (dto.plot_id) {
      const { data: plot } = await client
        .from('farm_plots')
        .select('id')
        .eq('id', dto.plot_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!plot) throw new BadRequestException('Plot not found');
    }

    const { data, error } = await client
      .from('farm_inputs')
      .insert({ org_id: orgId, applied_by: userId, withdrawal_period_days: 0, ...dto })
      .select('*, farm_plots(name)')
      .single();

    if (error) throw new BadRequestException(error.message);

    const safeDate = new Date(data.application_date);
    safeDate.setDate(safeDate.getDate() + (data.withdrawal_period_days ?? 0));
    return {
      ...data,
      plot_name: (data as any).farm_plots?.name ?? null,
      safe_to_harvest_after: safeDate.toISOString().slice(0, 10),
      is_within_withdrawal: new Date() < safeDate,
    };
  }

  async updateFarmInput(
    orgId: string,
    inputId: string,
    dto: UpdateFarmInputDto,
  ): Promise<FarmInputResponseDto> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('farm_inputs')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', inputId)
      .eq('org_id', orgId)
      .select('*, farm_plots(name)')
      .single();

    if (error || !data) throw new NotFoundException('Farm input not found');

    const safeDate = new Date(data.application_date);
    safeDate.setDate(safeDate.getDate() + (data.withdrawal_period_days ?? 0));
    return {
      ...data,
      plot_name: (data as any).farm_plots?.name ?? null,
      safe_to_harvest_after: safeDate.toISOString().slice(0, 10),
      is_within_withdrawal: new Date() < safeDate,
    };
  }

  async deleteFarmInput(orgId: string, inputId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('farm_inputs')
      .delete()
      .eq('id', inputId)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  // Returns inputs whose withdrawal period is still active at the given harvest date
  async getWithdrawalWarnings(
    orgId: string,
    harvestDate: string,
    plotId?: string,
  ): Promise<FarmInputResponseDto[]> {
    const all = await this.getFarmInputs(orgId, plotId);
    return all.filter((i) => {
      // safe_to_harvest_after > harvestDate means still in withdrawal
      return i.safe_to_harvest_after > harvestDate;
    });
  }

  // ─── Crop Seasons ──────────────────────────────────────────────────────────

  async getCropSeasons(orgId: string): Promise<CropSeasonResponseDto[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('crop_seasons')
      .select('*')
      .eq('org_id', orgId)
      .order('crop', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async upsertCropSeason(
    orgId: string,
    dto: CreateCropSeasonDto,
  ): Promise<CropSeasonResponseDto> {
    const client = this.supabaseService.getClient();
    const payload = {
      org_id: orgId,
      variety: dto.variety ?? null,
      updated_at: new Date().toISOString(),
      ...dto,
    };

    const { data, error } = await client
      .from('crop_seasons')
      .upsert(payload, { onConflict: 'org_id,crop,variety' })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCropSeason(
    orgId: string,
    seasonId: string,
    dto: UpdateCropSeasonDto,
  ): Promise<CropSeasonResponseDto> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('crop_seasons')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', seasonId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Crop season not found');
    return data;
  }

  async deleteCropSeason(orgId: string, seasonId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('crop_seasons')
      .delete()
      .eq('id', seasonId)
      .eq('org_id', orgId);
    if (error) throw new BadRequestException(error.message);
  }

  // ─── Price Benchmark ────────────────────────────────────────────────────────

  async getPriceBenchmark(orgId: string): Promise<Array<{
    crop: string;
    your_avg_price: number | null;
    market_avg: number | null;
    market_min: number | null;
    market_max: number | null;
    position: string;
    sample_size: number;
  }>> {
    const client = this.supabaseService.getClient();

    // Get seller's own products with prices
    const { data: myProducts } = await client
      .from('products')
      .select('name, price_per_unit, unit_of_measurement')
      .eq('org_id', orgId)
      .eq('is_active', true);

    // Get all active products for market benchmarks
    const { data: allProducts } = await client
      .from('products')
      .select('name, price_per_unit, org_id')
      .eq('is_active', true)
      .not('price_per_unit', 'is', null);

    const normalize = (name: string) =>
      name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ')[0];

    // Group market prices by normalized crop name
    const marketByNorm = new Map<string, number[]>();
    for (const p of allProducts ?? []) {
      const norm = normalize(p.name);
      if (!marketByNorm.has(norm)) marketByNorm.set(norm, []);
      marketByNorm.get(norm)!.push(Number(p.price_per_unit));
    }

    // Group my prices by normalized crop name
    const myByNorm = new Map<string, number[]>();
    for (const p of myProducts ?? []) {
      const norm = normalize(p.name);
      if (!myByNorm.has(norm)) myByNorm.set(norm, []);
      myByNorm.get(norm)!.push(Number(p.price_per_unit));
    }

    const results: ReturnType<typeof this.getPriceBenchmark> extends Promise<infer T> ? T : never = [];

    for (const [norm, myPrices] of myByNorm) {
      const myAvg = myPrices.reduce((a, b) => a + b, 0) / myPrices.length;
      const mkt = marketByNorm.get(norm) ?? [];
      const mktAvg = mkt.length ? mkt.reduce((a, b) => a + b, 0) / mkt.length : null;
      const mktMin = mkt.length ? Math.min(...mkt) : null;
      const mktMax = mkt.length ? Math.max(...mkt) : null;

      let position = 'no_data';
      if (mktAvg !== null) {
        const diff = ((myAvg - mktAvg) / mktAvg) * 100;
        position = diff < -5 ? 'below' : diff > 5 ? 'above' : 'at';
      }

      results.push({
        crop: norm.charAt(0).toUpperCase() + norm.slice(1),
        your_avg_price: Math.round(myAvg * 100) / 100,
        market_avg: mktAvg !== null ? Math.round(mktAvg * 100) / 100 : null,
        market_min: mktMin !== null ? Math.round(mktMin * 100) / 100 : null,
        market_max: mktMax !== null ? Math.round(mktMax * 100) / 100 : null,
        position,
        sample_size: mkt.length,
      });
    }

    return results.sort((a, b) => a.crop.localeCompare(b.crop));
  }

  // ─── Reliability Score ─────────────────────────────────────────────────────

  async getReliabilityScore(orgId: string): Promise<{
    acceptance_rate: number;
    on_time_rate: number;
    avg_quality_score: number | null;
    completion_rate: number;
    total_orders: number;
    reliability_score: number;
    badge: string;
  }> {
    const client = this.supabaseService.getClient();

    // All seller orders (excluding parent aggregate rows)
    const { data: orders } = await client
      .from('orders')
      .select('id, status, estimated_delivery_date, delivered_at, actual_delivery_date')
      .eq('seller_org_id', orgId)
      .not('status', 'eq', 'cancelled')
      .is('parent_order_id', null);

    const rows = orders ?? [];
    const total = rows.length;

    if (total === 0) {
      return {
        acceptance_rate: 0,
        on_time_rate: 0,
        avg_quality_score: null,
        completion_rate: 0,
        total_orders: 0,
        reliability_score: 0,
        badge: 'Standard',
      };
    }

    // Acceptance rate: orders that didn't get rejected / total
    const rejected = rows.filter((o) => o.status === 'rejected').length;
    const acceptance_rate = Math.round(((total - rejected) / total) * 100);

    // Completion rate: delivered / non-rejected
    const nonRejected = rows.filter((o) => o.status !== 'rejected');
    const delivered = nonRejected.filter((o) => o.status === 'delivered').length;
    const completion_rate = nonRejected.length
      ? Math.round((delivered / nonRejected.length) * 100)
      : 0;

    // On-time rate among delivered
    const deliveredOrders = rows.filter(
      (o) => o.status === 'delivered' && o.estimated_delivery_date,
    );
    const onTime = deliveredOrders.filter((o) => {
      const actual = o.delivered_at || o.actual_delivery_date;
      return actual && actual.slice(0, 10) <= o.estimated_delivery_date;
    }).length;
    const on_time_rate = deliveredOrders.length
      ? Math.round((onTime / deliveredOrders.length) * 100)
      : 100; // default if no estimates set

    // Avg quality score from receiving confirmations
    const deliveredIds = rows.filter((o) => o.status === 'delivered').map((o) => o.id);
    let avg_quality_score: number | null = null;
    if (deliveredIds.length > 0) {
      const { data: confirmations } = await client
        .from('receiving_confirmations')
        .select('overall_condition')
        .in('order_id', deliveredIds)
        .not('overall_condition', 'is', null);

      const scores = (confirmations ?? []).map((c) => Number(c.overall_condition));
      if (scores.length > 0) {
        avg_quality_score =
          Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      }
    }

    // Composite reliability score (weighted)
    const qualityPct = avg_quality_score ? ((avg_quality_score - 1) / 4) * 100 : 75;
    const reliability_score = Math.round(
      acceptance_rate * 0.25 +
        completion_rate * 0.35 +
        on_time_rate * 0.25 +
        qualityPct * 0.15,
    );

    const badge =
      reliability_score >= 90
        ? 'Platinum'
        : reliability_score >= 75
          ? 'Gold'
          : reliability_score >= 55
            ? 'Silver'
            : 'Standard';

    return {
      acceptance_rate,
      on_time_rate,
      completion_rate,
      avg_quality_score,
      total_orders: total,
      reliability_score,
      badge,
    };
  }

  // ─── Compliance Dashboard ──────────────────────────────────────────────────

  async getComplianceDashboard(orgId: string): Promise<{
    fsma: {
      total_harvest_logs: number;
      harvest_logs_with_packing: number;
      shipped_orders: number;
      shipped_with_lot_code: number;
      lot_code_coverage_pct: number;
      delivered_orders: number;
      receiving_confirmations: number;
      receiving_coverage_pct: number;
    };
    certifications: {
      total: number;
      expiring_soon: number;  // within 30 days
      expired: number;
    };
    inputs: {
      total: number;
      active_withdrawal_warnings: number;
    };
    reliability: Awaited<ReturnType<FarmService['getReliabilityScore']>>;
    compliance_score: number;
  }> {
    const client = this.supabaseService.getClient();

    // ── FSMA metrics ──
    const { count: totalLogs } = await client
      .from('harvest_logs')
      .select('id', { count: 'exact', head: true })
      .eq('seller_org_id', orgId);

    const { count: logsWithPacking } = await client
      .from('packing_records')
      .select('harvest_log_id', { count: 'exact', head: true })
      .eq('seller_org_id', orgId);

    const { count: shippedOrders } = await client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_org_id', orgId)
      .in('status', ['shipped', 'delivered'])
      .is('parent_order_id', null);

    // Orders with at least one lot code assigned
    const { data: shippedOrderIds } = await client
      .from('orders')
      .select('id')
      .eq('seller_org_id', orgId)
      .in('status', ['shipped', 'delivered'])
      .is('parent_order_id', null);

    let shippedWithLotCode = 0;
    if ((shippedOrderIds ?? []).length > 0) {
      const ids = shippedOrderIds!.map((o) => o.id);
      const { data: itemsWithLot } = await client
        .from('order_items')
        .select('order_id')
        .in('order_id', ids)
        .not('lot_code', 'is', null);

      shippedWithLotCode = new Set((itemsWithLot ?? []).map((i) => i.order_id)).size;
    }

    const shippedTotal = shippedOrders ?? 0;
    const lotCodePct = shippedTotal > 0
      ? Math.round((shippedWithLotCode / shippedTotal) * 100)
      : 100;

    const { count: deliveredOrders } = await client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_org_id', orgId)
      .eq('status', 'delivered')
      .is('parent_order_id', null);

    const { count: receivingCount } = await client
      .from('receiving_confirmations')
      .select('id', { count: 'exact', head: true })
      .eq('seller_org_id', orgId);

    const deliveredTotal = deliveredOrders ?? 0;
    const receivingPct = deliveredTotal > 0
      ? Math.round(((receivingCount ?? 0) / deliveredTotal) * 100)
      : 100;

    // ── Certifications ──
    const profile = await this.getFarmProfile(orgId);
    const certs = profile?.certifications ?? [];
    const today = new Date();
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const expiringSoon = certs.filter((c: any) => c.expires && new Date(c.expires) <= in30 && new Date(c.expires) >= today).length;
    const expired = certs.filter((c: any) => c.expires && new Date(c.expires) < today).length;

    // ── Input withdrawal warnings ──
    const inputs = await this.getFarmInputs(orgId);
    const activeWarnings = inputs.filter((i) => i.is_within_withdrawal).length;

    // ── Reliability ──
    const reliability = await this.getReliabilityScore(orgId);

    // ── Compliance score (weighted) ──
    const fsmaScore =
      (lotCodePct * 0.5 + receivingPct * 0.3 + (logsWithPacking ?? 0 > 0 ? 100 : 0) * 0.2);
    const certScore = expired > 0 ? 50 : expiringSoon > 0 ? 80 : 100;
    const compliance_score = Math.round(
      fsmaScore * 0.5 + certScore * 0.2 + reliability.reliability_score * 0.3,
    );

    return {
      fsma: {
        total_harvest_logs: totalLogs ?? 0,
        harvest_logs_with_packing: logsWithPacking ?? 0,
        shipped_orders: shippedTotal,
        shipped_with_lot_code: shippedWithLotCode,
        lot_code_coverage_pct: lotCodePct,
        delivered_orders: deliveredTotal,
        receiving_confirmations: receivingCount ?? 0,
        receiving_coverage_pct: receivingPct,
      },
      certifications: {
        total: certs.length,
        expiring_soon: expiringSoon,
        expired,
      },
      inputs: {
        total: inputs.length,
        active_withdrawal_warnings: activeWarnings,
      },
      reliability,
      compliance_score,
    };
  }

  // ─── TLC Generation ───────────────────────────────────────────────────────

  async generateTlcCode(
    orgId: string,
    crop: string,
    harvestDate: string,
  ): Promise<string> {
    const { orgCode, cc2 } = await this.getOrCreateOrgCode(orgId);
    const cropCode = this.deriveCropCode(crop);
    const dateStr = harvestDate.replace(/-/g, '').slice(0, 8);

    // Loop until unique (Phase 1 volumes are low — no collision risk in practice)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed I, O, 0, 1 (ambiguous)
    const client = this.supabaseService.getClient();

    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)],
      ).join('');
      // Multi-country format: TLC-{CC2}-{ORG4}-{CROP4}-{YYYYMMDD}-{RAND4}
      // Legacy format (no country):  TLC-{ORG4}-{CROP4}-{YYYYMMDD}-{RAND4}
      const candidate = cc2
        ? `TLC-${cc2}-${orgCode}-${cropCode}-${dateStr}-${suffix}`
        : `TLC-${orgCode}-${cropCode}-${dateStr}-${suffix}`;

      const { count } = await client
        .from('harvest_logs')
        .select('id', { count: 'exact', head: true })
        .eq('lot_code', candidate);

      if ((count ?? 0) === 0) return candidate;
    }

    throw new BadRequestException('Could not generate a unique lot code. Please try again.');
  }

  private async getOrCreateOrgCode(orgId: string): Promise<{ orgCode: string; cc2: string | null }> {
    const client = this.supabaseService.getClient();

    const { data: org } = await client
      .from('organizations')
      .select('name, tlc_org_code, country')
      .eq('id', orgId)
      .single();

    if (!org) throw new NotFoundException('Organization not found');

    // cc2 = 2-char country prefix for new multi-country TLC format
    const cc2 = org.country
      ? (org.country as string).toUpperCase().slice(0, 2)
      : null;

    if (org.tlc_org_code) return { orgCode: org.tlc_org_code, cc2 };

    // Derive: take first 4 alpha characters, uppercase
    const derived = (org.name as string)
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
      .padEnd(4, 'X');

    await client
      .from('organizations')
      .update({ tlc_org_code: derived })
      .eq('id', orgId);

    return { orgCode: derived, cc2 };
  }

  private deriveCropCode(crop: string): string {
    return crop
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
      .padEnd(4, 'X');
  }

  private mapHarvestLog(row: any): HarvestLogResponseDto {
    return {
      id: row.id,
      seller_org_id: row.seller_org_id,
      plot_id: row.plot_id,
      plot: row.farm_plots
        ? { id: row.farm_plots.id, name: row.farm_plots.name }
        : null,
      crop: row.crop,
      variety: row.variety,
      harvest_date: row.harvest_date,
      quantity_harvested: row.quantity_harvested,
      unit: row.unit,
      quality_notes: row.quality_notes,
      lot_code: row.lot_code,
      responsible_party: row.responsible_party,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ─── Admin Methods ─────────────────────────────────────────────────────────

  async getAdminFarmOverview(): Promise<{
    total_sellers_with_profiles: number;
    total_harvest_logs: number;
    total_lot_codes_issued: number;
    platform_lot_code_coverage_pct: number;
    active_withdrawal_warnings_count: number;
  }> {
    const client = this.supabaseService.getClient();

    const [
      { count: sellersWithProfiles },
      { count: totalLogs },
      { count: totalItems },
      { count: itemsWithCode },
      { data: warningInputs },
    ] = await Promise.all([
      client.from('farm_profiles').select('id', { count: 'exact', head: true }),
      client.from('harvest_logs').select('id', { count: 'exact', head: true }),
      client.from('order_items').select('id', { count: 'exact', head: true }),
      client.from('order_items').select('id', { count: 'exact', head: true }).not('lot_code', 'is', null),
      client.from('farm_inputs').select('application_date, withdrawal_period_days').gt('withdrawal_period_days', 0),
    ]);

    const coveragePct =
      (totalItems ?? 0) > 0
        ? Math.round(((itemsWithCode ?? 0) / (totalItems ?? 1)) * 100)
        : 0;

    const today = new Date().toISOString().slice(0, 10);
    const activeWarnings = (warningInputs ?? []).filter((i: any) => {
      const safe = new Date(i.application_date);
      safe.setDate(safe.getDate() + (i.withdrawal_period_days ?? 0));
      return safe.toISOString().slice(0, 10) > today;
    }).length;

    return {
      total_sellers_with_profiles: sellersWithProfiles ?? 0,
      total_harvest_logs: totalLogs ?? 0,
      total_lot_codes_issued: totalLogs ?? 0,
      platform_lot_code_coverage_pct: coveragePct,
      active_withdrawal_warnings_count: activeWarnings,
    };
  }

  async getAdminSellerCompliance(query: { page?: number; limit?: number; search?: string }): Promise<{
    data: any[];
    total: number;
  }> {
    const client = this.supabaseService.getClient();
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    let q = client
      .from('organizations')
      .select(
        `id, name, business_name, country,
         farm_profiles(id, certifications),
         harvest_logs(id, harvest_date)`,
        { count: 'exact' },
      )
      .eq('account_type', 'seller')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (query.search) {
      q = q.or(`name.ilike.%${query.search}%,business_name.ilike.%${query.search}%`);
    }

    const { data: orgs, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    const today = new Date();
    const rows = (orgs ?? []).map((org: any) => {
      const profile = Array.isArray(org.farm_profiles) ? org.farm_profiles[0] : org.farm_profiles;
      const logs: any[] = Array.isArray(org.harvest_logs) ? org.harvest_logs : [];

      const certs: any[] = profile?.certifications ?? [];
      const expiredCerts = certs.filter((c) => c.expires && new Date(c.expires) < today).length;
      const certScore = expiredCerts > 0 ? 0 : 20;
      const profileScore = profile ? 40 : 0;
      const logScore = logs.length > 0 ? 40 : 0;
      const complianceScore = profileScore + logScore + certScore;

      const badge =
        complianceScore >= 90 ? 'Platinum'
        : complianceScore >= 75 ? 'Gold'
        : complianceScore >= 50 ? 'Silver'
        : 'Standard';

      const lastHarvest = logs.length > 0
        ? logs.sort((a, b) => new Date(b.harvest_date).getTime() - new Date(a.harvest_date).getTime())[0].harvest_date
        : null;

      return {
        seller_id: org.id,
        seller_name: org.name,
        business_name: org.business_name,
        country: org.country,
        compliance_score: complianceScore,
        compliance_badge: badge,
        total_harvest_logs: logs.length,
        last_harvest_date: lastHarvest,
        has_farm_profile: !!profile,
      };
    });

    return { data: rows, total: count ?? 0 };
  }

  async getAdminHarvestLogs(query: { page?: number; limit?: number; search?: string; seller_id?: string }): Promise<{
    data: any[];
    total: number;
  }> {
    const client = this.supabaseService.getClient();
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    let q = client
      .from('harvest_logs')
      .select(
        `id, lot_code, crop, variety, harvest_date, quantity_harvested, unit, created_at,
         farm_plots(name),
         organizations!seller_org_id(id, name, business_name)`,
        { count: 'exact' },
      )
      .order('harvest_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.seller_id) q = q.eq('seller_org_id', query.seller_id);
    if (query.search) {
      q = q.or(`crop.ilike.%${query.search}%,lot_code.ilike.%${query.search}%`);
    }

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    return {
      data: (data ?? []).map((row: any) => ({
        id: row.id,
        lot_code: row.lot_code,
        crop: row.crop,
        variety: row.variety,
        harvest_date: row.harvest_date,
        quantity_harvested: row.quantity_harvested,
        unit: row.unit,
        seller_name: row.organizations?.business_name ?? row.organizations?.name ?? 'Unknown',
        seller_id: row.organizations?.id ?? '',
        plot_name: row.farm_plots?.name ?? null,
        created_at: row.created_at,
      })),
      total: count ?? 0,
    };
  }
}
