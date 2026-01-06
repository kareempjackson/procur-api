import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../database/supabase.service';
import { AdminOrgQueryDto } from './dto/admin-org-query.dto';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import {
  DatabaseOrderItem,
  DatabaseOrderTimeline,
} from '../database/types/database.types';
import { OrderClearingService } from '../finance/order-clearing.service';
import { TemplateService } from '../whatsapp/templates/template.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import {
  AdminDriverResponseDto,
  CreateDriverDto,
  UpdateDriverDto,
} from './dto/driver.dto';
import {
  AdminUserResponseDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from './dto/admin-user.dto';
import { UserRole } from '../common/enums/user-role.enum';
import {
  AdminProductResponseDto,
  AdminProductQueryDto,
  CreateAdminProductDto,
  UpdateAdminProductDto,
  ProductCategory,
  ProductUnit,
} from './dto/admin-product.dto';
import { OrganizationStatus } from '../common/enums/organization-status.enum';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { FarmersIdUploadUrlResponseDto } from '../users/dto/farmers-id-upload.dto';
import { LogoUploadUrlResponseDto } from '../users/dto/logo-upload.dto';
import {
  CreateFarmVisitRequestDto,
  CreateProductDto,
  ProductQueryDto,
  ProductResponseDto,
  ProductStatus,
  UpdateProductDto,
} from '../sellers/dto';
import { OrderReviewDto } from '../buyers/dto/order.dto';
import { SellersService } from '../sellers/sellers.service';
import { AdminCreateOfflineOrderDto } from './dto/admin-offline-order.dto';

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  businessName: string | null;
  accountType: string;
  businessType: string | null;
  country: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  adminEmail: string | null;
  adminFullname: string | null;
  address: string | null;
  phoneNumber: string | null;
  logoUrl: string | null;
  headerImageUrl: string | null;
  farmersId: string | null;
  farmersIdVerified: boolean;
  farmVerified: boolean;
  isHiddenFromMarketplace: boolean;
}

export interface AdminBuyerMemberSummary {
  id: string;
  email: string;
  fullname: string;
  isActive: boolean;
  joinedAt: string;
  roleName: string | null;
  roleDisplayName: string | null;
  isAdmin: boolean;
  lastLogin: string | null;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  buyerOrgId?: string;
  buyerOrgName?: string | null;
  sellerOrgId?: string;
  sellerOrgName?: string | null;
  driverUserId?: string | null;
  driverName?: string | null;
  assignedDriverAt?: string | null;
}

export interface AdminDashboardSummary {
  totalBuyers: number;
  totalSellers: number;
  completedOrders: number;
  currentOrders: number;
  totalVolume: number;
  totalPlatformFees: number;
  totalShippingFees: number;
  currency: string;
}

export interface AdminDashboardCharts {
  transactionsOverTime: { date: string; count: number }[];
  revenueOverTime: { date: string; amount: number }[];
  popularItems: { name: string; quantity: number; totalAmount: number }[];
  currency: string;
}

export interface AdminAuditLogItem {
  id: string;
  userId: string | null;
  organizationId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  actorAccountType: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PlatformFeesSettings {
  platformFeePercent: number;
  deliveryFlatFee: number;
  buyerDeliveryShare: number;
  sellerDeliveryShare: number;
  currency: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly clearing: OrderClearingService,
    private readonly waTemplates: TemplateService,
    private readonly configService: ConfigService,
    private readonly whatsapp: WhatsappService,
    private readonly email: EmailService,
    private readonly sellersService: SellersService,
  ) {}

  private get privateBucket(): string {
    return this.configService.get<string>('storage.privateBucket') || 'private';
  }

