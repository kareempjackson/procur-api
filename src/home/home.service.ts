import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import {
  HomePageResponseDto,
  HomePageQueryDto,
  RecommendedProductDto,
  PopularSellerDto,
  BestSellingProductDto,
  InDemandProductDto,
  PopularRequestDto,
} from './dto';

@Injectable()
export class HomeService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getHomePageData(query: HomePageQueryDto): Promise<HomePageResponseDto> {
    const supabase = this.supabaseService.getClient();

    // Execute all queries in parallel for better performance
    const [
      recommendedProducts,
      popularSellers,
      bestSellingProducts,
      inDemandProducts,
      popularRequests,
      totalStats,
    ] = await Promise.all([
      this.getRecommendedProducts(
        query.recommended_limit || 8,
        query.category,
        query.user_location,
      ),
      this.getPopularSellers(query.sellers_limit || 6),
      this.getBestSellingProducts(
        query.best_selling_limit || 8,
        query.category,
      ),
      this.getInDemandProducts(query.in_demand_limit || 6, query.category),
      this.getPopularRequests(query.requests_limit || 10, query.category),
      this.getTotalStats(),
    ]);

    return {
      recommended_products: recommendedProducts,
      popular_sellers: popularSellers,
      best_selling_products: bestSellingProducts,
      in_demand_products: inDemandProducts,
      popular_requests: popularRequests,
      total_active_products: totalStats.total_active_products,
      total_verified_sellers: totalStats.total_verified_sellers,
      total_open_requests: totalStats.total_open_requests,
      last_updated: new Date().toISOString(),
    };
  }

  private async getRecommendedProducts(
    limit: number,
    category?: string,
    userLocation?: string,
  ): Promise<RecommendedProductDto[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('products')
      .select(
        `
        id,
        name,
        short_description,
        category,
        base_price,
        sale_price,
        currency,
        is_organic,
        is_local,
        stock_quantity,
        unit_of_measurement,
        seller_org_id,
        organizations!inner(name),
        product_images(image_url, is_primary)
      `,
      )
      .eq('status', 'active')
      .gt('stock_quantity', 0)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: products, error } = await query.limit(limit);

    if (error) {
      throw new Error(`Failed to fetch recommended products: ${error.message}`);
    }

    const rows = products || [];
    const sellerIds = Array.from(
      new Set(
        rows
          .map((p: any) => (p.seller_org_id as string | null) ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let ratingsBySeller: Record<string, { avg: number; count: number }> = {};
    if (sellerIds.length > 0) {
      const { data: reviews } = await supabase
        .from('order_reviews')
        .select('seller_org_id, rating')
        .in('seller_org_id', sellerIds);

      const agg = new Map<string, { sum: number; count: number }>();
      (reviews || []).forEach((r: any) => {
        const sid = r.seller_org_id as string;
        const rating = Number(r.rating) || 0;
        const cur = agg.get(sid) || { sum: 0, count: 0 };
        cur.sum += rating;
        cur.count += 1;
        agg.set(sid, cur);
      });

      ratingsBySeller = Object.fromEntries(
        Array.from(agg.entries()).map(([sid, a]) => [
          sid,
          {
            avg: a.count > 0 ? Number((a.sum / a.count).toFixed(2)) : 0,
            count: a.count,
          },
        ]),
      );
    }

    return rows.map((product: any): RecommendedProductDto => {
      const r = ratingsBySeller[product.seller_org_id as string];
      return {
        id: product.id,
        name: product.name,
        short_description: product.short_description,
        category: product.category,
        current_price: product.sale_price || product.base_price,
        base_price: product.base_price,
        currency: product.currency,
        image_url:
          product.product_images?.find((img: any) => img.is_primary)
            ?.image_url || product.product_images?.[0]?.image_url,
        seller_name: product.organizations?.name,
        seller_id: product.seller_org_id,
        average_rating: r?.avg,
        is_organic: product.is_organic,
        is_local: product.is_local,
        stock_quantity: product.stock_quantity,
        unit_of_measurement: product.unit_of_measurement,
      };
    });
  }

  private async getPopularSellers(limit: number): Promise<PopularSellerDto[]> {
    const supabase = this.supabaseService.getClient();

    // Get sellers with their product counts and recent sales
    const { data: sellers, error } = await supabase
      .from('organizations')
      .select(
        `
        id,
        name,
        description,
        business_type,
        logo_url,
        location,
        farm_verified,
        years_in_business,
        specialties
      `,
      )
      .eq('account_type', 'seller')
      .eq('status', 'active')
      .order('farm_verified', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch popular sellers: ${error.message}`);
    }

    const rows = sellers || [];

    // Preload seller ratings
    const sellerIds = rows.map((s: any) => s.id as string);
    let ratingsBySeller: Record<string, { avg: number; count: number }> = {};
    if (sellerIds.length > 0) {
      const { data: reviews } = await supabase
        .from('order_reviews')
        .select('seller_org_id, rating')
        .in('seller_org_id', sellerIds);

      const agg = new Map<string, { sum: number; count: number }>();
      (reviews || []).forEach((r: any) => {
        const sid = r.seller_org_id as string;
        const rating = Number(r.rating) || 0;
        const cur = agg.get(sid) || { sum: 0, count: 0 };
        cur.sum += rating;
        cur.count += 1;
        agg.set(sid, cur);
      });

      ratingsBySeller = Object.fromEntries(
        Array.from(agg.entries()).map(([sid, a]) => [
          sid,
          {
            avg: a.count > 0 ? Number((a.sum / a.count).toFixed(2)) : 0,
            count: a.count,
          },
        ]),
      );
    }

    // Get additional stats for each seller
    const sellersWithStats = await Promise.all(
      rows.map(async (seller: any) => {
        // Get product count
        const { count: productCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('seller_org_id', seller.id)
          .eq('status', 'active');

        // Get monthly sales (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: salesData } = await supabase
          .from('transactions')
          .select('amount')
          .eq('seller_org_id', seller.id)
          .eq('type', 'sale')
          .eq('status', 'completed')
          .gte('created_at', thirtyDaysAgo.toISOString());

        const monthlySales =
          salesData?.reduce(
            (sum, transaction) => sum + transaction.amount,
            0,
          ) || 0;

        const rating = ratingsBySeller[seller.id as string];

        return {
          id: seller.id,
          name: seller.name,
          description: seller.description,
          business_type: seller.business_type,
          logo_url: seller.logo_url,
          location: seller.location,
          average_rating: rating?.avg,
          review_count: rating?.count ?? 0,
          product_count: productCount || 0,
          monthly_sales: monthlySales,
          years_in_business: seller.years_in_business,
          is_verified: seller.farm_verified,
          specialties: seller.specialties,
        };
      }) || [],
    );

    // Sort by monthly sales and verification status
    return sellersWithStats.sort((a, b) => {
      if (a.is_verified !== b.is_verified) {
        return b.is_verified ? 1 : -1;
      }
      return b.monthly_sales - a.monthly_sales;
    });
  }

  private async getBestSellingProducts(
    limit: number,
    category?: string,
  ): Promise<BestSellingProductDto[]> {
    const supabase = this.supabaseService.getClient();

    // Get products with their sales data from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const baseQuery = supabase
      .from('order_items')
      .select(
        `
        product_id,
        quantity,
        total_price,
        products!inner(
          id,
          name,
          category,
          base_price,
          sale_price,
          currency,
          unit_of_measurement,
          seller_org_id,
          organizations!inner(name),
          product_images(image_url, is_primary)
        ),
        orders!inner(created_at, status)
      `,
      )
      .eq('orders.status', 'delivered')
      .gte('orders.created_at', thirtyDaysAgo.toISOString());

    const { data: orderItems, error } = await baseQuery;

    if (error) {
      throw new Error(
        `Failed to fetch best selling products: ${error.message}`,
      );
    }

    // Group by product and calculate totals
    const productSales = new Map();

    orderItems?.forEach((item: any) => {
      const product = item.products;
      if (category && product.category !== category) return;

      const productId = product.id;
      if (!productSales.has(productId)) {
        productSales.set(productId, {
          id: product.id,
          name: product.name,
          category: product.category,
          current_price: product.sale_price || product.base_price,
          currency: product.currency,
          image_url:
            product.product_images?.find((img: any) => img.is_primary)
              ?.image_url || product.product_images?.[0]?.image_url,
          seller_name: product.organizations?.name,
          seller_id: product.seller_org_id,
          units_sold: 0,
          total_revenue: 0,
          average_rating: undefined, // TODO: Calculate from reviews
          unit_of_measurement: product.unit_of_measurement,
        });
      }

      const productData = productSales.get(productId);
      productData.units_sold += item.quantity;
      productData.total_revenue += item.total_price;
    });

    // Convert to array and sort by units sold
    const bestSelling = Array.from(productSales.values())
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, limit);

    return bestSelling;
  }

  private async getInDemandProducts(
    limit: number,
    category?: string,
  ): Promise<InDemandProductDto[]> {
    const supabase = this.supabaseService.getClient();

    // Get active product requests grouped by product name/category
    let query = supabase
      .from('product_requests')
      .select(
        `
        product_name,
        category,
        quantity,
        unit_of_measurement,
        budget_min,
        budget_max,
        currency,
        created_at
      `,
      )
      .eq('status', 'open')
      .gte('expires_at', new Date().toISOString());

    if (category) {
      query = query.eq('category', category);
    }

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch in-demand products: ${error.message}`);
    }

    // Group by product name and calculate aggregates
    const demandMap = new Map();

    requests?.forEach((request: any) => {
      const key = `${request.product_name}-${request.category}`;
      if (!demandMap.has(key)) {
        demandMap.set(key, {
          product_name: request.product_name,
          category: request.category,
          request_count: 0,
          total_quantity_requested: 0,
          budget_ranges: [],
          units: new Map(),
          recent_requests: 0,
        });
      }

      const demand = demandMap.get(key);
      demand.request_count += 1;
      demand.total_quantity_requested += request.quantity;

      if (request.budget_min != null && request.budget_max != null) {
        demand.budget_ranges.push({
          min: Number(request.budget_min),
          max: Number(request.budget_max),
          currency: request.currency || 'USD',
        });
      }

      // Count unit occurrences
      const unit = request.unit_of_measurement;
      demand.units.set(unit, (demand.units.get(unit) || 0) + 1);

      // Count recent requests (last 7 days)
      const requestDate = new Date(request.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (requestDate >= sevenDaysAgo) {
        demand.recent_requests += 1;
      }
    });

    // Convert to array and calculate final metrics
    const inDemandProducts = Array.from(demandMap.values()).map(
      (demand: any) => {
        // Calculate average budget
        let avgBudgetMin = 0;
        let avgBudgetMax = 0;
        let currency = 'USD';

        if (demand.budget_ranges.length > 0) {
          avgBudgetMin =
            demand.budget_ranges.reduce(
              (sum: number, range: any) => sum + range.min,
              0,
            ) / demand.budget_ranges.length;
          avgBudgetMax =
            demand.budget_ranges.reduce(
              (sum: number, range: any) => sum + range.max,
              0,
            ) / demand.budget_ranges.length;
          currency = demand.budget_ranges[0].currency || 'USD';
        }

        // Find most common unit
        let commonUnit = 'piece';
        let maxCount = 0;
        for (const [unit, count] of demand.units) {
          if (count > maxCount) {
            maxCount = count;
            commonUnit = unit;
          }
        }

        // Calculate trend (simple metric based on recent vs total requests)
        const trendPercentage =
          demand.request_count > 0
            ? (demand.recent_requests / demand.request_count) * 100
            : 0;

        return {
          product_name: demand.product_name,
          category: demand.category,
          request_count: demand.request_count,
          total_quantity_requested: demand.total_quantity_requested,
          avg_budget_min: avgBudgetMin > 0 ? avgBudgetMin : undefined,
          avg_budget_max: avgBudgetMax > 0 ? avgBudgetMax : undefined,
          currency,
          common_unit: commonUnit,
          trend_percentage: trendPercentage,
        };
      },
    );

    // Sort by request count and trend
    return inDemandProducts
      .sort((a, b) => {
        const aScore = a.request_count * (1 + a.trend_percentage / 100);
        const bScore = b.request_count * (1 + b.trend_percentage / 100);
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  private async getPopularRequests(
    limit: number,
    category?: string,
  ): Promise<PopularRequestDto[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('product_requests')
      .select(
        `
        id,
        request_number,
        product_name,
        category,
        quantity,
        unit_of_measurement,
        budget_min,
        budget_max,
        currency,
        date_needed,
        response_count,
        status,
        expires_at,
        created_at,
        buyer_org_id,
        organizations!inner(name)
      `,
      )
      .eq('status', 'open')
      .gte('expires_at', new Date().toISOString())
      .order('response_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: requests, error } = await query.limit(limit);

    if (error) {
      throw new Error(`Failed to fetch popular requests: ${error.message}`);
    }

    return (
      requests?.map((request: any) => {
        const createdDate = new Date(request.created_at);
        const now = new Date();
        const daysSincePosted = Math.floor(
          (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id: request.id,
          request_number: request.request_number,
          product_name: request.product_name,
          category: request.category,
          quantity: request.quantity,
          unit_of_measurement: request.unit_of_measurement,
          budget_range:
            request.budget_min != null && request.budget_max != null
              ? {
                  min: Number(request.budget_min),
                  max: Number(request.budget_max),
                  currency: request.currency,
                }
              : undefined,
          date_needed: request.date_needed,
          response_count: request.response_count,
          buyer_name: request.organizations?.name,
          days_since_posted: daysSincePosted,
          status: request.status,
          expires_at: request.expires_at,
        };
      }) || []
    );
  }

  private async getTotalStats(): Promise<{
    total_active_products: number;
    total_verified_sellers: number;
    total_open_requests: number;
  }> {
    const supabase = this.supabaseService.getClient();

    const [
      { count: activeProducts },
      { count: verifiedSellers },
      { count: openRequests },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'seller')
        .eq('farm_verified', true)
        .eq('status', 'active'),
      supabase
        .from('product_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('expires_at', new Date().toISOString()),
    ]);

    return {
      total_active_products: activeProducts || 0,
      total_verified_sellers: verifiedSellers || 0,
      total_open_requests: openRequests || 0,
    };
  }
}
