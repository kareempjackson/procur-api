import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import {
  CreateTableDto,
  UpdateTableDto,
  TableDto,
  TableQueryDto,
} from './dto/table.dto';
import {
  CreateChartDto,
  UpdateChartDto,
  ChartDto,
  ChartQueryDto,
} from './dto/chart.dto';
import {
  CreateReportDto,
  UpdateReportDto,
  ReportDto,
  ReportQueryDto,
  GenerateReportResponseDto,
  ReportStatus,
} from './dto/report.dto';
import {
  DataSourceDto,
  TableDataQueryDto,
  TableDataResponseDto,
  ChartDataQueryDto,
  ChartDataResponseDto,
} from './dto/data.dto';
import {
  RolePermissionDto,
  AvailablePermissionDto,
  AssignPermissionsDto,
  RevokePermissionsDto,
  PermissionChangeLogDto,
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
} from './dto/permissions.dto';

@Injectable()
export class GovernmentService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ==================== HELPER METHODS ====================

  private async validateGovernmentAccess(
    organizationId: string | undefined,
  ): Promise<void> {
    if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }
    const org = await this.supabaseService.findOrganizationById(organizationId);
    if (!org || org.account_type !== 'government') {
      throw new ForbiddenException(
        'Access denied: Government organization required',
      );
    }
  }

  private async getGovernmentCountry(
    organizationId: string | undefined,
  ): Promise<string> {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    const org = await this.supabaseService.findOrganizationById(organizationId);
    if (!org?.country) {
      throw new BadRequestException(
        'Government organization must have a country specified',
      );
    }
    return org.country;
  }

  // ==================== PERMISSION MANAGEMENT ====================

  async getRolesAndPermissions(
    organizationId: string | undefined,
  ): Promise<RolePermissionDto[]> {
    await this.validateGovernmentAccess(organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .select(
        `
        id,
        name,
        display_name,
        role_system_permissions!inner(permission_name),
        organization_users(count)
      `,
      )
      .eq('organization_id', organizationId)
      .order('name');

    if (error)
      throw new Error(
        `Failed to fetch roles and permissions: ${error.message}`,
      );

    return (data || []).map((role) => ({
      roleId: role.id,
      roleName: role.name,
      roleDisplayName: role.display_name || role.name,
      permissions: role.role_system_permissions.map(
        (p: any) => p.permission_name,
      ),
      userCount: role.organization_users?.[0]?.count || 0,
    }));
  }

  async getAvailablePermissions(): Promise<AvailablePermissionDto[]> {
    // Define government-specific permissions with descriptions
    const governmentPermissions = [
      {
        name: 'view_government_data',
        displayName: 'View Government Data',
        description: 'View all government data tables, charts, and reports',
        category: 'data_access',
      },
      {
        name: 'manage_government_tables',
        displayName: 'Manage Government Tables',
        description: 'Create, edit, and delete government data tables',
        category: 'data_management',
      },
      {
        name: 'create_government_charts',
        displayName: 'Create Government Charts',
        description: 'Create and manage charts and visualizations',
        category: 'analytics',
      },
      {
        name: 'manage_government_reports',
        displayName: 'Manage Government Reports',
        description: 'Create, edit, and generate government reports',
        category: 'reporting',
      },
      {
        name: 'edit_seller_data',
        displayName: 'Edit Seller Data',
        description: 'Edit seller and farmer data within jurisdiction',
        category: 'regulatory',
      },
      {
        name: 'manage_government_analytics',
        displayName: 'Manage Government Analytics',
        description: 'Access advanced analytics and data insights',
        category: 'analytics',
      },
      {
        name: 'export_government_data',
        displayName: 'Export Government Data',
        description: 'Export data in various formats',
        category: 'data_access',
      },
      {
        name: 'manage_role_permissions',
        displayName: 'Manage Role Permissions',
        description: 'Assign and revoke permissions for other roles',
        category: 'administration',
      },
      // Include some general permissions that might be relevant
      {
        name: 'view_reports',
        displayName: 'View Reports',
        description: 'View generated reports',
        category: 'reporting',
      },
      {
        name: 'export_data',
        displayName: 'Export Data',
        description: 'Export data in various formats',
        category: 'data_access',
      },
      {
        name: 'view_analytics',
        displayName: 'View Analytics',
        description: 'View analytics and insights',
        category: 'analytics',
      },
    ];

    return governmentPermissions;
  }

  async assignPermissions(
    assignPermissionsDto: AssignPermissionsDto,
    user: UserContext,
  ): Promise<{ message: string; assignedPermissions: string[] }> {
    await this.validateGovernmentAccess(user.organizationId);

    // Verify the role belongs to the same organization
    const { data: role, error: roleError } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .select('id, name, organization_id')
      .eq('id', assignPermissionsDto.roleId)
      .eq('organization_id', user.organizationId)
      .single();

    if (roleError || !role) {
      throw new NotFoundException('Role not found in your organization');
    }

    // Prevent assigning manage_role_permissions to non-admin roles
    if (
      assignPermissionsDto.permissions.includes('manage_role_permissions') &&
      role.name !== 'admin'
    ) {
      throw new BadRequestException(
        'manage_role_permissions can only be assigned to admin role',
      );
    }

    const assignedPermissions: string[] = [];
    const errors: string[] = [];

    // Assign each permission
    for (const permission of assignPermissionsDto.permissions) {
      try {
        const { error } = await this.supabaseService
          .getClient()
          .from('role_system_permissions')
          .insert({
            role_id: assignPermissionsDto.roleId,
            permission_name: permission,
            granted_by: user.id,
            granted_at: new Date().toISOString(),
          });

        if (error) {
          if (error.code === '23505') {
            // Unique constraint violation
            errors.push(
              `Permission '${permission}' already assigned to this role`,
            );
          } else {
            errors.push(`Failed to assign '${permission}': ${error.message}`);
          }
        } else {
          assignedPermissions.push(permission);
        }
      } catch (err) {
        errors.push(`Failed to assign '${permission}': ${err.message}`);
      }
    }

    if (assignedPermissions.length === 0 && errors.length > 0) {
      throw new BadRequestException(
        `Failed to assign permissions: ${errors.join(', ')}`,
      );
    }

    return {
      message: `Successfully assigned ${assignedPermissions.length} permission(s) to role '${role.name}'`,
      assignedPermissions,
    };
  }

  async revokePermissions(
    revokePermissionsDto: RevokePermissionsDto,
    user: UserContext,
  ): Promise<{ message: string; revokedPermissions: string[] }> {
    await this.validateGovernmentAccess(user.organizationId);

    // Verify the role belongs to the same organization
    const { data: role, error: roleError } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .select('id, name, organization_id')
      .eq('id', revokePermissionsDto.roleId)
      .eq('organization_id', user.organizationId)
      .single();

    if (roleError || !role) {
      throw new NotFoundException('Role not found in your organization');
    }

    // Prevent revoking manage_role_permissions from admin role
    if (
      revokePermissionsDto.permissions.includes('manage_role_permissions') &&
      role.name === 'admin'
    ) {
      throw new BadRequestException(
        'Cannot revoke manage_role_permissions from admin role',
      );
    }

    const revokedPermissions: string[] = [];

    // Revoke each permission
    for (const permission of revokePermissionsDto.permissions) {
      const { error } = await this.supabaseService
        .getClient()
        .from('role_system_permissions')
        .delete()
        .eq('role_id', revokePermissionsDto.roleId)
        .eq('permission_name', permission);

      if (!error) {
        revokedPermissions.push(permission);
      }
    }

    return {
      message: `Successfully revoked ${revokedPermissions.length} permission(s) from role '${role.name}'`,
      revokedPermissions,
    };
  }

  async getPermissionChangeLog(
    organizationId: string | undefined,
  ): Promise<PermissionChangeLogDto[]> {
    await this.validateGovernmentAccess(organizationId);

    // This is a simplified implementation
    // In a real system, you'd have a dedicated audit log table
    const { data, error } = await this.supabaseService
      .getClient()
      .from('role_system_permissions')
      .select(
        `
        permission_name,
        granted_by,
        granted_at,
        organization_roles!inner(id, name, organization_id),
        users!granted_by(fullname)
      `,
      )
      .eq('organization_roles.organization_id', organizationId)
      .order('granted_at', { ascending: false })
      .limit(100);

    if (error)
      throw new Error(
        `Failed to fetch permission change log: ${error.message}`,
      );

    return (data || []).map((entry: any) => ({
      id: `${entry.organization_roles.id}-${entry.permission_name}`,
      roleId: entry.organization_roles.id,
      roleName: entry.organization_roles.name,
      permissionName: entry.permission_name,
      action: 'granted' as const,
      grantedBy: entry.granted_by,
      grantedByName: entry.users?.fullname || 'System',
      grantedAt: entry.granted_at,
    }));
  }

  async createCustomRole(
    createCustomRoleDto: CreateCustomRoleDto,
    user: UserContext,
  ): Promise<{ message: string; roleId: string }> {
    await this.validateGovernmentAccess(user.organizationId);

    // Check if role name already exists in the organization
    const { data: existingRole } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('name', createCustomRoleDto.name)
      .single();

    if (existingRole) {
      throw new BadRequestException(
        `Role '${createCustomRoleDto.name}' already exists`,
      );
    }

    // Create the role
    const { data: role, error: roleError } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .insert({
        organization_id: user.organizationId,
        name: createCustomRoleDto.name,
        display_name: createCustomRoleDto.displayName,
        description: createCustomRoleDto.description,
        is_default: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (roleError)
      throw new Error(`Failed to create role: ${roleError.message}`);

    // Assign initial permissions if provided
    if (
      createCustomRoleDto.permissions &&
      createCustomRoleDto.permissions.length > 0
    ) {
      await this.assignPermissions(
        {
          roleId: role.id,
          permissions: createCustomRoleDto.permissions,
          reason: 'Initial permissions for custom role',
        },
        user,
      );
    }

    return {
      message: `Custom role '${createCustomRoleDto.name}' created successfully`,
      roleId: role.id,
    };
  }

  async updateCustomRole(
    roleId: string,
    updateCustomRoleDto: UpdateCustomRoleDto,
    user: UserContext,
  ): Promise<void> {
    await this.validateGovernmentAccess(user.organizationId);

    // Verify the role exists and is not a default role
    const { data: role, error: roleError } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .select('id, name, is_default, organization_id')
      .eq('id', roleId)
      .eq('organization_id', user.organizationId)
      .single();

    if (roleError || !role) {
      throw new NotFoundException('Role not found in your organization');
    }

    if (role.is_default) {
      throw new BadRequestException('Cannot update default roles');
    }

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (updateCustomRoleDto.displayName !== undefined) {
      updateData.display_name = updateCustomRoleDto.displayName;
    }
    if (updateCustomRoleDto.description !== undefined) {
      updateData.description = updateCustomRoleDto.description;
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .update(updateData)
      .eq('id', roleId);

    if (error) throw new Error(`Failed to update role: ${error.message}`);
  }

  async deleteCustomRole(
    roleId: string,
    organizationId: string | undefined,
  ): Promise<void> {
    await this.validateGovernmentAccess(organizationId);

    // Verify the role exists and is not a default role
    const { data: role, error: roleError } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .select('id, name, is_default, organization_id')
      .eq('id', roleId)
      .eq('organization_id', organizationId)
      .single();

    if (roleError || !role) {
      throw new NotFoundException('Role not found in your organization');
    }

    if (role.is_default) {
      throw new BadRequestException('Cannot delete default roles');
    }

    // Check if role has assigned users
    const { data: users, error: usersError } = await this.supabaseService
      .getClient()
      .from('organization_users')
      .select('id')
      .eq('role_id', roleId)
      .limit(1);

    if (usersError)
      throw new Error(`Failed to check role usage: ${usersError.message}`);

    if (users && users.length > 0) {
      throw new BadRequestException(
        'Cannot delete role that has assigned users',
      );
    }

    // Delete the role (permissions will be deleted automatically due to CASCADE)
    const { error } = await this.supabaseService
      .getClient()
      .from('organization_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw new Error(`Failed to delete role: ${error.message}`);
  }

  // ==================== DATA SOURCES ====================

  async getDataSources(
    organizationId: string | undefined,
  ): Promise<DataSourceDto[]> {
    await this.validateGovernmentAccess(organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_government_data_sources', { gov_org_id: organizationId });

    if (error)
      throw new Error(`Failed to fetch data sources: ${error.message}`);
    return data || [];
  }

  // ==================== TABLE MANAGEMENT ====================

  async getTables(
    query: TableQueryDto,
    organizationId: string | undefined,
  ): Promise<{
    tables: TableDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.validateGovernmentAccess(organizationId);

    let queryBuilder = this.supabaseService
      .getClient()
      .from('government_tables')
      .select('*', { count: 'exact' })
      .eq('government_org_id', organizationId);

    if (query.search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query.search}%,description.ilike.%${query.search}%`,
      );
    }

    const offset = (query.page - 1) * query.limit;
    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + query.limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) throw new Error(`Failed to fetch tables: ${error.message}`);

    return {
      tables: data || [],
      total: count || 0,
      page: query.page,
      limit: query.limit,
    };
  }

  async getTable(
    id: string,
    organizationId: string | undefined,
  ): Promise<TableDto> {
    await this.validateGovernmentAccess(organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_tables')
      .select('*')
      .eq('id', id)
      .eq('government_org_id', organizationId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Table not found');
    }

    return data;
  }

  async createTable(
    createTableDto: CreateTableDto,
    user: UserContext,
  ): Promise<TableDto> {
    await this.validateGovernmentAccess(user.organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_tables')
      .insert({
        government_org_id: user.organizationId,
        name: createTableDto.name,
        description: createTableDto.description,
        icon: createTableDto.icon,
        color: createTableDto.color,
        data_sources: createTableDto.dataSources,
        fields: createTableDto.fields || [],
        views: createTableDto.views || [
          { id: 'default', name: 'Default View', type: 'table' },
        ],
        is_public: createTableDto.isPublic || false,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create table: ${error.message}`);
    return data;
  }

  async updateTable(
    id: string,
    updateTableDto: UpdateTableDto,
    user: UserContext,
  ): Promise<TableDto> {
    await this.validateGovernmentAccess(user.organizationId);

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (updateTableDto.name !== undefined)
      updateData.name = updateTableDto.name;
    if (updateTableDto.description !== undefined)
      updateData.description = updateTableDto.description;
    if (updateTableDto.icon !== undefined)
      updateData.icon = updateTableDto.icon;
    if (updateTableDto.color !== undefined)
      updateData.color = updateTableDto.color;
    if (updateTableDto.dataSources !== undefined)
      updateData.data_sources = updateTableDto.dataSources;
    if (updateTableDto.fields !== undefined)
      updateData.fields = updateTableDto.fields;
    if (updateTableDto.views !== undefined)
      updateData.views = updateTableDto.views;
    if (updateTableDto.isPublic !== undefined)
      updateData.is_public = updateTableDto.isPublic;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_tables')
      .update(updateData)
      .eq('id', id)
      .eq('government_org_id', user.organizationId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Table not found or update failed');
    }

    return data;
  }

  async deleteTable(
    id: string,
    organizationId: string | undefined,
  ): Promise<void> {
    await this.validateGovernmentAccess(organizationId);

    const { error } = await this.supabaseService
      .getClient()
      .from('government_tables')
      .delete()
      .eq('id', id)
      .eq('government_org_id', organizationId);

    if (error) throw new Error(`Failed to delete table: ${error.message}`);
  }

  // ==================== TABLE DATA ====================

  async getTableData(
    id: string,
    query: TableDataQueryDto,
    organizationId: string | undefined,
  ): Promise<TableDataResponseDto> {
    await this.validateGovernmentAccess(organizationId);

    // Get table configuration
    const table = await this.getTable(id, organizationId);
    const country = await this.getGovernmentCountry(organizationId);

    // Build query based on table configuration
    const data = await this.executeTableQuery(table, query, country);

    return {
      data: data.rows,
      total: data.total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(data.total / query.limit),
      schema: data.schema,
    };
  }

  private async executeTableQuery(
    table: any,
    query: TableDataQueryDto,
    country: string,
  ): Promise<any> {
    const dataSources = table.dataSources;
    if (!dataSources || dataSources.length === 0) {
      return { rows: [], total: 0, schema: {} };
    }

    const primaryDataSource = dataSources[0];

    // Build the query step by step
    let selectQuery = this.supabaseService
      .getClient()
      .from(primaryDataSource.table)
      .select('*', { count: 'exact' });

    // Apply country filter
    if (primaryDataSource.table === 'organizations') {
      selectQuery = selectQuery.eq('country', country);
    }

    // Apply data source filters
    if (primaryDataSource.filters) {
      Object.entries(primaryDataSource.filters).forEach(([key, value]) => {
        selectQuery = selectQuery.eq(key, value);
      });
    }

    // Apply additional filters from query
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        selectQuery = selectQuery.eq(key, value);
      });
    }

    // Apply sorting
    if (query.sort) {
      selectQuery = selectQuery.order(query.sort.field, {
        ascending: query.sort.direction === 'asc',
      });
    }

    // Apply pagination
    const offset = (query.page - 1) * query.limit;
    selectQuery = selectQuery.range(offset, offset + query.limit - 1);

    const { data, error, count } = await selectQuery;

    if (error) throw new Error(`Failed to fetch table data: ${error.message}`);

    return {
      rows: data || [],
      total: count || 0,
      schema: this.buildSchemaFromData(data),
    };
  }

  private buildSchemaFromData(data: any[]): any {
    if (!data || data.length === 0) return {};

    const schema: any = {};
    const sample = data[0];

    Object.keys(sample).forEach((key) => {
      const value = sample[key];
      if (typeof value === 'string') {
        schema[key] = 'text';
      } else if (typeof value === 'number') {
        schema[key] = 'number';
      } else if (typeof value === 'boolean') {
        schema[key] = 'boolean';
      } else if (value instanceof Date) {
        schema[key] = 'date';
      } else {
        schema[key] = 'text';
      }
    });

    return schema;
  }

  async updateTableRecord(
    tableId: string,
    recordId: string,
    updateData: any,
    user: UserContext,
  ): Promise<any> {
    await this.validateGovernmentAccess(user.organizationId);

    // Get table configuration to determine what can be updated
    const table = await this.getTable(tableId, user.organizationId);

    const dataSources = table.dataSources;
    const primaryDataSource = dataSources[0];

    if (
      primaryDataSource.id === 'products' ||
      primaryDataSource.table === 'products'
    ) {
      // Update product
      const { data, error } = await this.supabaseService
        .getClient()
        .from('products')
        .update({
          ...updateData,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update record: ${error.message}`);
      return data;
    }

    throw new BadRequestException('Record type not supported for updates');
  }

  // ==================== CHART MANAGEMENT ====================

  async getCharts(
    query: ChartQueryDto,
    organizationId: string | undefined,
  ): Promise<{ charts: ChartDto[]; total: number }> {
    await this.validateGovernmentAccess(organizationId);

    let queryBuilder = this.supabaseService
      .getClient()
      .from('government_charts')
      .select('*', { count: 'exact' })
      .eq('government_org_id', organizationId);

    if (query.search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query.search}%,description.ilike.%${query.search}%`,
      );
    }

    if (query.tableId) {
      queryBuilder = queryBuilder.eq('table_id', query.tableId);
    }

    if (query.chartType) {
      queryBuilder = queryBuilder.eq('chart_type', query.chartType);
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: false });

    const { data, error, count } = await queryBuilder;

    if (error) throw new Error(`Failed to fetch charts: ${error.message}`);

    return {
      charts: data || [],
      total: count || 0,
    };
  }

  async getChart(
    id: string,
    organizationId: string | undefined,
  ): Promise<ChartDto> {
    await this.validateGovernmentAccess(organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_charts')
      .select('*')
      .eq('id', id)
      .eq('government_org_id', organizationId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Chart not found');
    }

    return data;
  }

  async createChart(
    createChartDto: CreateChartDto,
    user: UserContext,
  ): Promise<ChartDto> {
    await this.validateGovernmentAccess(user.organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_charts')
      .insert({
        government_org_id: user.organizationId,
        table_id: createChartDto.tableId,
        name: createChartDto.name,
        description: createChartDto.description,
        chart_type: createChartDto.chartType,
        config: createChartDto.config || {},
        data_config: createChartDto.dataConfig,
        width: createChartDto.width || 6,
        height: createChartDto.height || 4,
        position: createChartDto.position || { x: 0, y: 0 },
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create chart: ${error.message}`);
    return data;
  }

  async updateChart(
    id: string,
    updateChartDto: UpdateChartDto,
    user: UserContext,
  ): Promise<ChartDto> {
    await this.validateGovernmentAccess(user.organizationId);

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (updateChartDto.name !== undefined)
      updateData.name = updateChartDto.name;
    if (updateChartDto.description !== undefined)
      updateData.description = updateChartDto.description;
    if (updateChartDto.chartType !== undefined)
      updateData.chart_type = updateChartDto.chartType;
    if (updateChartDto.config !== undefined)
      updateData.config = updateChartDto.config;
    if (updateChartDto.dataConfig !== undefined)
      updateData.data_config = updateChartDto.dataConfig;
    if (updateChartDto.width !== undefined)
      updateData.width = updateChartDto.width;
    if (updateChartDto.height !== undefined)
      updateData.height = updateChartDto.height;
    if (updateChartDto.position !== undefined)
      updateData.position = updateChartDto.position;
    if (updateChartDto.isActive !== undefined)
      updateData.is_active = updateChartDto.isActive;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_charts')
      .update(updateData)
      .eq('id', id)
      .eq('government_org_id', user.organizationId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Chart not found or update failed');
    }

    return data;
  }

  async deleteChart(
    id: string,
    organizationId: string | undefined,
  ): Promise<void> {
    await this.validateGovernmentAccess(organizationId);

    const { error } = await this.supabaseService
      .getClient()
      .from('government_charts')
      .delete()
      .eq('id', id)
      .eq('government_org_id', organizationId);

    if (error) throw new Error(`Failed to delete chart: ${error.message}`);
  }

  // ==================== CHART DATA ====================

  async getChartData(
    id: string,
    query: ChartDataQueryDto,
    organizationId: string | undefined,
  ): Promise<ChartDataResponseDto> {
    await this.validateGovernmentAccess(organizationId);

    const chart = await this.getChart(id, organizationId);
    const country = await this.getGovernmentCountry(organizationId);

    // Generate chart data based on configuration
    const data = await this.generateChartData(chart, query, country);

    return {
      data,
      config: chart.dataConfig,
      generatedAt: new Date().toISOString(),
      cacheDuration: 300, // 5 minutes
    };
  }

  private async generateChartData(
    chart: any,
    query: ChartDataQueryDto,
    country: string,
  ): Promise<any[]> {
    // Simplified implementation for demonstration
    if (chart.chart_type === 'line' || chart.chart_type === 'bar') {
      const data: any[] = [];
      const now = new Date();

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        data.push({
          date: date.toISOString().split('T')[0],
          value: Math.floor(Math.random() * 100) + 50,
        });
      }

      return data;
    } else if (chart.chart_type === 'pie') {
      return [
        { category: 'Farmers', value: 45 },
        { category: 'Manufacturers', value: 30 },
        { category: 'Fishermen', value: 15 },
        { category: 'General', value: 10 },
      ];
    } else if (chart.chart_type === 'metric') {
      return [{ value: 1250, label: 'Total Count' }];
    }

    return [];
  }

  // ==================== QUICK ACCESS METHODS ====================

  async getFarmers(organizationId: string | undefined): Promise<any[]> {
    await this.validateGovernmentAccess(organizationId);
    const country = await this.getGovernmentCountry(organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('organizations')
      .select('*')
      .eq('account_type', 'seller')
      .eq('business_type', 'farmers')
      .eq('country', country)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch farmers: ${error.message}`);
    return data || [];
  }

  async getFarmerProducts(
    farmerId: string,
    organizationId: string | undefined,
  ): Promise<any[]> {
    await this.validateGovernmentAccess(organizationId);
    const country = await this.getGovernmentCountry(organizationId);

    // Verify farmer is in the same country
    const { data: farmer, error: farmerError } = await this.supabaseService
      .getClient()
      .from('organizations')
      .select('country')
      .eq('id', farmerId)
      .eq('account_type', 'seller')
      .eq('business_type', 'farmers')
      .single();

    if (farmerError || !farmer || farmer.country !== country) {
      throw new ForbiddenException(
        'Farmer not found or not in your jurisdiction',
      );
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('products')
      .select('*')
      .eq('seller_org_id', farmerId)
      .order('created_at', { ascending: false });

    if (error)
      throw new Error(`Failed to fetch farmer products: ${error.message}`);
    return data || [];
  }

  async updateFarmerProduct(
    farmerId: string,
    productId: string,
    updateData: any,
    user: UserContext,
  ): Promise<any> {
    await this.validateGovernmentAccess(user.organizationId);
    const country = await this.getGovernmentCountry(user.organizationId);

    // Verify farmer is in the same country
    const { data: farmer, error: farmerError } = await this.supabaseService
      .getClient()
      .from('organizations')
      .select('country')
      .eq('id', farmerId)
      .eq('account_type', 'seller')
      .eq('business_type', 'farmers')
      .single();

    if (farmerError || !farmer || farmer.country !== country) {
      throw new ForbiddenException(
        'Farmer not found or not in your jurisdiction',
      );
    }

    // Update the product
    const { data, error } = await this.supabaseService
      .getClient()
      .from('products')
      .update({
        ...updateData,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('seller_org_id', farmerId)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update farmer product: ${error.message}`);
    return data;
  }

  // ==================== REPORT MANAGEMENT ====================

  async getReports(
    query: ReportQueryDto,
    organizationId: string | undefined,
  ): Promise<{ reports: ReportDto[]; total: number }> {
    await this.validateGovernmentAccess(organizationId);

    let queryBuilder = this.supabaseService
      .getClient()
      .from('government_reports')
      .select('*', { count: 'exact' })
      .eq('government_org_id', organizationId);

    if (query.search) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query.search}%,description.ilike.%${query.search}%`,
      );
    }

    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.format) {
      queryBuilder = queryBuilder.eq('format', query.format);
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: false });

    const { data, error, count } = await queryBuilder;

    if (error) throw new Error(`Failed to fetch reports: ${error.message}`);

    return {
      reports: data || [],
      total: count || 0,
    };
  }

  async getReport(
    id: string,
    organizationId: string | undefined,
  ): Promise<ReportDto> {
    await this.validateGovernmentAccess(organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_reports')
      .select('*')
      .eq('id', id)
      .eq('government_org_id', organizationId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Report not found');
    }

    return data;
  }

  async createReport(
    createReportDto: CreateReportDto,
    user: UserContext,
  ): Promise<GenerateReportResponseDto> {
    await this.validateGovernmentAccess(user.organizationId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_reports')
      .insert({
        government_org_id: user.organizationId,
        name: createReportDto.name,
        description: createReportDto.description,
        tables: createReportDto.tables || [],
        charts: createReportDto.charts || [],
        filters: createReportDto.filters || {},
        template: createReportDto.template || {},
        format: createReportDto.format || 'pdf',
        schedule: createReportDto.schedule,
        status: 'draft',
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create report: ${error.message}`);

    return {
      reportId: data.id,
      status: ReportStatus.DRAFT,
      message:
        'Report created successfully. Use the generate endpoint to start generation.',
      estimatedCompletionTime: 120,
    };
  }

  async updateReport(
    id: string,
    updateReportDto: UpdateReportDto,
    user: UserContext,
  ): Promise<ReportDto> {
    await this.validateGovernmentAccess(user.organizationId);

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (updateReportDto.name !== undefined)
      updateData.name = updateReportDto.name;
    if (updateReportDto.description !== undefined)
      updateData.description = updateReportDto.description;
    if (updateReportDto.tables !== undefined)
      updateData.tables = updateReportDto.tables;
    if (updateReportDto.charts !== undefined)
      updateData.charts = updateReportDto.charts;
    if (updateReportDto.filters !== undefined)
      updateData.filters = updateReportDto.filters;
    if (updateReportDto.template !== undefined)
      updateData.template = updateReportDto.template;
    if (updateReportDto.format !== undefined)
      updateData.format = updateReportDto.format;
    if (updateReportDto.schedule !== undefined)
      updateData.schedule = updateReportDto.schedule;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('government_reports')
      .update(updateData)
      .eq('id', id)
      .eq('government_org_id', user.organizationId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Report not found or update failed');
    }

    return data;
  }

  async deleteReport(
    id: string,
    organizationId: string | undefined,
  ): Promise<void> {
    await this.validateGovernmentAccess(organizationId);

    const { error } = await this.supabaseService
      .getClient()
      .from('government_reports')
      .delete()
      .eq('id', id)
      .eq('government_org_id', organizationId);

    if (error) throw new Error(`Failed to delete report: ${error.message}`);
  }

  async generateReport(
    id: string,
    user: UserContext,
  ): Promise<GenerateReportResponseDto> {
    await this.validateGovernmentAccess(user.organizationId);

    // Update report status to generating
    const { error } = await this.supabaseService
      .getClient()
      .from('government_reports')
      .update({
        status: 'generating',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('government_org_id', user.organizationId);

    if (error)
      throw new Error(`Failed to start report generation: ${error.message}`);

    return {
      reportId: id,
      status: ReportStatus.GENERATING,
      message: 'Report generation started successfully',
      estimatedCompletionTime: 120,
    };
  }
}
