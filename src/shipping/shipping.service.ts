import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { DatabaseShippingRoute } from '../database/types/database.types';

export interface CreateShippingRouteDto {
  dest_country: string;
  shipping_fee: number;
  currency?: string;
  est_days_min?: number;
  est_days_max?: number;
  notes?: string;
}

export interface UpdateShippingRouteDto {
  shipping_fee?: number;
  est_days_min?: number;
  est_days_max?: number;
  notes?: string;
  is_active?: boolean;
}

export interface ShippingEstimate {
  shipping_fee: number;
  currency: string;
  est_days_min: number;
  est_days_max: number;
  origin_country: string;
  dest_country: string;
  notes?: string;
}

@Injectable()
export class ShippingService {
  constructor(private supabaseService: SupabaseService) {}

  async getSellerRoutes(sellerOrgId: string): Promise<DatabaseShippingRoute[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipping_routes')
      .select('*')
      .eq('seller_org_id', sellerOrgId)
      .order('dest_country');

    if (error) throw error;
    return (data as DatabaseShippingRoute[]) || [];
  }

  async createRoute(
    sellerOrgId: string,
    originIsland: string,
    dto: CreateShippingRouteDto,
  ): Promise<DatabaseShippingRoute> {
    if (originIsland === dto.dest_country) {
      throw new BadRequestException(
        'Origin and destination islands must be different',
      );
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipping_routes')
      .insert({
        seller_org_id: sellerOrgId,
        origin_country: originIsland,
        dest_country: dto.dest_country,
        shipping_fee: dto.shipping_fee,
        currency: dto.currency || 'XCD',
        est_days_min: dto.est_days_min || 3,
        est_days_max: dto.est_days_max || 7,
        notes: dto.notes,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          `Shipping route to ${dto.dest_country} already exists`,
        );
      }
      throw error;
    }

    return data as DatabaseShippingRoute;
  }

  async updateRoute(
    routeId: string,
    sellerOrgId: string,
    dto: UpdateShippingRouteDto,
  ): Promise<DatabaseShippingRoute> {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.shipping_fee !== undefined) patch.shipping_fee = dto.shipping_fee;
    if (dto.est_days_min !== undefined) patch.est_days_min = dto.est_days_min;
    if (dto.est_days_max !== undefined) patch.est_days_max = dto.est_days_max;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipping_routes')
      .update(patch)
      .eq('id', routeId)
      .eq('seller_org_id', sellerOrgId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Shipping route not found');
    }

    return data as DatabaseShippingRoute;
  }

  async deleteRoute(routeId: string, sellerOrgId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('shipping_routes')
      .delete()
      .eq('id', routeId)
      .eq('seller_org_id', sellerOrgId);

    if (error) throw error;
  }

  async getEstimate(
    productId: string,
    buyerIslandCode: string,
  ): Promise<ShippingEstimate | null> {
    // Get product's seller org and island
    const { data: product } = await this.supabaseService
      .getClient()
      .from('products')
      .select('seller_org_id, country_id')
      .eq('id', productId)
      .single();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Same island — no cross-island shipping
    if (product.country_id === buyerIslandCode) {
      return null;
    }

    // Find active shipping route
    const { data: route } = await this.supabaseService
      .getClient()
      .from('shipping_routes')
      .select('*')
      .eq('seller_org_id', product.seller_org_id)
      .eq('origin_country', product.country_id)
      .eq('dest_country', buyerIslandCode)
      .eq('is_active', true)
      .single();

    if (!route) {
      return null; // Seller doesn't ship to this island
    }

    return {
      shipping_fee: route.shipping_fee,
      currency: route.currency,
      est_days_min: route.est_days_min,
      est_days_max: route.est_days_max,
      origin_country: route.origin_country,
      dest_country: route.dest_country,
      notes: route.notes,
    };
  }

  /**
   * Find the shipping route between a seller and a destination island.
   * Used during checkout to determine cross-island shipping cost.
   */
  async findRoute(
    sellerOrgId: string,
    originIsland: string,
    destIsland: string,
  ): Promise<DatabaseShippingRoute | null> {
    const { data } = await this.supabaseService
      .getClient()
      .from('shipping_routes')
      .select('*')
      .eq('seller_org_id', sellerOrgId)
      .eq('origin_country', originIsland)
      .eq('dest_country', destIsland)
      .eq('is_active', true)
      .single();

    return (data as DatabaseShippingRoute) || null;
  }

  // ── Shipping documents ─────────────────────────────────────────────────────

  async getDocuments(sellerOrgId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipping_documents')
      .select('*')
      .eq('seller_org_id', sellerOrgId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getDocumentUploadUrl(
    sellerOrgId: string,
    filename: string,
  ): Promise<{
    signedUrl: string;
    token: string;
    publicUrl: string;
    path: string;
  }> {
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.toLowerCase() || 'pdf'
      : 'pdf';

    const bucket = 'procur-priv';
    const objectPath = `shipping-docs/${sellerOrgId}/${crypto.randomUUID()}.${ext}`;

    await this.supabaseService.ensureBucketExists(bucket, false);
    const signed = await this.supabaseService.createSignedUploadUrl(
      bucket,
      objectPath,
    );
    const publicUrl = this.supabaseService.getPublicUrl(bucket, objectPath);

    return {
      signedUrl: signed.signedUrl,
      token: signed.token,
      publicUrl,
      path: objectPath,
    };
  }

  async createDocument(
    sellerOrgId: string,
    input: {
      name: string;
      doc_type: string;
      file_url: string;
      file_path: string;
      file_size?: number;
      mime_type?: string;
    },
  ) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipping_documents')
      .insert({
        seller_org_id: sellerOrgId,
        name: input.name,
        doc_type: input.doc_type,
        file_url: input.file_url,
        file_path: input.file_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteDocument(docId: string, sellerOrgId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('shipping_documents')
      .delete()
      .eq('id', docId)
      .eq('seller_org_id', sellerOrgId);

    if (error) throw new BadRequestException(error.message);
  }
}
