import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DatabaseUser,
  DatabaseOrganization,
  DatabaseOrganizationRole,
  DatabaseOrganizationUser,
  DatabaseUserWithOrganization,
  DatabasePermission,
  CreateUserData,
  CreateOrganizationData,
  UpdateUserData,
} from './types/database.types';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;
  private readonly supabaseUrl: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('database.supabaseUrl');
    const supabaseServiceKey = this.configService.get<string>(
      'database.supabaseServiceRoleKey',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabaseUrl = supabaseUrl;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  getPublicUrl(bucket: string, path: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }

  // Storage helpers
  async ensureBucketExists(
    bucket: string,
    isPublic: boolean = false,
  ): Promise<void> {
    try {
      const { data } = await this.supabase.storage.getBucket(bucket);
      if (data) return; // bucket exists
      const { error } = await this.supabase.storage.createBucket(bucket, {
        public: isPublic,
      });
      if (error) {
        this.logger.error('Error creating bucket:', error);
      }
    } catch (e) {
      // If getBucket is not available in this client version, try list+check
      try {
        const { data: buckets } = await this.supabase.storage.listBuckets();
        if (buckets && buckets.some((b: any) => b.name === bucket)) return;
        const { error } = await this.supabase.storage.createBucket(bucket, {
          public: isPublic,
        });
        if (error) this.logger.error('Error creating bucket:', error);
      } catch (err) {
        this.logger.error('Bucket existence check failed:', err as any);
      }
    }
  }
  async createSignedUploadUrl(
    bucket: string,
    path: string,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    await this.ensureBucketExists(bucket, false);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      this.logger.error('Error creating signed upload URL:', error);
      const status =
        typeof (error as any)?.status === 'number'
          ? (error as any).status
          : Number((error as any)?.statusCode) || 400;
      throw new HttpException(
        (error as any)?.message || 'Failed to create signed upload URL',
        status,
      );
    }

    return data as { signedUrl: string; token: string; path: string };
  }

  async createSignedDownloadUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<{ signedUrl: string }> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      this.logger.error('Error creating signed download URL:', error);
      const status =
        typeof (error as any)?.status === 'number'
          ? (error as any).status
          : Number((error as any)?.statusCode) || 400;
      throw new HttpException(
        (error as any)?.message || 'Failed to create signed download URL',
        status,
      );
    }

    return data as { signedUrl: string };
  }

  // User operations

  /**
   * Delete a user from Supabase Auth (auth.users) using the service role key.
   * This is best-effort and will not throw if the auth user does not exist,
   * so that admin-side delete flows remain resilient.
   */
  async deleteAuthUser(userId: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (this.supabase as any).auth.admin.deleteUser(
        userId,
      );
      if (error) {
        this.logger.error('Error deleting Supabase auth user:', error);
      }
    } catch (err) {
      this.logger.error(
        'Unexpected error while deleting Supabase auth user:',
        err as any,
      );
    }
  }

  async createUser(userData: CreateUserData): Promise<DatabaseUser> {
    const { data, error } = await this.supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }

    return data as DatabaseUser;
  }

  async findUserByEmail(email: string): Promise<DatabaseUser | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found"
      this.logger.error('Error finding user by email:', error);
      throw error;
    }

    return data as DatabaseUser | null;
  }

  async findUserById(id: string): Promise<DatabaseUser | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error finding user by id:', error);
      throw error;
    }

    return data as DatabaseUser | null;
  }

  async findUserByPhoneNumber(phoneE164: string): Promise<DatabaseUser | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneE164)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error finding user by phone number:', error);
      throw error;
    }

    return data as DatabaseUser | null;
  }

  async verifyUserEmail(token: string): Promise<DatabaseUser | null> {
    const { data, error } = await this.supabase
      .from('users')
      .update({
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      })
      .eq('email_verification_token', token)
      .gt('email_verification_expires', new Date().toISOString())
      .select()
      .single();

    if (error) {
      this.logger.error('Error verifying email:', error);
      throw error;
    }

    return data as DatabaseUser | null;
  }

  async updateUserLastLogin(userId: string) {
    const { error } = await this.supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      this.logger.error('Error updating last login:', error);
      throw error;
    }
  }

  async updateUser(
    userId: string,
    updates: UpdateUserData,
  ): Promise<DatabaseUser> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating user:', error);
      throw error;
    }

    return data as DatabaseUser;
  }

  async updateUserPassword(
    userId: string,
    hashedPassword: string,
  ): Promise<DatabaseUser> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ password: hashedPassword } as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating user password:', error);
      throw error;
    }

    return data as DatabaseUser;
  }

  // Organization operations
  async createOrganization(
    orgData: CreateOrganizationData,
  ): Promise<DatabaseOrganization> {
    const { data, error } = await this.supabase
      .from('organizations')
      .insert([orgData])
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating organization:', error);
      throw error;
    }

    return data as DatabaseOrganization;
  }

  async addUserToOrganization(
    userId: string,
    organizationId: string,
    roleId: string,
  ): Promise<DatabaseOrganizationUser> {
    const { data, error } = await this.supabase
      .from('organization_users')
      .insert([
        {
          user_id: userId,
          organization_id: organizationId,
          role_id: roleId,
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error('Error adding user to organization:', error);
      throw error;
    }

    return data as DatabaseOrganizationUser;
  }

  async getOrganizationAdminRole(
    organizationId: string,
  ): Promise<DatabaseOrganizationRole> {
    const { data, error } = await this.supabase
      .from('organization_roles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_admin', true)
      .single();

    if (error) {
      this.logger.error('Error getting admin role:', error);
      throw error;
    }

    return data as DatabaseOrganizationRole;
  }

  async ensureCreatorIsOrganizationAdmin(
    userId: string,
    organizationId: string,
  ): Promise<DatabaseOrganizationUser | null> {
    // First, try to locate the admin role. Since roles are created by a DB trigger
    // on organization insert, add a short retry window in case of slight latency.
    const maxAttempts = 5;
    const delayMs = 150;

    let adminRole: DatabaseOrganizationRole | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data } = await this.supabase
          .from('organization_roles')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('name', 'admin')
          .single();
        if (data) {
          adminRole = data as DatabaseOrganizationRole;
          break;
        }
      } catch (err) {
        // ignore and retry
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (!adminRole) {
      this.logger.error(
        `Admin role not found for organization ${organizationId} after retries`,
      );
      return null;
    }

    // Check if user is already a member
    const { data: existingMembership, error: membershipErr } =
      await this.supabase
        .from('organization_users')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();

    if (membershipErr) {
      this.logger.error('Error checking existing membership:', membershipErr);
      throw membershipErr;
    }

    if (existingMembership) {
      // If exists but not admin, update role to admin
      if (existingMembership.role_id !== adminRole.id) {
        const { data: updated, error: updateErr } = await this.supabase
          .from('organization_users')
          .update({ role_id: adminRole.id, is_active: true })
          .eq('id', existingMembership.id)
          .select()
          .single();
        if (updateErr) {
          this.logger.error('Error elevating user to admin:', updateErr);
          throw updateErr;
        }
        return updated as DatabaseOrganizationUser;
      }
      return existingMembership as DatabaseOrganizationUser;
    }

    // Create membership as admin
    const { data: created, error: createErr } = await this.supabase
      .from('organization_users')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        role_id: adminRole.id,
      })
      .select()
      .single();

    if (createErr) {
      this.logger.error('Error adding creator as admin:', createErr);
      throw createErr;
    }

    return created as DatabaseOrganizationUser;
  }

  // Permission operations
  async getUserPermissions(
    userId: string,
    organizationId?: string,
  ): Promise<DatabasePermission[]> {
    if (!organizationId) {
      return []; // Individual users don't have organization permissions
    }

    const { data, error } = await this.supabase.rpc('get_user_permissions', {
      user_uuid: userId,
      org_uuid: organizationId,
    });

    if (error) {
      this.logger.error('Error getting user permissions:', error);
      throw error;
    }

    return (data as DatabasePermission[]) || [];
  }

  async getUserWithOrganization(
    userId: string,
  ): Promise<DatabaseUserWithOrganization | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select(
        `
        *,
        organization_users!organization_users_user_id_fkey!inner (
          organization_id,
          is_active,
          organization_roles!inner (
            name,
            display_name,
            is_admin
          ),
          organizations!inner (
            id,
            name,
            account_type,
            status
          )
        )
      `,
      )
      .eq('id', userId)
      .eq('organization_users.is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error getting user with organization:', error);
      throw error;
    }

    return data as DatabaseUserWithOrganization | null;
  }

  // Organization lookup methods
  async findOrganizationById(
    organizationId: string,
  ): Promise<DatabaseOrganization | null> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error finding organization by id:', error);
      throw error;
    }

    return data as DatabaseOrganization | null;
  }

  async updateOrganization(
    organizationId: string,
    updates: Partial<DatabaseOrganization>,
  ): Promise<DatabaseOrganization> {
    const { data, error } = await this.supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId)
      .select('*')
      .single();

    if (error) {
      this.logger.error('Error updating organization:', error);
      throw error;
    }

    return data as DatabaseOrganization;
  }
}
