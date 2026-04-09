import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { DatabaseTradeRestriction } from '../database/types/database.types';

export interface TradeCheckResult {
  product_id: string;
  product_name: string;
  category: string;
  restriction: 'blocked' | 'requires_cert' | 'warning' | 'allowed';
  cert_type?: string;
  description?: string;
  authority?: string;
}

@Injectable()
export class TradeService {
  constructor(private supabaseService: SupabaseService) {}

  async getRestrictions(
    destIsland: string,
    category?: string,
    originIsland?: string,
  ): Promise<DatabaseTradeRestriction[]> {
    let query = this.supabaseService
      .getClient()
      .from('trade_restrictions')
      .select('*')
      .eq('dest_country', destIsland)
      .eq('is_active', true);

    if (category) {
      query = query.eq('product_category', category);
    }

    if (originIsland) {
      // Match restrictions with this specific origin OR null origin (any origin)
      query = query.or(
        `origin_country.eq.${originIsland},origin_country.is.null`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data as DatabaseTradeRestriction[]) || [];
  }

  /**
   * Check a list of cart items against trade restrictions for a destination island.
   * Returns a result per item indicating if trade is allowed, requires cert, or is blocked.
   */
  async checkCart(
    items: Array<{
      product_id: string;
      product_name: string;
      category: string;
      origin_country: string;
    }>,
    destIsland: string,
  ): Promise<TradeCheckResult[]> {
    // Get all active restrictions for this destination
    const { data: restrictions } = await this.supabaseService
      .getClient()
      .from('trade_restrictions')
      .select('*')
      .eq('dest_country', destIsland)
      .eq('is_active', true);

    const activeRestrictions =
      (restrictions as DatabaseTradeRestriction[]) || [];

    return items.map((item) => {
      // Find matching restriction (most restrictive wins)
      const matches = activeRestrictions.filter(
        (r) =>
          r.product_category === item.category &&
          (r.origin_country === null || r.origin_country === item.origin_country),
      );

      if (matches.length === 0) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          restriction: 'allowed' as const,
        };
      }

      // blocked > requires_cert > warning
      const blocked = matches.find((m) => m.restriction === 'blocked');
      if (blocked) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          restriction: 'blocked' as const,
          description: blocked.description || undefined,
          authority: blocked.authority || undefined,
        };
      }

      const certRequired = matches.find(
        (m) => m.restriction === 'requires_cert',
      );
      if (certRequired) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          restriction: 'requires_cert' as const,
          cert_type: certRequired.cert_type || undefined,
          description: certRequired.description || undefined,
          authority: certRequired.authority || undefined,
        };
      }

      const warning = matches[0];
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        category: item.category,
        restriction: 'warning' as const,
        description: warning.description || undefined,
        authority: warning.authority || undefined,
      };
    });
  }
}
