import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { AdminOrgQueryDto } from './dto/admin-org-query.dto';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import {
  DatabaseOrderItem,
  DatabaseOrderTimeline,
} from '../database/types/database.types';
import {
  AdminDriverResponseDto,
  CreateDriverDto,
  UpdateDriverDto,
} from './dto/driver.dto';
import { AdminUserResponseDto, CreateAdminUserDto } from './dto/admin-user.dto';
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
import { CreateFarmVisitRequestDto } from '../sellers/dto';

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
  farmersId: string | null;
  farmersIdVerified: boolean;
  farmVerified: boolean;
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

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

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
                    'private',
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
              farmersId,
              farmersIdVerified: Boolean(
                (org as any).farmers_id_verified ?? false,
              ),
              farmVerified: Boolean((org as any).farm_verified ?? false),
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

    // Buyers count
    const { count: buyersCount, error: buyersError } = await client
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'buyer');

    if (buyersError) {
      throw new BadRequestException(
        `Failed to count buyer organizations: ${buyersError.message}`,
      );
    }

    // Sellers count
    const { count: sellersCount, error: sellersError } = await client
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'seller');

    if (sellersError) {
      throw new BadRequestException(
        `Failed to count seller organizations: ${sellersError.message}`,
      );
    }

    // Orders stats
    const { data: orderStatsRaw, error: ordersError } = await client
      .from('orders')
      .select('status, total_amount')
      .in('status', [
        'pending',
        'accepted',
        'processing',
        'shipped',
        'delivered',
        'completed',
        'cancelled',
        'disputed',
      ]);

    const orderStats = ordersError || !orderStatsRaw ? [] : orderStatsRaw;

    let completedOrders = 0;
    let currentOrders = 0;
    let totalVolume = 0;

    (orderStats || []).forEach((o: any) => {
      const status = (o.status as string) ?? '';
      const amount = Number(o.total_amount ?? 0);
      totalVolume += amount;

      if (status === 'delivered' || status === 'completed') {
        completedOrders += 1;
      } else if (status !== 'cancelled' && status !== 'disputed') {
        currentOrders += 1;
      }
    });

    // Platform fees from transactions
    const { data: feeRowsRaw, error: feesError } = await client
      .from('transactions')
      .select('platform_fee');

    const feeRows = feesError || !feeRowsRaw ? [] : feeRowsRaw;

    const totalPlatformFees =
      feeRows.reduce(
        (sum: number, row: any) => sum + Number(row.platform_fee ?? 0),
        0,
      ) ?? 0;

    return {
      totalBuyers: buyersCount || 0,
      totalSellers: sellersCount || 0,
      completedOrders,
      currentOrders,
      totalVolume,
      totalPlatformFees,
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
            'private',
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
      farmersId,
      farmersIdVerified: Boolean((data as any).farmers_id_verified ?? false),
      farmVerified: Boolean((data as any).farm_verified ?? false),
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

    let builder = client
      .from('orders')
      .select(
        'id, order_number, status, payment_status, total_amount, currency, buyer_org_id, seller_org_id, created_at, driver_user_id, assigned_driver_at',
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

    const orders: AdminOrderSummary[] = ordersRaw.map((o) => ({
      id: o.id as string,
      orderNumber: String(o.order_number ?? o.id),
      status: o.status as string,
      paymentStatus: o.payment_status as string,
      totalAmount: Number(o.total_amount ?? 0),
      currency: (o.currency as string) ?? 'XCD',
      createdAt: o.created_at as string,
      buyerOrgId: (o.buyer_org_id as string) ?? undefined,
      buyerOrgName: orgById[(o.buyer_org_id as string) ?? '']?.name ?? null,
      sellerOrgId: (o.seller_org_id as string) ?? undefined,
      sellerOrgName: orgById[(o.seller_org_id as string) ?? '']?.name ?? null,
      driverUserId: (o.driver_user_id as string | null) ?? null,
      driverName: null,
      assignedDriverAt: (o.assigned_driver_at as string | null) ?? null,
    }));

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

    return { success: true };
  }

  // ===== Platform admin users (staff) =====

  async listAdminUsers(): Promise<AdminUserResponseDto[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('users')
      .select('id, email, fullname, role, is_active, created_at')
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
}