  /**
   * Load (or lazily create) the single platform_fees_config row.
   * This is the source of truth for platform fee % and delivery fee across the app.
   */
  private async loadPlatformFeesRow(): Promise<{
    id: string;
    platform_fee_percent: number;
    delivery_flat_fee: number;
    buyer_delivery_share: number | null;
    seller_delivery_share: number | null;
    currency: string;
  }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('platform_fees_config')
      .select(
        'id, platform_fee_percent, delivery_flat_fee, buyer_delivery_share, seller_delivery_share, currency',
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        `Failed to load platform fees configuration: ${error.message}`,
      );
    }

    if (data) {
      const row = data as {
        id: string;
        platform_fee_percent: number | null;
        delivery_flat_fee: number | null;
        buyer_delivery_share: number | null;
        seller_delivery_share: number | null;
        currency: string | null;
      };

      return {
        id: row.id,
        platform_fee_percent: Number(row.platform_fee_percent ?? 0),
        delivery_flat_fee: Number(row.delivery_flat_fee ?? 0),
        buyer_delivery_share: row.buyer_delivery_share ?? null,
        seller_delivery_share: row.seller_delivery_share ?? null,
        currency: (row.currency as string | null) ?? 'XCD',
      };
    }

    // Fallback: create a default row if none exists (defensive guard in case seed failed)
    const { data: inserted, error: insertError } = await client
      .from('platform_fees_config')
      .insert({
        platform_fee_percent: 5,
        delivery_flat_fee: 20,
        buyer_delivery_share: null,
        seller_delivery_share: null,
        currency: 'XCD',
      })
      .select(
        'id, platform_fee_percent, delivery_flat_fee, buyer_delivery_share, seller_delivery_share, currency',
      )
      .single();

    if (insertError || !inserted) {
      throw new BadRequestException(
        `Failed to initialize platform fees configuration: ${
          insertError?.message ?? 'Unknown error'
        }`,
      );
    }

    const row = inserted as {
      id: string;
      platform_fee_percent: number | null;
      delivery_flat_fee: number | null;
      buyer_delivery_share: number | null;
      seller_delivery_share: number | null;
      currency: string | null;
    };

    return {
      id: row.id,
      platform_fee_percent: Number(row.platform_fee_percent ?? 0),
      delivery_flat_fee: Number(row.delivery_flat_fee ?? 0),
      buyer_delivery_share: row.buyer_delivery_share ?? null,
      seller_delivery_share: row.seller_delivery_share ?? null,
      currency: (row.currency as string | null) ?? 'XCD',
    };
  }

  async getPlatformFeesSettings(): Promise<PlatformFeesSettings> {
    const row = await this.loadPlatformFeesRow();
    const baseDelivery = Number(row.delivery_flat_fee ?? 0);
    const buyerShare =
      row.buyer_delivery_share != null ? Number(row.buyer_delivery_share) : 0;
    const sellerShare =
      row.seller_delivery_share != null ? Number(row.seller_delivery_share) : 0;

    return {
      platformFeePercent: Number(row.platform_fee_percent ?? 0),
      deliveryFlatFee: baseDelivery,
      buyerDeliveryShare: buyerShare,
      sellerDeliveryShare: sellerShare,
      currency: row.currency || 'XCD',
    };
  }

  async updatePlatformFeesSettings(input: {
    platformFeePercent?: number;
    deliveryFlatFee?: number;
    buyerDeliveryShare?: number;
    sellerDeliveryShare?: number;
    currency?: string;
  }): Promise<PlatformFeesSettings> {
    const client = this.supabase.getClient();
    const row = await this.loadPlatformFeesRow();

    const patch: Record<string, unknown> = {};

    if (typeof input.platformFeePercent === 'number') {
      if (input.platformFeePercent < 0) {
        throw new BadRequestException('Platform fee percent must be >= 0');
      }
      patch.platform_fee_percent = input.platformFeePercent;
    }

    if (typeof input.deliveryFlatFee === 'number') {
      if (input.deliveryFlatFee < 0) {
        throw new BadRequestException('Delivery fee must be >= 0');
      }
      patch.delivery_flat_fee = input.deliveryFlatFee;
    }

    if (typeof input.buyerDeliveryShare === 'number') {
      if (input.buyerDeliveryShare < 0) {
        throw new BadRequestException(
          'Buyer delivery share must be greater than or equal to zero',
        );
      }
      patch.buyer_delivery_share = input.buyerDeliveryShare;
    }

    if (typeof input.sellerDeliveryShare === 'number') {
      if (input.sellerDeliveryShare < 0) {
        throw new BadRequestException(
          'Seller delivery share must be greater than or equal to zero',
        );
      }
      patch.seller_delivery_share = input.sellerDeliveryShare;
    }

    if (typeof input.currency === 'string' && input.currency.trim()) {
      patch.currency = input.currency.trim().toUpperCase();
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await client
        .from('platform_fees_config')
        .update(patch)
        .eq('id', row.id);

      if (error) {
        throw new BadRequestException(
          `Failed to update platform fees configuration: ${error.message}`,
        );
      }
    }

    return this.getPlatformFeesSettings();
  }

  private async getOrganizationAdminContact(orgId: string): Promise<{
    adminEmail: string | null;
    adminFullname: string | null;
  }> {
    const client = this.supabase.getClient();

    // Find admin role for this organization (if any)
    const { data: roles, error: roleError } = await client
      .from('organization_roles')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_admin', true)
      .limit(1);

    if (roleError) {
      throw new BadRequestException(
        `Failed to load admin role for organization: ${roleError.message}`,
      );
    }

    const adminRoleId = roles?.[0]?.id as string | undefined;

    // Prefer: first admin member; fallback: first member in org
    let orgUserId: string | undefined;

    if (adminRoleId) {
      const { data: orgUsers, error: orgUserError } = await client
        .from('organization_users')
        .select('user_id')
        .eq('organization_id', orgId)
        .eq('role_id', adminRoleId)
        .order('joined_at', { ascending: true })
        .limit(1);

      if (orgUserError) {
        throw new BadRequestException(
          `Failed to load organization users: ${orgUserError.message}`,
        );
      }

      orgUserId = orgUsers?.[0]?.user_id as string | undefined;
    }

    // Fallback: any active member if no explicit admin member found
    if (!orgUserId) {
      const { data: anyUsers, error: anyUserError } = await client
        .from('organization_users')
        .select('user_id')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true })
        .limit(1);

      if (anyUserError) {
        throw new BadRequestException(
          `Failed to load fallback organization user: ${anyUserError.message}`,
        );
      }

      orgUserId = anyUsers?.[0]?.user_id as string | undefined;
    }

    if (!orgUserId) {
      return { adminEmail: null, adminFullname: null };
    }

    // Fetch user contact info
    const { data: users, error: userError } = await client
      .from('users')
      .select('email, fullname')
      .eq('id', orgUserId)
      .limit(1);

    if (userError) {
      throw new BadRequestException(
        `Failed to load admin user: ${userError.message}`,
      );
    }

    const user = users?.[0] as
      | { email?: string; fullname?: string }
      | undefined;
    if (!user) {
      return { adminEmail: null, adminFullname: null };
    }

    return {
      adminEmail: user.email ?? null,
      adminFullname: user.fullname ?? null,
    };
  }

  async listOrganizationsByType(
    accountType: 'buyer' | 'seller',
    query: AdminOrgQueryDto,
  ): Promise<{
    organizations: AdminOrganizationSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, country, status } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const client = this.supabase.getClient();

    let builder = client
      .from('organizations')
      .select('*', { count: 'exact' })
      .eq('account_type', accountType);

    if (search) {
      builder = builder.or(
        `name.ilike.%${search}%,business_name.ilike.%${search}%`,
      );
    }

    if (country) {
      builder = builder.eq('country', country);
    }

    if (status) {
      builder = builder.eq('status', status);
    }

    builder = builder.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await builder;

    if (error) {
      throw new BadRequestException(
        `Failed to list ${accountType} organizations: ${error.message}`,
      );
    }

    const organizations: AdminOrganizationSummary[] = data
      ? await Promise.all(
          data.map(async (org: any) => {
            const { adminEmail, adminFullname } =
              await this.getOrganizationAdminContact(org.id);
            let farmersId: string | null = null;
            const farmersIdPath = (org as any).farmers_id as string | null;
            if (farmersIdPath) {
              if (
                typeof farmersIdPath === 'string' &&
                /^https?:\/\//i.test(farmersIdPath)
              ) {
                farmersId = farmersIdPath;
              } else {
                try {
                  const signed = await this.supabase.createSignedDownloadUrl(
                    this.privateBucket,
                    farmersIdPath,
                    60 * 60,
                  );
                  farmersId = signed.signedUrl;
                } catch {
                  farmersId = null;
                }
              }
            }
            return {
              id: org.id,
              name: org.name,
              businessName: org.business_name ?? null,
              accountType: org.account_type,
              businessType: org.business_type ?? null,
              country: org.country ?? null,
              status: org.status,
              createdAt: org.created_at,
              updatedAt: org.updated_at,
              adminEmail,
              adminFullname,
              address: org.address ?? null,
              phoneNumber: org.phone_number ?? null,
              logoUrl: org.logo_url ?? null,
              headerImageUrl: (org as any).header_image_url ?? null,
              farmersId,
              farmersIdVerified: Boolean(
                (org as any).farmers_id_verified ?? false,
              ),
              farmVerified: Boolean((org as any).farm_verified ?? false),
              isHiddenFromMarketplace: Boolean(
                (org as any).is_hidden_from_marketplace ?? false,
              ),
            };
          }),
        )
      : [];

    return {
      organizations,
      total: count || 0,
      page,
      limit,
    };
  }

  async getDashboardSummary(): Promise<AdminDashboardSummary> {
    const client = this.supabase.getClient();

    // Load current platform fees config (used to normalize offline orders)
    const platformFees = await this.getPlatformFeesSettings();

    // Buyers count (active only)
    const { count: buyersCount, error: buyersError } = await client
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'buyer')
      .eq('status', OrganizationStatus.ACTIVE);

    if (buyersError) {
      throw new BadRequestException(
        `Failed to count buyer organizations: ${buyersError.message}`,
      );
    }

    // Sellers count (active only)
    const { count: sellersCount, error: sellersError } = await client
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'seller')
      .eq('status', OrganizationStatus.ACTIVE);

    if (sellersError) {
      throw new BadRequestException(
        `Failed to count seller organizations: ${sellersError.message}`,
      );
    }

    // Orders stats (includes online + offline flows)
    const { data: orderStatsRaw, error: ordersError } = await client
      .from('orders')
      .select(
        'status, payment_status, total_amount, subtotal, shipping_amount, tax_amount, discount_amount',
      );

    const orderStats = ordersError || !orderStatsRaw ? [] : orderStatsRaw;

    let completedOrders = 0;
    let currentOrders = 0;
    let totalVolume = 0;
    let derivedPlatformFees = 0;
    let totalShippingFees = 0;

    (orderStats || []).forEach((o: any) => {
      const status = (o.status as string) ?? '';
      const paymentStatus = (o.payment_status as string) ?? '';
      const totalAmount = Number(o.total_amount ?? 0);
      const subtotal = Number(o.subtotal ?? 0);
      const shipping = Number(o.shipping_amount ?? 0);
      const tax = Number(o.tax_amount ?? 0);
      const discount = Number(o.discount_amount ?? 0);

      if (
        (status === 'delivered' || status === 'completed') &&
        paymentStatus === 'paid'
      ) {
        completedOrders += 1;
      } else if (
        status !== 'cancelled' &&
        status !== 'disputed' &&
        paymentStatus !== 'failed'
      ) {
        currentOrders += 1;
      }

      // For offline orders, the platform (transaction) fee is baked into
      // total_amount. For paid orders, derive metrics as either:
      //  - config-based calculation (for orders that clearly use the platform
      //    fee config), or
      //  - residual above subtotal + shipping + tax - discount.
      if (paymentStatus === 'paid') {
        let volumeContribution = 0;
        let feeContribution = 0;
        let shippingContribution = 0;

        const isUsingPlatformFees =
          !!platformFees &&
          shipping > 0 &&
          Math.abs(shipping * 2 - platformFees.deliveryFlatFee) < 0.01;

        if (isUsingPlatformFees) {
          const buyerDelivery = shipping;
          const platformFeeFromConfig = Number(
            ((subtotal * platformFees.platformFeePercent) / 100).toFixed(2),
          );
          const totalDelivery = platformFees.deliveryFlatFee;
          volumeContribution = subtotal + buyerDelivery + platformFeeFromConfig;
          feeContribution = platformFeeFromConfig;
          shippingContribution = totalDelivery;
        } else {
          volumeContribution = totalAmount;
          const residual = totalAmount - (subtotal + shipping + tax - discount);
          if (residual > 0.005) {
            feeContribution = residual;
          }
          shippingContribution = shipping;
        }

        totalVolume += volumeContribution;
        derivedPlatformFees += feeContribution;
        totalShippingFees += shippingContribution;
      }
    });

    const totalPlatformFees = derivedPlatformFees;

    return {
      totalBuyers: buyersCount || 0,
      totalSellers: sellersCount || 0,
      completedOrders,
      currentOrders,
      totalVolume,
      totalPlatformFees,
      totalShippingFees,
      currency: 'XCD',
    };
  }

  async getDashboardCharts(): Promise<AdminDashboardCharts> {
    const client = this.supabase.getClient();

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    // Load recent transactions to derive transaction and revenue trends
    const { data: transactions, error: txError } = await client
      .from('transactions')
      .select('amount, currency, created_at, status, type')
      .gte('created_at', sinceIso);

    if (txError) {
      throw new BadRequestException(
        `Failed to load dashboard transactions: ${txError.message}`,
      );
    }

    const txByDate = new Map<
      string,
      { count: number; amount: number; currency: string | null }
    >();

    (transactions || []).forEach((t: any) => {
      const created = new Date(t.created_at as string);
      const key = created.toISOString().slice(0, 10); // YYYY-MM-DD
      const current = txByDate.get(key) ?? {
        count: 0,
        amount: 0,
        currency: null,
      };

      const status = (t.status as string) ?? '';
      const type = (t.type as string) ?? '';

      // Count all transactions for the volume chart
      current.count += 1;

      // Only completed sales contribute to revenue
      if (status === 'completed' && type === 'sale') {
        current.amount += Number(t.amount ?? 0);
      }

      current.currency =
        current.currency || (t.currency as string | null) || null;
      txByDate.set(key, current);
    });

    const sortedDates = Array.from(txByDate.keys()).sort();

    const transactionsOverTime = sortedDates.map((date) => ({
      date,
      count: txByDate.get(date)!.count,
    }));

    const revenueOverTime = sortedDates.map((date) => ({
      date,
      amount: txByDate.get(date)!.amount,
    }));

    const currency =
      (transactions?.[0]?.currency as string | undefined)?.toUpperCase() ||
      'XCD';

    // Popular items from order_items
    const { data: items, error: itemsError } = await client
      .from('order_items')
      .select('product_name, quantity, total_price, created_at')
      .gte('created_at', sinceIso);

    if (itemsError) {
      throw new BadRequestException(
        `Failed to load dashboard popular items: ${itemsError.message}`,
      );
    }

    const byProduct = new Map<
      string,
      { quantity: number; totalAmount: number }
    >();

    (items || []).forEach((it: any) => {
      const name = (it.product_name as string) || 'Unknown item';
      const current = byProduct.get(name) ?? { quantity: 0, totalAmount: 0 };
      current.quantity += Number(it.quantity ?? 0);
      current.totalAmount += Number(it.total_price ?? 0);
      byProduct.set(name, current);
    });

    const popularItems = Array.from(byProduct.entries())
      .map(([name, agg]) => ({
        name,
        quantity: agg.quantity,
        totalAmount: agg.totalAmount,
      }))
      .sort((a, b) => b.quantity - a.quantity || b.totalAmount - a.totalAmount)
      .slice(0, 10);

    return {
      transactionsOverTime,
      revenueOverTime,
      popularItems,
      currency,
    };
  }

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    userId?: string;
    method?: string;
    statusCode?: number;
    action?: string;
    routeContains?: string;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<{
    items: AdminAuditLogItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 50,
      userId,
      method,
      statusCode,
      action,
      routeContains,
      search,
      from,
      to,
    } = query;

    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    const client = this.supabase.getClient();

    let builder = client
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (userId) {
      builder = builder.eq('user_id', userId);
    }
    if (method) {
      builder = builder.eq('method', method.toUpperCase());
    }
    if (typeof statusCode === 'number') {
      builder = builder.eq('status_code', statusCode);
    }
    if (action) {
      builder = builder.ilike('action', `%${action}%`);
    }
    if (routeContains) {
      builder = builder.ilike('route', `%${routeContains}%`);
    }
    if (from) {
      builder = builder.gte('created_at', from);
    }
    if (to) {
      builder = builder.lte('created_at', to);
    }
    if (search) {
      builder = builder.or(
        [
          `actor_email.ilike.%${search}%`,
          `action.ilike.%${search}%`,
          `resource.ilike.%${search}%`,
          `route.ilike.%${search}%`,
        ].join(','),
      );
    }

    const { data, error, count } = await builder;

    if (error) {
      throw new BadRequestException(
        `Failed to list audit logs: ${error.message}`,
      );
    }

    const items: AdminAuditLogItem[] =
      (data || []).map((row: any) => ({
        // eslint-disable-line @typescript-eslint/no-explicit-any
        id: row.id as string,
        userId: (row.user_id as string | null) ?? null,
        organizationId: (row.organization_id as string | null) ?? null,
        actorEmail: (row.actor_email as string | null) ?? null,
        actorRole: (row.actor_role as string | null) ?? null,
        actorAccountType: (row.actor_account_type as string | null) ?? null,
        action: (row.action as string) ?? '',
        resource: (row.resource as string | null) ?? null,
        resourceId: (row.resource_id as string | null) ?? null,
        route: (row.route as string | null) ?? null,
        method: (row.method as string | null) ?? null,
        statusCode:
          typeof row.status_code === 'number'
            ? (row.status_code as number)
            : row.status_code
              ? Number(row.status_code)
              : null,
        ipAddress: (row.ip_address as string | null) ?? null,
        userAgent: (row.user_agent as string | null) ?? null,
        createdAt: (row.created_at as string) ?? '',
      })) ?? [];

    return {
      items,
      total: count || 0,
      page,
      limit,
    };
  }

  async updateOrganizationStatus(
    id: string,
    accountType: 'buyer' | 'seller',
    status: OrganizationStatus,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('organizations')
      .update({ status })
      .eq('id', id)
      .eq('account_type', accountType)
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to update organization status: ${
          error?.message ?? 'Unknown error'
        }`,
      );
    }

    return { success: true };
  }

  async updateSellerMarketplaceHidden(
    orgId: string,
    hidden: boolean,
  ): Promise<{ success: boolean; isHiddenFromMarketplace: boolean }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('organizations')
      .update({ is_hidden_from_marketplace: hidden })
      .eq('id', orgId)
      .eq('account_type', 'seller')
      .select('id, is_hidden_from_marketplace')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to update seller marketplace visibility: ${
          error?.message ?? 'Unknown error'
        }`,
      );
    }

    return {
      success: true,
      isHiddenFromMarketplace: Boolean(
        (data as any).is_hidden_from_marketplace ?? false,
      ),
    };
  }

  async deleteOrganization(
    id: string,
    accountType: 'buyer' | 'seller',
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    // Soft-delete by marking the organization as suspended / inactive
    const { data, error } = await client
      .from('organizations')
      .update({ status: OrganizationStatus.SUSPENDED })
      .eq('id', id)
      .eq('account_type', accountType)
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to delete organization: ${error?.message ?? 'Unknown error'}`,
      );
    }

    // Additionally deactivate all organization user memberships
    const { error: orgUsersError } = await client
      .from('organization_users')
      .update({ is_active: false })
      .eq('organization_id', id);

    if (orgUsersError) {
      throw new BadRequestException(
        `Failed to deactivate organization users: ${orgUsersError.message}`,
      );
    }

    // Deactivate and remove associated buyer/seller user accounts as well.
    // We scope this to users whose individual_account_type matches the
    // organization accountType to avoid touching unrelated roles.
    const { data: orgUsers, error: loadOrgUsersError } = await client
      .from('organization_users')
      .select('user_id')
      .eq('organization_id', id);

    if (loadOrgUsersError) {
      throw new BadRequestException(
        `Failed to load organization users for deletion: ${loadOrgUsersError.message}`,
      );
    }

    const userIds = (orgUsers || [])
      .map((ou: any) => ou.user_id as string | null) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((uid): uid is string => Boolean(uid));

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, individual_account_type')
        .in('id', userIds);

      if (usersError) {
        throw new BadRequestException(
          `Failed to load users for organization deletion: ${usersError.message}`,
        );
      }

      const targetUserIds =
        users
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ?.filter(
            (u: any) =>
              (u.individual_account_type as string | null) === accountType,
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((u: any) => u.id as string) || [];

      if (targetUserIds.length > 0) {
        const { error: deactivateUsersError } = await client
          .from('users')
          .update({ is_active: false })
          .in('id', targetUserIds);

        if (deactivateUsersError) {
          throw new BadRequestException(
            `Failed to deactivate buyer/seller users: ${deactivateUsersError.message}`,
          );
        }

        // Best-effort removal from Supabase Auth so these buyer/seller users
        // no longer appear in the Supabase Authentication user list. Failures
        // here should not block the primary delete behaviour.
        await Promise.all(
          targetUserIds.map((userId) => this.supabase.deleteAuthUser(userId)),
        );
      }
    }

    return { success: true };
  }

  async bulkDeleteOrganizations(
    ids: string[],
    accountType: 'buyer' | 'seller',
  ): Promise<{ deleted: number }> {
    if (!ids || ids.length === 0) {
      return { deleted: 0 };
    }

    const client = this.supabase.getClient();

    // Soft-delete organizations in bulk
    const { data, error } = await client
      .from('organizations')
      .update({ status: OrganizationStatus.SUSPENDED })
      .in('id', ids)
      .eq('account_type', accountType)
      .select('id');

    if (error) {
      throw new BadRequestException(
        `Failed to delete organizations: ${error.message}`,
      );
    }

    const affectedIds =
      data?.map((org: { id: string }) => org.id).filter(Boolean) ?? [];

    if (affectedIds.length === 0) {
      return { deleted: 0 };
    }

    // Deactivate all memberships for the affected organizations
    const { error: orgUsersError } = await client
      .from('organization_users')
      .update({ is_active: false })
      .in('organization_id', affectedIds);

    if (orgUsersError) {
      throw new BadRequestException(
        `Failed to deactivate organization users: ${orgUsersError.message}`,
      );
    }

    // Deactivate and remove associated buyer/seller user accounts as well.
    // We scope this to users whose individual_account_type matches the
    // organization accountType to avoid touching unrelated roles.
    const { data: orgUsers, error: loadOrgUsersError } = await client
      .from('organization_users')
      .select('user_id, organization_id')
      .in('organization_id', affectedIds);

    if (loadOrgUsersError) {
      throw new BadRequestException(
        `Failed to load organization users for bulk deletion: ${loadOrgUsersError.message}`,
      );
    }

    const userIds = Array.from(
      new Set(
        (orgUsers || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((ou: any) => ou.user_id as string | null)
          .filter((uid): uid is string => Boolean(uid)),
      ),
    );

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, individual_account_type')
        .in('id', userIds);

      if (usersError) {
        throw new BadRequestException(
          `Failed to load users for bulk organization deletion: ${usersError.message}`,
        );
      }

      const targetUserIds =
        users
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ?.filter(
            (u: any) =>
              (u.individual_account_type as string | null) === accountType,
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((u: any) => u.id as string) || [];

      if (targetUserIds.length > 0) {
        const { error: deactivateUsersError } = await client
          .from('users')
          .update({ is_active: false })
          .in('id', targetUserIds);

        if (deactivateUsersError) {
          throw new BadRequestException(
            `Failed to deactivate buyer/seller users: ${deactivateUsersError.message}`,
          );
        }

        await Promise.all(
          targetUserIds.map((userId) => this.supabase.deleteAuthUser(userId)),
        );
      }
    }

    return { deleted: affectedIds.length };
  }

  async getOrganizationById(
    accountType: 'buyer' | 'seller',
    orgId: string,
  ): Promise<AdminOrganizationSummary> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .eq('account_type', accountType)
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `Organization not found or not a ${accountType}`,
      );
    }

    const { adminEmail, adminFullname } =
      await this.getOrganizationAdminContact(data.id);
    let farmersId: string | null = null;
    const farmersIdPath = (data as any).farmers_id as string | null;
    if (farmersIdPath) {
      if (
        typeof farmersIdPath === 'string' &&
        /^https?:\/\//i.test(farmersIdPath)
      ) {
        farmersId = farmersIdPath;
      } else {
        try {
          const signed = await this.supabase.createSignedDownloadUrl(
            this.privateBucket,
            farmersIdPath,
            60 * 60,
          );
          farmersId = signed.signedUrl;
        } catch {
          farmersId = null;
        }
      }
    }

    return {
      id: data.id,
      name: data.name,
      businessName: data.business_name ?? null,
      accountType: data.account_type,
      businessType: data.business_type ?? null,
      country: data.country ?? null,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      adminEmail,
      adminFullname,
      address: data.address ?? null,
      phoneNumber: data.phone_number ?? null,
      logoUrl: data.logo_url ?? null,
      headerImageUrl: (data as any).header_image_url ?? null,
      farmersId,
      farmersIdVerified: Boolean((data as any).farmers_id_verified ?? false),
      farmVerified: Boolean((data as any).farm_verified ?? false),
      isHiddenFromMarketplace: Boolean(
        (data as any).is_hidden_from_marketplace ?? false,
      ),
    };
  }

  async getBuyerDetail(orgId: string): Promise<{
    organization: AdminOrganizationSummary;
    members: AdminBuyerMemberSummary[];
    recentOrders: AdminOrderSummary[];
  }> {
    const organization = await this.getOrganizationById('buyer', orgId);
    const client = this.supabase.getClient();

    // Organization members
    const { data: orgUsers, error: orgUsersError } = await client
      .from('organization_users')
      .select('id, user_id, role_id, is_active, joined_at')
      .eq('organization_id', orgId);

    if (orgUsersError) {
      throw new BadRequestException(
        `Failed to load buyer members: ${orgUsersError.message}`,
      );
    }

    const userIds = (orgUsers || []).map((ou: any) => ou.user_id as string);
    const roleIds = (orgUsers || []).map((ou: any) => ou.role_id as string);

    let usersById: Record<
      string,
      { email: string; fullname: string; last_login?: string | null }
    > = {};
    let rolesById: Record<
      string,
      { name: string; display_name: string; is_admin: boolean }
    > = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, email, fullname, last_login')
        .in('id', userIds);

      if (usersError) {
        throw new BadRequestException(
          `Failed to load buyer users: ${usersError.message}`,
        );
      }

      usersById = Object.fromEntries(
        (users || []).map((u: any) => [
          u.id as string,
          {
            email: u.email as string,
            fullname: u.fullname as string,
            last_login: (u.last_login as string | null) ?? null,
          },
        ]),
      );
    }

    if (roleIds.length > 0) {
      const { data: roles, error: rolesError } = await client
        .from('organization_roles')
        .select('id, name, display_name, is_admin')
        .in('id', roleIds);

      if (rolesError) {
        throw new BadRequestException(
          `Failed to load organization roles: ${rolesError.message}`,
        );
      }

      rolesById = Object.fromEntries(
        (roles || []).map((r: any) => [
          r.id as string,
          {
            name: r.name as string,
            display_name: r.display_name as string,
            is_admin: Boolean(r.is_admin),
          },
        ]),
      );
    }

    const members: AdminBuyerMemberSummary[] = (orgUsers || []).map(
      (ou: any) => {
        const user = usersById[ou.user_id as string];
        const role = rolesById[ou.role_id as string];
        return {
          id: ou.user_id as string,
          email: user?.email ?? '',
          fullname: user?.fullname ?? '',
          isActive: Boolean(ou.is_active),
          joinedAt: ou.joined_at as string,
          roleName: role?.name ?? null,
          roleDisplayName: role?.display_name ?? null,
          isAdmin: role?.is_admin ?? false,
          lastLogin: user?.last_login ?? null,
        };
      },
    );

    // Recent orders for this buyer org
    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select(
        'id, order_number, status, payment_status, total_amount, currency, created_at',
      )
      .eq('buyer_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (ordersError) {
      throw new BadRequestException(
        `Failed to load buyer orders: ${ordersError.message}`,
      );
    }

    const recentOrders: AdminOrderSummary[] =
      orders?.map((o: any) => ({
        id: o.id as string,
        orderNumber: String(o.order_number ?? o.id),
        status: o.status as string,
        paymentStatus: o.payment_status as string,
        totalAmount: Number(o.total_amount ?? 0),
        currency: (o.currency as string) ?? 'XCD',
        createdAt: o.created_at as string,
      })) ?? [];

    return {
      organization,
      members,
      recentOrders,
    };
  }

  async listSellerProducts(
    orgId: string,
    query: ProductQueryDto,
  ): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.sellersService.getProducts(orgId, query);
  }

  async deleteSellerProduct(orgId: string, productId: string): Promise<void> {
    await this.sellersService.deleteProduct(orgId, productId);
  }

  async updateSellerProductStatus(
    orgId: string,
    productId: string,
    status: ProductStatus,
    adminUserId: string,
  ): Promise<ProductResponseDto> {
    return this.sellersService.updateProduct(
      orgId,
      productId,
      { status },
      adminUserId,
    );
  }

  async updateSellerProduct(
    orgId: string,
    productId: string,
    dto: UpdateProductDto,
    adminUserId: string,
  ): Promise<ProductResponseDto> {
    return this.sellersService.updateProduct(
      orgId,
      productId,
      dto,
      adminUserId,
    );
  }

  async createSellerProduct(
    orgId: string,
    dto: CreateProductDto,
    adminUserId: string,
  ): Promise<ProductResponseDto> {
    return this.sellersService.createProduct(orgId, dto, adminUserId);
  }

  async getSellerDetail(orgId: string): Promise<{
    organization: AdminOrganizationSummary;
    members: AdminBuyerMemberSummary[];
    recentOrders: AdminOrderSummary[];
    latestFarmVisitRequest?: {
      id: string;
      status: string;
      preferredDate: string | null;
      preferredTimeWindow: string | null;
      notes: string | null;
      scheduledFor: string | null;
      adminNotes: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  }> {
    const organization = await this.getOrganizationById('seller', orgId);
    const client = this.supabase.getClient();

    // Organization members (same shape as buyer members)
    const { data: orgUsers, error: orgUsersError } = await client
      .from('organization_users')
      .select('id, user_id, role_id, is_active, joined_at')
      .eq('organization_id', orgId);

    if (orgUsersError) {
      throw new BadRequestException(
        `Failed to load seller members: ${orgUsersError.message}`,
      );
    }

    const userIds = (orgUsers || []).map((ou: any) => ou.user_id as string);
    const roleIds = (orgUsers || []).map((ou: any) => ou.role_id as string);

    let usersById: Record<
      string,
      { email: string; fullname: string; last_login?: string | null }
    > = {};
    let rolesById: Record<
      string,
      { name: string; display_name: string; is_admin: boolean }
    > = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, email, fullname, last_login')
        .in('id', userIds);

      if (usersError) {
        throw new BadRequestException(
          `Failed to load seller users: ${usersError.message}`,
        );
      }

      usersById = Object.fromEntries(
        (users || []).map((u: any) => [
          u.id as string,
          {
            email: u.email as string,
            fullname: u.fullname as string,
            last_login: (u.last_login as string | null) ?? null,
          },
        ]),
      );
    }

    if (roleIds.length > 0) {
      const { data: roles, error: rolesError } = await client
        .from('organization_roles')
        .select('id, name, display_name, is_admin')
        .in('id', roleIds);

      if (rolesError) {
        throw new BadRequestException(
          `Failed to load organization roles: ${rolesError.message}`,
        );
      }

      rolesById = Object.fromEntries(
        (roles || []).map((r: any) => [
          r.id as string,
          {
            name: r.name as string,
            display_name: r.display_name as string,
            is_admin: Boolean(r.is_admin),
          },
        ]),
      );
    }

    const members: AdminBuyerMemberSummary[] = (orgUsers || []).map(
      (ou: any) => {
        const user = usersById[ou.user_id as string];
        const role = rolesById[ou.role_id as string];
        return {
          id: ou.user_id as string,
          email: user?.email ?? '',
          fullname: user?.fullname ?? '',
          isActive: Boolean(ou.is_active),
          joinedAt: ou.joined_at as string,
          roleName: role?.name ?? null,
          roleDisplayName: role?.display_name ?? null,
          isAdmin: role?.is_admin ?? false,
          lastLogin: user?.last_login ?? null,
        };
      },
    );

    // Recent orders for this seller org
    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select(
        'id, order_number, status, payment_status, total_amount, currency, created_at',
      )
      .eq('seller_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (ordersError) {
      throw new BadRequestException(
        `Failed to load seller orders: ${ordersError.message}`,
      );
    }

    const recentOrders: AdminOrderSummary[] =
      orders?.map((o: any) => ({
        id: o.id as string,
        orderNumber: String(o.order_number ?? o.id),
        status: o.status as string,
        paymentStatus: o.payment_status as string,
        totalAmount: Number(o.total_amount ?? 0),
        currency: (o.currency as string) ?? 'XCD',
        createdAt: o.created_at as string,
      })) ?? [];

    // Latest farm visit request for this seller (if any)
    const { data: farmVisits, error: farmVisitError } = await client
      .from('farm_visit_requests')
      .select(
        'id, status, preferred_date, preferred_time_window, notes, scheduled_for, admin_notes, created_at, updated_at',
      )
      .eq('seller_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (farmVisitError) {
      throw new BadRequestException(
        `Failed to load farm visit requests: ${farmVisitError.message}`,
      );
    }

    const latestFarmVisitRaw = farmVisits?.[0] as
      | {
          id: string;
          status: string;
          preferred_date: string | null;
          preferred_time_window: string | null;
          notes: string | null;
          scheduled_for: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    const latestFarmVisit =
      latestFarmVisitRaw == null
        ? null
        : {
            id: latestFarmVisitRaw.id,
            status: latestFarmVisitRaw.status,
            preferredDate: latestFarmVisitRaw.preferred_date,
            preferredTimeWindow: latestFarmVisitRaw.preferred_time_window,
            notes: latestFarmVisitRaw.notes,
            scheduledFor: latestFarmVisitRaw.scheduled_for,
            adminNotes: latestFarmVisitRaw.admin_notes,
            createdAt: latestFarmVisitRaw.created_at,
            updatedAt: latestFarmVisitRaw.updated_at,
          };

    return {
      organization,
      members,
      recentOrders,
      latestFarmVisitRequest: latestFarmVisit,
    };
  }

  /**
   * Create an order review on behalf of a buyer for a given seller order.
   * This mirrors the buyer-side createOrderReview flow but can be triggered
   * from the admin panel. It still enforces that the order belongs to the
   * buyer org, is delivered, and has not already been reviewed.
   */
  async createOrderReviewForBuyer(
    buyerOrgId: string,
    orderId: string,
    reviewDto: OrderReviewDto,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    // Verify order ownership and completion
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, status, seller_org_id')
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found for this buyer');
    }

    if (order.status !== 'delivered') {
      throw new BadRequestException('Can only review delivered orders');
    }

    // Prevent duplicate reviews for the same order/buyer
    const { data: existing } = await client
      .from('order_reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Order has already been reviewed');
    }

    const { error } = await client.from('order_reviews').insert({
      order_id: orderId,
      buyer_org_id: buyerOrgId,
      seller_org_id: order.seller_org_id,
      rating: reviewDto.overall_rating,
      review_text: reviewDto.comment || null,
      delivery_rating: reviewDto.delivery_rating,
      product_quality_rating: reviewDto.product_quality_rating,
      service_rating: reviewDto.service_rating,
    });

    if (error) {
      throw new BadRequestException(
        `Failed to create review: ${error.message}`,
      );
    }

    await client.from('order_timeline').insert({
      order_id: orderId,
      event_type: 'buyer_left_review',
      title: 'Buyer review recorded by admin',
      description: reviewDto.title || null,
      actor_type: 'admin',
      metadata: {
        overall_rating: reviewDto.overall_rating,
        created_by_admin: true,
      },
      is_visible_to_buyer: true,
      is_visible_to_seller: true,
    });

    return { success: true };
  }

  /**
   * Send a review-request email to the buyer admin contact for a delivered order.
   * Includes a deep link to the buyer order review page in the frontend.
   */
  async sendBuyerOrderReviewRequestEmail(
    buyerOrgId: string,
    orderId: string,
  ): Promise<{ success: boolean; to: string; reviewUrl: string }> {
    const client = this.supabase.getClient();

    const { data: order, error: orderError } = await client
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        buyer_org_id,
        seller_organization:organizations!seller_org_id(name)
      `,
      )
      .eq('id', orderId)
      .eq('buyer_org_id', buyerOrgId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found for this buyer');
    }

    if ((order.status as string) !== 'delivered') {
      throw new BadRequestException(
        'Can only request a review email for delivered orders',
      );
    }

    const { adminEmail, adminFullname } =
      await this.getOrganizationAdminContact(buyerOrgId);

    if (!adminEmail) {
      throw new BadRequestException(
        'Buyer has no admin email on file (cannot send review email)',
      );
    }

    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001';
    const reviewUrl = `${frontendUrl}/buyer/orders/${orderId}/review`;

    const orderNum = (order as any)?.order_number || orderId;
    const sellerName = (order as any)?.seller_organization?.name || 'the seller';
    const greetingName = adminFullname || 'there';

    const subject = 'How was your Procur experience?';
    const title = 'How was your Procur experience?';
    const innerHtml = `
      <h2 style="margin:0 0 12px;">Hi ${greetingName},</h2>
      <p style="margin:0 0 12px;">
        Thanks again for ordering on Procur. We’d love your feedback.
      </p>
      <p style="margin:0 0 12px;">
        <strong>Please write a review</strong> for your recent order
        <strong>${orderNum}</strong> from <strong>${sellerName}</strong> and let us know how your overall experience went.
      </p>
      <p style="margin-top: 16px;">
        <a href="${reviewUrl}" class="button">Write a review</a>
      </p>
      <p class="muted" style="margin:12px 0 0;">
        Or copy and paste this link into your browser:
        <a href="${reviewUrl}">${reviewUrl}</a>
      </p>
    `;

    const text = `How was your Procur experience?\n\nPlease write a review for order ${orderNum} from ${sellerName}:\n${reviewUrl}\n`;

    // Strict so admin gets a real error if Postmark fails.
    await this.email.sendBrandedEmailStrict(adminEmail, subject, title, innerHtml, text);

    // Optional: timeline entry (best-effort)
    try {
      await client.from('order_timeline').insert({
        order_id: orderId,
        event_type: 'review_requested',
        title: 'Review requested',
        description: 'Admin sent a review request email to the buyer.',
        actor_type: 'admin',
        metadata: { channel: 'email' },
        is_visible_to_buyer: true,
        is_visible_to_seller: false,
      });
    } catch {
      // ignore timeline failures
    }

    return { success: true, to: adminEmail, reviewUrl };
  }

  /**
   * Create a farm visit request on behalf of a seller organization.
   * This is used from the admin panel so staff can book a visit even
   * if the seller hasn't initiated the request from their dashboard.
   */
  async createSellerFarmVisitRequest(
    orgId: string,
    requestedByUserId: string,
    dto: CreateFarmVisitRequestDto,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { error } = await client.from('farm_visit_requests').insert({
      seller_org_id: orgId,
      requested_by_user_id: requestedByUserId,
      preferred_date: dto.preferred_date ?? null,
      preferred_time_window: dto.preferred_time_window ?? null,
      notes: dto.notes ?? null,
      status: 'pending',
    });

    if (error) {
      throw new BadRequestException(
        `Failed to create farm visit request: ${error.message}`,
      );
    }

    return { success: true };
  }

  async updateSellerFarmersIdVerification(
    orgId: string,
    verified: boolean,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('organizations')
      .update({ farmers_id_verified: verified })
      .eq('id', orgId)
      .eq('account_type', 'seller');

    if (error) {
      throw new BadRequestException(
        `Failed to update farmer ID verification: ${error.message}`,
      );
    }

    return { success: true };
  }

  async updateSellerFarmVerification(
    orgId: string,
    verified: boolean,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('organizations')
      .update({ farm_verified: verified })
      .eq('id', orgId)
      .eq('account_type', 'seller');

    if (error) {
      throw new BadRequestException(
        `Failed to update farm verification: ${error.message}`,
      );
    }

    return { success: true };
  }

  async listOrders(query: AdminOrderQueryDto): Promise<{
    orders: AdminOrderSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      buyerOrgId,
      sellerOrgId,
      search,
    } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const client = this.supabase.getClient();

    // Load platform fees config so we can normalize totals for offline orders
    const platformFees = await this.getPlatformFeesSettings();

    let builder = client
      .from('orders')
      .select(
        'id, order_number, status, payment_status, total_amount, subtotal, shipping_amount, tax_amount, discount_amount, currency, buyer_org_id, seller_org_id, created_at, driver_user_id, assigned_driver_at',
        { count: 'exact' },
      );

    if (status) {
      builder = builder.eq('status', status);
    }
    if (paymentStatus) {
      builder = builder.eq('payment_status', paymentStatus);
    }
    if (buyerOrgId) {
      builder = builder.eq('buyer_org_id', buyerOrgId);
    }
    if (sellerOrgId) {
      builder = builder.eq('seller_org_id', sellerOrgId);
    }

    builder = builder.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await builder;

    if (error) {
      throw new BadRequestException(`Failed to list orders: ${error.message}`);
    }

    const ordersRaw = (data || []) as any[];
    const orgIds = Array.from(
      new Set(
        ordersRaw
          .map((o) => [
            o.buyer_org_id as string | null,
            o.seller_org_id as string | null,
          ])
          .flat()
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let orgById: Record<string, { name: string | null }> = {};

    if (orgIds.length > 0) {
      const { data: orgs, error: orgsError } = await client
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);

      if (orgsError) {
        throw new BadRequestException(
          `Failed to load organizations for orders: ${orgsError.message}`,
        );
      }

      orgById = Object.fromEntries(
        (orgs || []).map((o: any) => [
          o.id as string,
          { name: (o.name as string) ?? null },
        ]),
      );
    }

    const orders: AdminOrderSummary[] = ordersRaw.map((o) => {
      const subtotal = Number(o.subtotal ?? 0);
      const shippingAmount = Number(o.shipping_amount ?? 0);
      const taxAmount = Number(o.tax_amount ?? 0);
      const discountAmount = Number(o.discount_amount ?? 0);
      const storedTotal = Number(o.total_amount ?? 0);

      // If this order matches the current platform fees config (offline flow),
      // compute the buyer-paid total as subtotal + buyer delivery share +
      // transaction fee from config; otherwise fall back to stored total.
      const isUsingPlatformFees =
        !!platformFees &&
        shippingAmount > 0 &&
        Math.abs(shippingAmount * 2 - platformFees.deliveryFlatFee) < 0.01;

      let displayTotal = storedTotal;

      if (isUsingPlatformFees) {
        const buyerDelivery = shippingAmount;
        const txFeeFromConfig = Number(
          ((subtotal * platformFees.platformFeePercent) / 100).toFixed(2),
        );
        displayTotal = subtotal + buyerDelivery + txFeeFromConfig;
      } else if (storedTotal === 0 && subtotal > 0) {
        // Fallback: derive from basic math when total wasn't stored correctly.
        displayTotal = subtotal + shippingAmount + taxAmount - discountAmount;
      }

      return {
        id: o.id as string,
        orderNumber: String(o.order_number ?? o.id),
        status: o.status as string,
        paymentStatus: o.payment_status as string,
        totalAmount: displayTotal,
        currency: (o.currency as string) ?? 'XCD',
        createdAt: o.created_at as string,
        buyerOrgId: (o.buyer_org_id as string) ?? undefined,
        buyerOrgName: orgById[(o.buyer_org_id as string) ?? '']?.name ?? null,
        sellerOrgId: (o.seller_org_id as string) ?? undefined,
        sellerOrgName: orgById[(o.seller_org_id as string) ?? '']?.name ?? null,
        driverUserId: (o.driver_user_id as string | null) ?? null,
        driverName: null,
        assignedDriverAt: (o.assigned_driver_at as string | null) ?? null,
      };
    });

    // Optional basic text search over orderNumber / org names
    const searched = search
      ? orders.filter((o) => {
          const q = search.toLowerCase();
          return (
            o.orderNumber.toLowerCase().includes(q) ||
            (o.buyerOrgName ?? '').toLowerCase().includes(q) ||
            (o.sellerOrgName ?? '').toLowerCase().includes(q)
          );
        })
      : orders;

    return {
      orders: searched,
      total: count || 0,
      page,
      limit,
    };
  }

  async sendOrderReceiptEmail(input: {
    orderId: string;
    email: string;
    paymentReference?: string | null;
  }): Promise<{ success: boolean }> {
    return this.clearing.sendReceiptToEmail({
      orderId: input.orderId,
      email: input.email,
      paymentReference: input.paymentReference,
    });
  }

  async sendOrderSellerReceiptEmail(input: {
    orderId: string;
    email: string;
    paymentReference?: string | null;
  }): Promise<{ success: boolean }> {
    return this.clearing.sendSellerReceiptToEmail({
      orderId: input.orderId,
      email: input.email,
      paymentReference: input.paymentReference,
    });
  }

  async createOfflineOrder(
    input: AdminCreateOfflineOrderDto,
  ): Promise<{ id: string; order_number: string }> {
    const client = this.supabase.getClient();

    if (!input.seller_org_id || !input.buyer_org_id) {
      throw new BadRequestException(
        'buyer_org_id and seller_org_id are required',
      );
    }

    // Ensure buyer organization exists and is a buyer
    const { data: buyerOrg } = await client
      .from('organizations')
      .select('id')
      .eq('id', input.buyer_org_id)
      .eq('account_type', 'buyer')
      .maybeSingle();

    if (!buyerOrg) {
      throw new BadRequestException('Buyer organization not found');
    }

    // Ensure seller organization exists and is a seller
    const { data: sellerOrg } = await client
      .from('organizations')
      .select('id')
      .eq('id', input.seller_org_id)
      .eq('account_type', 'seller')
      .maybeSingle();

    if (!sellerOrg) {
      throw new BadRequestException('Seller organization not found');
    }

    const now = new Date();
    const orderNumber = `ORD-${now.getTime()}-${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`;

    // Compute subtotal from optional line items or fallback to provided amount
    const rawLineItems = Array.isArray(input.line_items)
      ? input.line_items
      : [];

    const hasLineItems = rawLineItems.length > 0;

    let subtotal = 0;

    if (hasLineItems) {
      for (const item of rawLineItems) {
        if (
          !item.product_id ||
          !item.product_name ||
          !item.quantity ||
          !item.unit_price ||
          Number(item.quantity) <= 0 ||
          Number(item.unit_price) <= 0
        ) {
          throw new BadRequestException(
            'Each product must have a product_id, name, quantity, and cost per unit greater than zero',
          );
        }
        subtotal += Number(item.unit_price) * Number(item.quantity);
      }
    } else {
      const amount = Number(input.amount);
      if (!amount || amount <= 0) {
        throw new BadRequestException(
          'Amount must be a number greater than zero',
        );
      }
      subtotal = amount;
    }

    if (!subtotal || subtotal <= 0) {
      throw new BadRequestException(
        'Total amount must be greater than zero for offline order',
      );
    }
    const hasShippingAddress =
      input.shipping_address && input.shipping_address.line1;

    // Use platform fees configuration. For offline orders recorded in the admin
    // panel, we treat the delivery fee as split between buyer and seller, while
    // the transaction fee (platform fee) is fully paid by the buyer.
    const platformFees = await this.getPlatformFeesSettings();
    const taxAmount = 0;
    const discountAmount = 0;

    // Delivery splits are configurable. For offline orders created in the admin
    // panel, store ONLY the buyer-facing portion in `orders.shipping_amount`.
    // If buyer/seller shares are not configured, fall back to an even split of
    // the configured flat delivery fee for backwards compatibility.
    const configuredBuyerShare = Number(platformFees.buyerDeliveryShare ?? 0);
    const configuredSellerShare = Number(platformFees.sellerDeliveryShare ?? 0);
    const configuredFlatDelivery = Number(platformFees.deliveryFlatFee ?? 0);

    const fullDeliveryFee = hasShippingAddress
      ? configuredBuyerShare + configuredSellerShare || configuredFlatDelivery
      : 0;

    const buyerDeliveryAmount = hasShippingAddress
      ? configuredBuyerShare || Number((fullDeliveryFee / 2).toFixed(2))
      : 0;

    // Entire platform fee is paid by the buyer (applied on items subtotal)
    const platformFeeAmount = Number(
      (subtotal * (platformFees.platformFeePercent / 100)).toFixed(2),
    );

    const totalAmount = subtotal + buyerDeliveryAmount + platformFeeAmount;

    const shippingAddressSnapshot = hasShippingAddress
      ? {
          contact_name: null,
          line1: input.shipping_address.line1,
          line2: input.shipping_address.line2,
          city: input.shipping_address.city,
          state: input.shipping_address.state,
          postal_code: input.shipping_address.postal_code,
          country: input.shipping_address.country,
        }
      : null;

    const { data: order, error } = await client
      .from('orders')
      .insert({
        order_number: orderNumber,
        buyer_org_id: input.buyer_org_id,
        seller_org_id: input.seller_org_id,
        status: input.status || 'delivered',
        payment_status: input.payment_status || 'paid',
        subtotal,
        tax_amount: taxAmount,
        // Only the buyer-facing portion of delivery is stored in shipping_amount
        shipping_amount: buyerDeliveryAmount,
        discount_amount: discountAmount,
        // Buyer-paid total: subtotal + buyer delivery share + transaction fee
        total_amount: totalAmount,
        currency: (input.currency || 'XCD').toUpperCase(),
        shipping_address: shippingAddressSnapshot,
        billing_address: shippingAddressSnapshot,
        buyer_notes: input.description,
        estimated_delivery_date: input.delivery_date || null,
      })
      .select('id, order_number')
      .single();

    if (error || !order) {
      throw new BadRequestException(
        `Failed to create offline order: ${error?.message ?? 'Unknown error'}`,
      );
    }

    // Optionally attach basic order_items rows so reviews and detail views
    // have product-level context
    if (hasLineItems) {
      const itemsToInsert = rawLineItems.map((item) => ({
        order_id: order.id as string,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
        total_price: Number(item.unit_price) * Number(item.quantity),
        product_snapshot: item.unit ? { unit: item.unit } : null,
      }));

      const { error: itemsError } = await client
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Do not block the main offline order creation if item rows fail;
        // the core order header is still valuable for admin reporting.
        // eslint-disable-next-line no-console
        console.error(
          'Failed to create offline order items',
          itemsError.message,
        );
      }
    }

    return {
      id: order.id as string,
      order_number: String(order.order_number ?? order.id),
    };
  }

  async bulkDeleteOrders(orderIds: string[]): Promise<{ deleted: number }> {
    if (!orderIds || orderIds.length === 0) {
      return { deleted: 0 };
    }

    const client = this.supabase.getClient();
    // First delete any payment links pointing at these orders to satisfy FKs
    const { error: plError } = await client
      .from('payment_links')
      .delete()
      .in('order_id', orderIds);

    if (plError) {
      throw new BadRequestException(
        `Failed to delete payment links for orders: ${plError.message}`,
      );
    }

    const { error, count } = await client
      .from('orders')
      .delete({ count: 'exact' })
      .in('id', orderIds);

    if (error) {
      throw new BadRequestException(
        `Failed to delete orders: ${error.message}`,
      );
    }

    return { deleted: count || 0 };
  }

  async approveOrderInspection(
    orderId: string,
    input: {
      inspectionStatus: 'approved' | 'rejected';
      approvalNotes?: string;
      adminUserId: string;
      itemAdjustments?: {
        id: string;
        unit_price?: number;
        quantity?: number;
      }[];
    },
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    // Load order
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found');
    }

    // Only allow approval once order is at least accepted/processing/shipped
    const status = (order.status as string) ?? 'pending';
    if (!['accepted', 'processing', 'shipped', 'delivered'].includes(status)) {
      throw new BadRequestException(
        `Order must be accepted or in transit before inspection approval (current status: ${status})`,
      );
    }

    // Load items
    const { data: items, error: itemsError } = await client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      throw new BadRequestException(
        `Failed to load order items: ${itemsError.message}`,
      );
    }

    const itemsArray = (items || []) as any[];

    // Apply optional per-line adjustments and recompute totals
    const adjustmentsById = new Map<
      string,
      { unit_price?: number; quantity?: number }
    >();
    (input.itemAdjustments || []).forEach((adj) => {
      adjustmentsById.set(adj.id, {
        unit_price: adj.unit_price,
        quantity: adj.quantity,
      });
    });

    let newSubtotal = 0;

    for (const item of itemsArray) {
      const adj = adjustmentsById.get(item.id as string);
      const unitPrice =
        typeof adj?.unit_price === 'number' ? adj.unit_price : item.unit_price;
      const quantity =
        typeof adj?.quantity === 'number' ? adj.quantity : item.quantity;
      const totalPrice = Number(unitPrice) * Number(quantity);

      newSubtotal += totalPrice;

      if (adj) {
        const { error: updateError } = await client
          .from('order_items')
          .update({
            unit_price: unitPrice,
            quantity,
            total_price: totalPrice,
          })
          .eq('id', item.id);

        if (updateError) {
          throw new BadRequestException(
            `Failed to update order item: ${updateError.message}`,
          );
        }
      }
    }

    // If no adjustments were provided, keep existing subtotal
    if (!input.itemAdjustments || input.itemAdjustments.length === 0) {
      newSubtotal = Number(order.subtotal ?? 0);
    }

    const taxAmount = Number(order.tax_amount ?? 0);
    const shippingAmount = Number(order.shipping_amount ?? 0);
    const discountAmount = Number(order.discount_amount ?? 0);
    const newTotal = newSubtotal + taxAmount + shippingAmount - discountAmount;

    const nowIso = new Date().toISOString();

    const { error: updateOrderError } = await client
      .from('orders')
      .update({
        subtotal: newSubtotal,
        total_amount: newTotal,
        inspection_status: input.inspectionStatus,
        approved_at: nowIso,
        approved_by_admin_id: input.adminUserId,
        approval_notes: input.approvalNotes ?? null,
      })
      .eq('id', orderId);

    if (updateOrderError) {
      throw new BadRequestException(
        `Failed to update order with inspection approval: ${updateOrderError.message}`,
      );
    }

    // Append timeline entry
    const title =
      input.inspectionStatus === 'approved'
        ? 'Inspection approved'
        : 'Inspection rejected';

    const description =
      input.inspectionStatus === 'approved'
        ? 'Admin approved delivery after inspection'
        : 'Admin rejected delivery after inspection';

    const { error: timelineError } = await client
      .from('order_timeline')
      .insert({
        order_id: orderId,
        event_type: 'inspection_' + input.inspectionStatus,
        title,
        description,
        actor_user_id: input.adminUserId,
        actor_type: 'admin',
        metadata: {
          subtotal_before: Number(order.subtotal ?? 0),
          subtotal_after: newSubtotal,
          total_before: Number(order.total_amount ?? 0),
          total_after: newTotal,
        },
        is_visible_to_buyer: true,
        is_visible_to_seller: true,
      });

    if (timelineError) {
      throw new BadRequestException(
        `Failed to append order timeline: ${timelineError.message}`,
      );
    }

    // Create clearing transactions (buyer settlement + farmer payout)
    await this.clearing.createClearingTransactions(orderId);

    return { success: true };
  }

  async listBuyerSettlements(query: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    return this.clearing.listBuyerSettlements(query);
  }

  async listFarmerPayouts(query: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    return this.clearing.listFarmerPayouts(query);
  }

  async markBuyerSettlementCompleted(
    transactionId: string,
    input: { bank_reference?: string; proof_url?: string },
  ): Promise<{ success: boolean }> {
    return this.clearing.markBuyerSettlementCompleted({
      transactionId,
      bankReference: input.bank_reference,
      proofUrl: input.proof_url,
    });
  }

  async markFarmerPayoutCompleted(
    transactionId: string,
    input: { proof_url?: string },
  ): Promise<{ success: boolean }> {
    return this.clearing.markFarmerPayoutCompleted({
      transactionId,
      proofUrl: input.proof_url,
    });
  }

  async getOrderDetail(orderId: string): Promise<{
    order: AdminOrderSummary & {
      subtotal: number;
      taxAmount: number;
      shippingAmount: number;
      discountAmount: number;
      shippingAddress: any;
      billingAddress: any;
      estimatedDeliveryDate?: string | null;
      trackingNumber?: string | null;
      shippingMethod?: string | null;
    };
    buyerOrganization: AdminOrganizationSummary | null;
    sellerOrganization: AdminOrganizationSummary | null;
    items: DatabaseOrderItem[];
    timeline: DatabaseOrderTimeline[];
  }> {
    const client = this.supabase.getClient();

    const { data: order, error: orderError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException('Order not found');
    }

    const buyerOrgId = order.buyer_org_id as string | null;
    const sellerOrgId = order.seller_org_id as string | null;

    const driverUserId = (order.driver_user_id as string | null) ?? null;
    const assignedDriverAt =
      (order.assigned_driver_at as string | null) ?? null;

    let driverName: string | null = null;

    if (driverUserId) {
      const { data: driver, error: driverError } = await client
        .from('users')
        .select('fullname')
        .eq('id', driverUserId)
        .single();

      if (!driverError && driver) {
        driverName = ((driver as any).fullname as string | null) ?? null;
      }
    }

    const [buyerOrganization, sellerOrganization] = await Promise.all([
      buyerOrgId
        ? this.getOrganizationById('buyer', buyerOrgId)
        : Promise.resolve(null),
      sellerOrgId
        ? this.getOrganizationById('seller', sellerOrgId)
        : Promise.resolve(null),
    ]);

    const { data: items, error: itemsError } = await client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      throw new BadRequestException(
        `Failed to load order items: ${itemsError.message}`,
      );
    }

    const { data: timeline, error: timelineError } = await client
      .from('order_timeline')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (timelineError) {
      throw new BadRequestException(
        `Failed to load order timeline: ${timelineError.message}`,
      );
    }

    const orderSummary: AdminOrderSummary & {
      subtotal: number;
      taxAmount: number;
      shippingAmount: number;
      discountAmount: number;
      shippingAddress: any;
      billingAddress: any;
      estimatedDeliveryDate?: string | null;
      trackingNumber?: string | null;
      shippingMethod?: string | null;
    } = {
      id: order.id as string,
      orderNumber: String(order.order_number ?? order.id),
      status: order.status as string,
      paymentStatus: order.payment_status as string,
      totalAmount: Number(order.total_amount ?? 0),
      currency: (order.currency as string) ?? 'XCD',
      createdAt: order.created_at as string,
      buyerOrgId: buyerOrgId ?? undefined,
      buyerOrgName: buyerOrganization?.name ?? null,
      sellerOrgId: sellerOrgId ?? undefined,
      sellerOrgName: sellerOrganization?.name ?? null,
      driverUserId,
      driverName,
      assignedDriverAt,
      subtotal: Number(order.subtotal ?? 0),
      taxAmount: Number(order.tax_amount ?? 0),
      shippingAmount: Number(order.shipping_amount ?? 0),
      discountAmount: Number(order.discount_amount ?? 0),
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      estimatedDeliveryDate:
        (order.estimated_delivery_date as string | null) ?? null,
      trackingNumber: (order.tracking_number as string | null) ?? null,
      shippingMethod: (order.shipping_method as string | null) ?? null,
    };

    return {
      order: orderSummary,
      buyerOrganization,
      sellerOrganization,
      items: (items || []) as DatabaseOrderItem[],
      timeline: (timeline || []) as DatabaseOrderTimeline[],
    };
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to update order status: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return { success: true };
  }

  async updateOrderPaymentStatus(
    orderId: string,
    dto: { payment_status: string; note?: string; reference?: string },
    adminUserId: string,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data: existing, error: loadError } = await client
      .from('orders')
      .select('id, order_number, payment_status, buyer_user_id')
      .eq('id', orderId)
      .single();

    if (loadError || !existing) {
      throw new BadRequestException('Order not found');
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, any> = {
      payment_status: dto.payment_status,
    };

    if (dto.payment_status === 'paid') {
      update.paid_at = nowIso;
    }

    const { error: updateError } = await client
      .from('orders')
      .update(update)
      .eq('id', orderId);

    if (updateError) {
      throw new BadRequestException(
        `Failed to update order payment status: ${updateError.message}`,
      );
    }

    await client.from('order_timeline').insert({
      order_id: orderId,
      event_type: 'payment_status_updated_admin',
      description: `Payment status updated to ${dto.payment_status} by admin`,
      metadata: {
        previous: existing.payment_status,
        next: dto.payment_status,
        admin_user_id: adminUserId,
        note: dto.note ?? null,
        reference: dto.reference ?? null,
      },
    });

    // Notify buyer via WhatsApp when payment becomes paid (if paired)
    if (dto.payment_status === 'paid' && existing.buyer_user_id) {
      const { data: buyer } = await client
        .from('users')
        .select('id, phone_number')
        .eq('id', existing.buyer_user_id as string)
        .not('phone_number', 'is', null)
        .single();

      if (buyer?.phone_number) {
        const phoneE164 = String(buyer.phone_number);
        const orderNumber = String(existing.order_number || orderId);
        await this.waTemplates.sendOrderUpdateIfPaired(
          buyer.id,
          phoneE164,
          orderNumber,
          'paid',
          undefined,
          'en',
        );
      }
    }

    return { success: true };
  }

  async assignDriver(
    orderId: string,
    driverId: string,
  ): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    // Validate driver exists and is a driver account
    const { data: driver, error: driverError } = await client
      .from('users')
      .select('id, individual_account_type, is_active')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      throw new NotFoundException('Driver not found');
    }

    if (
      (driver.individual_account_type as string | null) !== 'driver' ||
      !driver.is_active
    ) {
      throw new BadRequestException('Selected user is not an active driver');
    }

    const { data, error } = await client
      .from('orders')
      .update({
        driver_user_id: driverId,
        assigned_driver_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to assign driver: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return { success: true };
  }

  // ===== Admin products (catalog) =====

  async listAdminProducts(query: AdminProductQueryDto): Promise<{
    items: AdminProductResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, category, page = 1, limit = 20 } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const client = this.supabase.getClient();

    let builder = client
      .from('admin_products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (category) {
      builder = builder.eq('category', category);
    }
    if (search) {
      builder = builder.ilike('name', `%${search}%`);
    }

    builder = builder.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await builder;

    if (error) {
      throw new BadRequestException(
        `Failed to list admin products: ${error.message}`,
      );
    }

    const items: AdminProductResponseDto[] =
      (data || []).map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        category: (p.category as ProductCategory | null) ?? null,
        unit: p.unit as ProductUnit,
        basePrice: Number(p.base_price ?? 0),
        markupPercent: Number(p.markup_percent ?? 0),
        minSellerPrice:
          p.min_seller_price != null ? Number(p.min_seller_price) : null,
        maxSellerPrice:
          p.max_seller_price != null ? Number(p.max_seller_price) : null,
        shortDescription: (p.short_description as string | null) ?? null,
        longDescription: (p.long_description as string | null) ?? null,
        imageUrls: (p.image_urls as string[] | null) ?? [],
        isActive: Boolean(p.is_active),
        createdAt: p.created_at as string,
      })) ?? [];

    return {
      items,
      total: count || 0,
      page,
      limit,
    };
  }

  async getAdminProductById(id: string): Promise<AdminProductResponseDto> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('admin_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Admin product not found');
    }

    return {
      id: data.id as string,
      name: data.name as string,
      category: (data.category as ProductCategory | null) ?? null,
      unit: data.unit as ProductUnit,
      basePrice: Number(data.base_price ?? 0),
      markupPercent: Number(data.markup_percent ?? 0),
      minSellerPrice:
        data.min_seller_price != null ? Number(data.min_seller_price) : null,
      maxSellerPrice:
        data.max_seller_price != null ? Number(data.max_seller_price) : null,
      shortDescription: (data.short_description as string | null) ?? null,
      longDescription: (data.long_description as string | null) ?? null,
      imageUrls: (data.image_urls as string[] | null) ?? [],
      isActive: Boolean(data.is_active),
      createdAt: data.created_at as string,
    };
  }

  async createAdminProduct(
    dto: CreateAdminProductDto,
  ): Promise<AdminProductResponseDto> {
    const client = this.supabase.getClient();

    const imageUrls =
      (dto.imageUrls && dto.imageUrls.length > 0
        ? dto.imageUrls.slice(0, 5)
        : []) ?? [];

    const { data, error } = await client
      .from('admin_products')
      .insert({
        name: dto.name,
        category: dto.category ?? null,
        unit: dto.unit,
        base_price: dto.basePrice,
        markup_percent: dto.markupPercent,
        min_seller_price: dto.minSellerPrice ?? null,
        max_seller_price: dto.maxSellerPrice ?? null,
        short_description: dto.shortDescription ?? null,
        long_description: dto.longDescription ?? null,
        image_urls: imageUrls,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to create admin product: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return {
      id: data.id as string,
      name: data.name as string,
      category: (data.category as ProductCategory | null) ?? null,
      unit: data.unit as ProductUnit,
      basePrice: Number(data.base_price ?? 0),
      markupPercent: Number(data.markup_percent ?? 0),
      shortDescription: (data.short_description as string | null) ?? null,
      longDescription: (data.long_description as string | null) ?? null,
      imageUrls: (data.image_urls as string[] | null) ?? [],
      isActive: Boolean(data.is_active),
      createdAt: data.created_at as string,
    };
  }

  async updateAdminProduct(
    id: string,
    dto: UpdateAdminProductDto,
  ): Promise<AdminProductResponseDto> {
    const client = this.supabase.getClient();

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.unit !== undefined) patch.unit = dto.unit;
    if (dto.basePrice !== undefined) patch.base_price = dto.basePrice;
    if (dto.markupPercent !== undefined)
      patch.markup_percent = dto.markupPercent;
    if (dto.minSellerPrice !== undefined) {
      patch.min_seller_price = dto.minSellerPrice;
    }
    if (dto.maxSellerPrice !== undefined) {
      patch.max_seller_price = dto.maxSellerPrice;
    }
    if (dto.shortDescription !== undefined)
      patch.short_description = dto.shortDescription;
    if (dto.longDescription !== undefined)
      patch.long_description = dto.longDescription;
    if (dto.imageUrls !== undefined)
      patch.image_urls = dto.imageUrls ? dto.imageUrls.slice(0, 5) : [];
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const { data, error } = await client
      .from('admin_products')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to update admin product: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return {
      id: data.id as string,
      name: data.name as string,
      category: (data.category as ProductCategory | null) ?? null,
      unit: data.unit as ProductUnit,
      basePrice: Number(data.base_price ?? 0),
      markupPercent: Number(data.markup_percent ?? 0),
      shortDescription: (data.short_description as string | null) ?? null,
      longDescription: (data.long_description as string | null) ?? null,
      imageUrls: (data.image_urls as string[] | null) ?? [],
      isActive: Boolean(data.is_active),
      createdAt: data.created_at as string,
    };
  }

  async deleteAdminProduct(id: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('admin_products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(
        `Failed to delete admin product: ${error.message}`,
      );
    }

    return { success: true };
  }

  // ===== Drivers (individual accounts) =====

  async listDrivers(): Promise<AdminDriverResponseDto[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('users')
      .select(
        'id, email, fullname, phone_number, profile_img, user_identification_img, is_active, last_login, created_at, individual_account_type',
      )
      .eq('individual_account_type', 'driver')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to list drivers: ${error.message}`);
    }

    return (
      data?.map((u: any) => ({
        id: u.id as string,
        email: u.email as string,
        fullname: u.fullname as string,
        phoneNumber: (u.phone_number as string | null) ?? null,
        profileImg: (u.profile_img as string | null) ?? null,
        driverLicenseImg: (u.user_identification_img as string | null) ?? null,
        isActive: Boolean(u.is_active),
        lastLogin: (u.last_login as string | null) ?? null,
        createdAt: u.created_at as string,
      })) ?? []
    );
  }

  async getDriverById(id: string): Promise<AdminDriverResponseDto> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('users')
      .select(
        'id, email, fullname, phone_number, profile_img, user_identification_img, is_active, last_login, created_at, individual_account_type',
      )
      .eq('id', id)
      .single();

    if (error || !data || data.individual_account_type !== 'driver') {
      throw new NotFoundException('Driver not found');
    }

    return {
      id: data.id as string,
      email: data.email as string,
      fullname: data.fullname as string,
      phoneNumber: (data.phone_number as string | null) ?? null,
      profileImg: (data.profile_img as string | null) ?? null,
      driverLicenseImg: (data.user_identification_img as string | null) ?? null,
      isActive: Boolean(data.is_active),
      lastLogin: (data.last_login as string | null) ?? null,
      createdAt: data.created_at as string,
    };
  }

  async createDriver(dto: CreateDriverDto): Promise<AdminDriverResponseDto> {
    const client = this.supabase.getClient();

    const randomPassword = `drv_${Math.random().toString(36).slice(2, 10)}`;
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

    const { data, error } = await client
      .from('users')
      .insert({
        email: dto.email,
        password: hashedPassword,
        fullname: dto.fullname,
        phone_number: dto.phoneNumber ?? null,
        profile_img: dto.profileImg ?? null,
        user_identification_img: dto.driverLicenseImg ?? null,
        individual_account_type: 'driver',
        email_verified: true,
        is_active: true,
      })
      .select(
        'id, email, fullname, phone_number, profile_img, user_identification_img, is_active, last_login, created_at',
      )
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to create driver: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return {
      id: data.id as string,
      email: data.email as string,
      fullname: data.fullname as string,
      phoneNumber: (data.phone_number as string | null) ?? null,
      profileImg: (data.profile_img as string | null) ?? null,
      driverLicenseImg: (data.user_identification_img as string | null) ?? null,
      isActive: Boolean(data.is_active),
      lastLogin: (data.last_login as string | null) ?? null,
      createdAt: data.created_at as string,
    };
  }

  async updateDriver(
    id: string,
    dto: UpdateDriverDto,
  ): Promise<AdminDriverResponseDto> {
    const client = this.supabase.getClient();

    const patch: Record<string, unknown> = {};
    if (dto.fullname !== undefined) patch.fullname = dto.fullname;
    if (dto.phoneNumber !== undefined) patch.phone_number = dto.phoneNumber;
    if (dto.profileImg !== undefined) patch.profile_img = dto.profileImg;
    if (dto.driverLicenseImg !== undefined) {
      patch.user_identification_img = dto.driverLicenseImg;
    }
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const { data, error } = await client
      .from('users')
      .update(patch)
      .eq('id', id)
      .eq('individual_account_type', 'driver')
      .select(
        'id, email, fullname, phone_number, profile_img, user_identification_img, is_active, last_login, created_at',
      )
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to update driver: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return {
      id: data.id as string,
      email: data.email as string,
      fullname: data.fullname as string,
      phoneNumber: (data.phone_number as string | null) ?? null,
      profileImg: (data.profile_img as string | null) ?? null,
      driverLicenseImg: (data.user_identification_img as string | null) ?? null,
      isActive: Boolean(data.is_active),
      lastLogin: (data.last_login as string | null) ?? null,
      createdAt: data.created_at as string,
    };
  }

  async deleteDriver(id: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('users')
      .update({ is_active: false })
      .eq('id', id)
      .eq('individual_account_type', 'driver');

    if (error) {
      throw new BadRequestException(
        `Failed to delete driver: ${error.message}`,
      );
    }

    // Best-effort removal from Supabase Auth so the driver no longer appears
    // in the Supabase Authentication user list. Failures here should not block
    // the primary soft-delete behaviour.
    await this.supabase.deleteAuthUser(id);

    return { success: true };
  }

  // ===== Platform admin users (staff) =====

  async listAdminUsers(): Promise<AdminUserResponseDto[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('users')
      .select('id, email, fullname, role, is_active, created_at, last_login')
      .in('role', [UserRole.ADMIN, UserRole.SUPER_ADMIN])
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to list admin users: ${error.message}`,
      );
    }

    return (
      data?.map((u: any) => ({
        // eslint-disable-line @typescript-eslint/no-explicit-any
        id: u.id as string,
        email: u.email as string,
        fullname: u.fullname as string,
        role: u.role as UserRole,
        isActive: Boolean(u.is_active),
        createdAt: u.created_at as string,
        lastLogin: (u.last_login as string | null) ?? null,
      })) ?? []
    );
  }

  async createAdminUser(
    dto: CreateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    const client = this.supabase.getClient();

    // Only allow admin or super_admin roles to be created via this endpoint
    if (dto.role !== UserRole.ADMIN && dto.role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Only admin or super_admin roles can be created via this endpoint',
      );
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const { data, error } = await client
      .from('users')
      .insert({
        email: dto.email,
        password: hashedPassword,
        fullname: dto.fullname,
        phone_number: dto.phoneNumber ?? null,
        role: dto.role,
        email_verified: true,
        is_active: true,
      })
      .select('id, email, fullname, role, is_active, created_at')
      .single();

    if (error || !data) {
      // Map unique constraint violation to a friendlier message
      const pgCode = (error as any)?.code as string | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (pgCode === '23505') {
        throw new BadRequestException('A user with this email already exists');
      }

      throw new BadRequestException(
        `Failed to create admin user: ${
          (error as any)?.message ?? 'Unknown error'
        }`,
      );
    }

    return {
      id: data.id as string,
      email: data.email as string,
      fullname: data.fullname as string,
      role: data.role as UserRole,
      isActive: Boolean(data.is_active),
      createdAt: data.created_at as string,
    };
  }

  async updateAdminUser(
    id: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    const client = this.supabase.getClient();

    // Only allow admin or super_admin roles to be assigned via this endpoint
    if (
      dto.role &&
      dto.role !== UserRole.ADMIN &&
      dto.role !== UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'Only admin or super_admin roles can be assigned via this endpoint',
      );
    }

    const patch: Record<string, unknown> = {};

    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.fullname !== undefined) patch.fullname = dto.fullname;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.phoneNumber !== undefined) patch.phone_number = dto.phoneNumber;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    if (dto.password !== undefined) {
      const saltRounds = 12;
      patch.password = await bcrypt.hash(dto.password, saltRounds);
    }

    const { data, error } = await client
      .from('users')
      .update(patch)
      .eq('id', id)
      .in('role', [UserRole.ADMIN, UserRole.SUPER_ADMIN])
      .select('id, email, fullname, role, is_active, created_at, last_login')
      .single();

    if (error || !data) {
      // Map unique constraint violation to a friendlier message
      const pgCode = (error as any)?.code as string | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (pgCode === '23505') {
        throw new BadRequestException('A user with this email already exists');
      }

      throw new BadRequestException(
        `Failed to update admin user: ${
          (error as any)?.message ?? 'Unknown error'
        }`,
      );
    }

    return {
      id: data.id as string,
      email: data.email as string,
      fullname: data.fullname as string,
      role: data.role as UserRole,
      isActive: Boolean(data.is_active),
      createdAt: data.created_at as string,
      lastLogin: (data.last_login as string | null) ?? null,
    };
  }

  async deleteAdminUser(id: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('users')
      .update({ is_active: false })
      .eq('id', id)
      .in('role', [UserRole.ADMIN, UserRole.SUPER_ADMIN])
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Failed to delete admin user: ${error?.message ?? 'Unknown error'}`,
      );
    }

    // Best-effort removal from Supabase Auth so the admin no longer appears
    // in the Supabase Authentication user list. Failures here should not
    // block the primary soft-delete behaviour.
    await this.supabase.deleteAuthUser(id);

    return { success: true };
  }

  // ===== User WhatsApp helpers (admin-triggered) =====

  /**
   * Update a user's phone_number without triggering any WhatsApp sends.
   * The admin must separately call the start-bot or prompt endpoints
   * to initiate WhatsApp messages.
   */
  async updateUserPhone(
    userId: string,
    phoneNumber: string,
  ): Promise<{ success: boolean; phoneNumber: string }> {
    const normalized = this.normalizePhoneNumber(phoneNumber);

    const client = this.supabase.getClient();
    const { error } = await client
      .from('users')
      .update({ phone_number: normalized })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException(
        `Failed to update user phone: ${error.message}`,
      );
    }

    return { success: true, phoneNumber: normalized };
  }

  async startUserWhatsAppBot(userId: string): Promise<{ success: boolean }> {
    await this.whatsapp.startBotForUser(userId);
    return { success: true };
  }

  async sendUserWhatsAppPrompt(
    userId: string,
    template: string,
    variables: Record<string, string> = {},
  ): Promise<{ success: boolean }> {
    await this.whatsapp.sendAdminPromptForUser(userId, template, variables);
    return { success: true };
  }

  /**
   * Very lightweight normalization for admin-provided phone numbers.
   * Delegates full validation to WhatsappService when sending.
   */
  private normalizePhoneNumber(input: string): string {
    const trimmed = String(input || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Phone number is required');
    }
    // Keep as-is; WhatsappService.normalizePhoneE164 will validate on send.
    return trimmed;
  }

  // ===== Admin-led onboarding for buyers and sellers =====

  async createSellerFarmersIdSignedUpload(
    organizationId: string,
    filename: string,
  ): Promise<FarmersIdUploadUrlResponseDto> {
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';
    const bucket = this.privateBucket;
    const objectPath = `ids/farmers/${organizationId}/${crypto.randomUUID()}.${ext}`;

    try {
      const signed = await this.supabase.createSignedUploadUrl(
        bucket,
        objectPath,
      );

      const client = this.supabase.getClient();
      const { error } = await client
        .from('organizations')
        .update({
          farmers_id: objectPath,
          farmers_id_verified: false,
        })
        .eq('id', organizationId)
        .eq('account_type', 'seller');

      if (error) {
        throw new BadRequestException(
          `Failed to update organization with farmer ID path: ${error.message}`,
        );
      }

      return {
        bucket,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      };
    } catch (e) {
      throw new BadRequestException('Failed to create signed upload URL');
    }
  }

  async createSellerLogoSignedUpload(
    organizationId: string,
    filename: string,
  ): Promise<LogoUploadUrlResponseDto> {
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';
    const bucket = 'public';
    const objectPath = `logos/organizations/${organizationId}/${crypto.randomUUID()}.${ext}`;

    // Ensure bucket exists and is public
    await this.supabase.ensureBucketExists(bucket, true);

    try {
      const signed = await this.supabase.createSignedUploadUrl(
        bucket,
        objectPath,
      );

      const publicUrl = this.supabase.getPublicUrl(bucket, objectPath);

      const client = this.supabase.getClient();
      const { error } = await client
        .from('organizations')
        .update({
          logo_url: publicUrl,
        })
        .eq('id', organizationId)
        .eq('account_type', 'seller');

      if (error) {
        throw new BadRequestException(
          `Failed to update organization with logo URL: ${error.message}`,
        );
      }

      return {
        bucket,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      };
    } catch (e) {
      throw new BadRequestException('Failed to create signed upload URL');
    }
  }

  async createSellerHeaderImageSignedUpload(
    organizationId: string,
    filename: string,
  ): Promise<LogoUploadUrlResponseDto> {
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';
    const bucket = 'public';
    const objectPath = `headers/organizations/${organizationId}/${crypto.randomUUID()}.${ext}`;

    // Ensure bucket exists and is public
    await this.supabase.ensureBucketExists(bucket, true);

    try {
      const signed = await this.supabase.createSignedUploadUrl(
        bucket,
        objectPath,
      );

      const publicUrl = this.supabase.getPublicUrl(bucket, objectPath);

      const client = this.supabase.getClient();
      const { error } = await client
        .from('organizations')
        .update({
          // Column expected to store public header image URL for marketplace seller profile
          header_image_url: publicUrl,
        })
        .eq('id', organizationId)
        .eq('account_type', 'seller');

      if (error) {
        throw new BadRequestException(
          `Failed to update organization with header image URL: ${error.message}`,
        );
      }

      return {
        bucket,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      };
    } catch (e) {
      throw new BadRequestException('Failed to create signed upload URL');
    }
  }

  async createBuyerFromAdmin(input: {
    adminEmail: string;
    adminFullname: string;
    password: string;
    businessName: string;
    country?: string;
    businessType?: string;
    phoneNumber?: string;
  }): Promise<{ organizationId: string; userId: string }> {
    const client = this.supabase.getClient();

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(input.password, saltRounds);

    const { data: user, error: userError } = await client
      .from('users')
      .insert({
        email: input.adminEmail,
        password: hashedPassword,
        fullname: input.adminFullname,
        individual_account_type: 'buyer',
        phone_number: input.phoneNumber ?? null,
        country: input.country ?? null,
        email_verified: true,
        is_active: true,
      })
      .select('id, email, fullname')
      .single();

    if (userError || !user) {
      throw new BadRequestException(
        `Failed to create buyer admin user: ${
          userError?.message ?? 'unknown error'
        }`,
      );
    }

    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        name: input.businessName,
        business_name: input.businessName,
        account_type: 'buyer',
        business_type: input.businessType || 'general',
        country: input.country ?? null,
        phone_number: input.phoneNumber ?? null,
        status: 'pending_verification',
      })
      .select('id')
      .single();

    if (orgError || !org) {
      throw new BadRequestException(
        `Failed to create buyer organization: ${
          orgError?.message ?? 'unknown error'
        }`,
      );
    }

    await this.supabase.ensureCreatorIsOrganizationAdmin(
      user.id as string,
      org.id as string,
    );

    // Fire-and-forget email notification
    const frontendUrl = this.configService.get<string>('app.frontendUrl') || '';
    const loginUrl = `${frontendUrl}/login`;
    const htmlBody = `
        <h2>Hi ${input.adminFullname},</h2>
        <p>A Procur buyer account has been created for you for <strong>${input.businessName}</strong>.</p>
        <p>You can sign in with this email address and the password provided by your admin.</p>
        <p style="margin-top: 16px;">
          <a href="${loginUrl}" class="button">Go to Procur login</a>
        </p>
    `;
    const textBody = `Hi ${input.adminFullname},

A Procur buyer account has been created for you for "${input.businessName}".

You can sign in with this email address and the password provided by your admin.

Login here: ${loginUrl}
`;

    void this.email.sendBrandedEmail(
      input.adminEmail,
      'Your Procur buyer account has been created',
      'Your Procur buyer account has been created',
      htmlBody,
      textBody,
    );

    // Optionally start WhatsApp bot if a phone number is present
    if (input.phoneNumber) {
      try {
        await this.whatsapp.startBotForUser(user.id as string);
      } catch {
        // Ignore WhatsApp failures during onboarding
      }
    }

    return { organizationId: org.id as string, userId: user.id as string };
  }

  async createSellerFromAdmin(input: {
    adminEmail: string;
    adminFullname: string;
    password: string;
    businessName: string;
    country?: string;
    businessType?: string;
    phoneNumber?: string;
  }): Promise<{ organizationId: string; userId: string }> {
    const client = this.supabase.getClient();

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(input.password, saltRounds);

    const { data: user, error: userError } = await client
      .from('users')
      .insert({
        email: input.adminEmail,
        password: hashedPassword,
        fullname: input.adminFullname,
        individual_account_type: 'seller',
        phone_number: input.phoneNumber ?? null,
        country: input.country ?? null,
        email_verified: true,
        is_active: true,
      })
      .select('id, email, fullname')
      .single();

    if (userError || !user) {
      throw new BadRequestException(
        `Failed to create seller admin user: ${
          userError?.message ?? 'unknown error'
        }`,
      );
    }

    const { data: org, error: orgError } = await client
      .from('organizations')
      .insert({
        name: input.businessName,
        business_name: input.businessName,
        account_type: 'seller',
        business_type: input.businessType || 'farmers',
        country: input.country ?? null,
        phone_number: input.phoneNumber ?? null,
        status: 'pending_verification',
      })
      .select('id')
      .single();

    if (orgError || !org) {
      throw new BadRequestException(
        `Failed to create seller organization: ${
          orgError?.message ?? 'unknown error'
        }`,
      );
    }

    await this.supabase.ensureCreatorIsOrganizationAdmin(
      user.id as string,
      org.id as string,
    );

    const frontendUrl = this.configService.get<string>('app.frontendUrl') || '';
    const loginUrl = `${frontendUrl}/login`;
    const htmlBody = `
        <h2>Hi ${input.adminFullname},</h2>
        <p>A Procur seller account has been created for you for <strong>${input.businessName}</strong>.</p>
        <p>You can sign in with this email address and the password provided by your admin.</p>
        <p style="margin-top: 16px;">
          <a href="${loginUrl}" class="button">Go to Procur login</a>
        </p>
    `;
    const textBody = `Hi ${input.adminFullname},

A Procur seller account has been created for you for "${input.businessName}".

You can sign in with this email address and the password provided by your admin.

Login here: ${loginUrl}
`;

    void this.email.sendBrandedEmail(
      input.adminEmail,
      'Your Procur seller account has been created',
      'Your Procur seller account has been created',
      htmlBody,
      textBody,
    );

    if (input.phoneNumber) {
      try {
        await this.whatsapp.startBotForUser(user.id as string);
      } catch {
        // Ignore WhatsApp failures during onboarding
      }
    }

    return { organizationId: org.id as string, userId: user.id as string };
  }
}
