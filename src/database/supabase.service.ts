import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('database.supabaseUrl');
    const supabaseServiceKey = this.configService.get<string>(
      'database.supabaseServiceRoleKey',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

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

  // Storage helpers
  async createSignedUploadUrl(
    bucket: string,
    path: string,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      this.logger.error('Error creating signed upload URL:', error);
      throw error;
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
      throw error;
    }

    return data as { signedUrl: string };
  }

  // User operations
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
