import { BadRequestException, Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { SupabaseService } from '../database/supabase.service';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import {
  CreateFarmersIdUploadUrlDto,
  FarmersIdUploadUrlResponseDto,
} from './dto/farmers-id-upload.dto';
import {
  CreateLogoUploadUrlDto,
  LogoUploadUrlResponseDto,
} from './dto/logo-upload.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  private readonly privateBucket: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.privateBucket =
      this.configService.get<string>('storage.privateBucket') || 'private';
  }

  async getProfile(user: UserContext) {
    let organization: any = null;
    const dbUser = await this.supabase.findUserById(user.id);
    if (user.organizationId) {
      const org = await this.supabase.findOrganizationById(user.organizationId);
      if (org) {
        let farmersIdUrl: string | null = null;
        const farmersIdPath = (org as any).farmers_id ?? null;
        if (farmersIdPath) {
          if (
            typeof farmersIdPath === 'string' &&
            /^https?:\/\//i.test(farmersIdPath)
          ) {
            farmersIdUrl = farmersIdPath;
          } else {
            try {
              const signed = await this.supabase.createSignedDownloadUrl(
                this.privateBucket,
                farmersIdPath,
                60 * 60, // 1 hour,
              );
              farmersIdUrl = signed.signedUrl;
            } catch {
              farmersIdUrl = null;
            }
          }
        }
        organization = {
          id: org.id,
          name: org.name,
          businessName: (org as any).business_name ?? org.name,
          businessType: (org as any).business_type ?? null,
          accountType: (org as any).account_type ?? null,
          address: (org as any).address ?? null,
          city: (org as any).city ?? null,
          state: (org as any).state ?? null,
          postalCode: (org as any).postal_code ?? null,
          country: (org as any).country ?? null,
          taxId: (org as any).tax_id ?? null,
          website: (org as any).website ?? null,
          description: (org as any).description ?? null,
          logoUrl: (org as any).logo_url ?? null,
          farmersIdUrl,
          farmersIdPath: farmersIdPath,
          farmersIdVerified: Boolean((org as any).farmers_id_verified ?? false),
          farmVerified: Boolean((org as any).farm_verified ?? false),
        };
      }
    }

    // Build signed profile avatar URL if stored as path
    let profileAvatarUrl: string | null = null;
    if ((dbUser as any)?.profile_img) {
      const imgPath = (dbUser as any).profile_img as string;
      if (typeof imgPath === 'string' && /^https?:\/\//i.test(imgPath)) {
        profileAvatarUrl = imgPath;
      } else {
        try {
          const signed = await this.supabase.createSignedDownloadUrl(
            this.privateBucket,
            imgPath,
            60 * 60,
          );
          profileAvatarUrl = signed.signedUrl;
        } catch {
          profileAvatarUrl = null;
        }
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accountType: user.accountType,
      emailVerified: user.emailVerified,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole,
      permissions: user.permissions,
      phone_number: (dbUser as any)?.phone_number ?? null,
      fullname: (dbUser as any)?.fullname ?? null,
      avatarUrl: profileAvatarUrl,
      organization,
    };
  }

  async updateProfile(user: UserContext, updateData: UpdateUserProfileDto) {
    const orgUpdates: Record<string, any> = {};
    const userUpdates: Record<string, any> = {};

    if (typeof updateData?.fullname === 'string')
      userUpdates.fullname = updateData.fullname;
    if (typeof updateData?.phone === 'string')
      userUpdates.phone_number = updateData.phone;
    if (typeof updateData?.firstName === 'string')
      userUpdates.first_name = updateData.firstName;
    if (typeof updateData?.lastName === 'string')
      userUpdates.last_name = updateData.lastName;

    if (typeof updateData?.businessName === 'string')
      orgUpdates.business_name = updateData.businessName;
    if (typeof updateData?.name === 'string') orgUpdates.name = updateData.name;
    if (typeof updateData?.businessType === 'string')
      orgUpdates.business_type = updateData.businessType;
    if (typeof updateData?.address === 'string')
      orgUpdates.address = updateData.address;
    if (typeof updateData?.city === 'string') orgUpdates.city = updateData.city;
    if (typeof updateData?.state === 'string')
      orgUpdates.state = updateData.state;
    if (typeof updateData?.postalCode === 'string')
      orgUpdates.postal_code = updateData.postalCode;
    if (typeof updateData?.country === 'string')
      orgUpdates.country = updateData.country;
    if (typeof updateData?.website === 'string')
      orgUpdates.website = updateData.website;
    if (typeof updateData?.description === 'string')
      orgUpdates.description = updateData.description;
    if (typeof (updateData as any)?.farmersIdPath === 'string')
      orgUpdates.farmers_id = (updateData as any).farmersIdPath;
    else if (typeof (updateData as any)?.farmersIdUrl === 'string')
      orgUpdates.farmers_id = (updateData as any).farmersIdUrl;

    if (typeof (updateData as any)?.taxId === 'string')
      orgUpdates.tax_id = (updateData as any).taxId;
    if (typeof (updateData as any)?.registrationNumber === 'string')
      orgUpdates.business_registration_number = (
        updateData as any
      ).registrationNumber;

    if (typeof (updateData as any)?.logoPath === 'string') {
      const bucket = 'public';
      const path = (updateData as any).logoPath as string;
      const publicUrl = this.supabase.getPublicUrl(bucket, path);
      orgUpdates.logo_url = publicUrl;
    }

    // Support avatar path update (stored in users.profile_img)
    if (typeof (updateData as any)?.avatarPath === 'string') {
      userUpdates.profile_img = (updateData as any).avatarPath;
    }

    const results: Record<string, any> = {};
    if (Object.keys(userUpdates).length > 0) {
      results.user = await this.supabase.updateUser(user.id, userUpdates);
    }
    if (Object.keys(orgUpdates).length > 0) {
      if (!user.organizationId)
        throw new BadRequestException('No organization associated with user');
      results.organization = await this.supabase.updateOrganization(
        user.organizationId,
        orgUpdates,
      );
    }

    return { message: 'Profile updated', ...results };
  }

  /**
   * List active members of the current user's organization.
   * Returns basic user + role metadata that the UI can display in the
   * Seller → Business → Team tab.
   */
  async listOrganizationMembers(user: UserContext) {
    if (!user.organizationId) {
      throw new BadRequestException('No organization associated with user');
    }

    const client = this.supabase.getClient();

    // 1) Load all organization_users rows for this org
    const { data: orgUsers, error: orgUsersError } = await client
      .from('organization_users')
      .select('id, organization_id, user_id, role_id, is_active, joined_at')
      .eq('organization_id', user.organizationId)
      .order('joined_at', { ascending: true });

    if (orgUsersError) {
      throw new BadRequestException(
        `Failed to load organization members: ${orgUsersError.message}`,
      );
    }

    if (!orgUsers || orgUsers.length === 0) {
      return [];
    }

    const userIds = Array.from(
      new Set(orgUsers.map((ou: any) => ou.user_id).filter(Boolean)),
    ) as string[];
    const roleIds = Array.from(
      new Set(orgUsers.map((ou: any) => ou.role_id).filter(Boolean)),
    ) as string[];

    // 2) Load users for those ids
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, email, fullname')
      .in('id', userIds);

    if (usersError) {
      throw new BadRequestException(
        `Failed to load organization member users: ${usersError.message}`,
      );
    }

    const usersById = new Map<string, any>();
    (users || []).forEach((u: any) => {
      usersById.set(u.id, u);
    });

    // 3) Load roles metadata
    const { data: roles, error: rolesError } = await client
      .from('organization_roles')
      .select('id, name, display_name')
      .in('id', roleIds);

    if (rolesError) {
      throw new BadRequestException(
        `Failed to load organization roles: ${rolesError.message}`,
      );
    }

    const rolesById = new Map<string, any>();
    (roles || []).forEach((r: any) => {
      rolesById.set(r.id, r);
    });

    // 4) Build response
    return (orgUsers || []).map((ou: any) => {
      const u = usersById.get(ou.user_id);
      const r = rolesById.get(ou.role_id);
      return {
        id: ou.id as string,
        userId: ou.user_id as string,
        email: (u?.email as string) ?? null,
        fullname: (u?.fullname as string) ?? null,
        role: (r?.display_name as string) ?? (r?.name as string) ?? 'Member',
        roleName: (r?.name as string) ?? null,
        joinedAt: (ou.joined_at as string) ?? null,
        isActive: Boolean(ou.is_active),
      };
    });
  }

  /**
   * Invite a teammate by email to join the caller's organization.
   *
   * - If the email already belongs to an existing Procur user, you *may*
   *   still choose to attach them directly; for now we keep the immediate
   *   attach path for existing accounts.
   * - If no user exists yet, we create an organization_invitations row and
   *   send an email with an accept-invitation link. The teammate will create
   *   their account from that link.
   */
  async inviteOrganizationMember(
    user: UserContext,
    payload: { email: string; roleName?: string },
  ) {
    if (!user.organizationId) {
      throw new BadRequestException('No organization associated with user');
    }

    const email = (payload.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const client = this.supabase.getClient();

    // Resolve organization & role up front (used both for membership + invite)
    const org = await this.supabase.findOrganizationById(user.organizationId);
    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const { data: orgRoles, error: rolesError } = await client
      .from('organization_roles')
      .select('id, name, display_name, is_default')
      .eq('organization_id', user.organizationId);

    if (rolesError) {
      throw new BadRequestException(
        `Failed to load organization roles: ${rolesError.message}`,
      );
    }

    if (!orgRoles || orgRoles.length === 0) {
      throw new BadRequestException(
        'No organization roles are configured for this account',
      );
    }

    let roleId: string | undefined;
    if (payload.roleName) {
      roleId = orgRoles.find((r: any) => r.name === payload.roleName)?.id;
    }
    if (!roleId) {
      roleId =
        orgRoles.find((r: any) => r.is_default)?.id || (orgRoles[0] as any).id;
    }

    // Look up target user by email (optional)
    const { data: targetUser, error: targetError } = await client
      .from('users')
      .select('id, email, fullname, is_active')
      .eq('email', email)
      .maybeSingle();

    // If user already exists, keep the simple, immediate attach path
    if (targetUser) {
      if (!targetUser.is_active) {
        throw new BadRequestException(
          'This account is deactivated. Contact support to reactivate.',
        );
      }

      if (targetUser.id === user.id) {
        throw new BadRequestException('You are already a member of this team');
      }

      // Check existing membership
      const { data: existingMembership, error: existingError } = await client
        .from('organization_users')
        .select('id, is_active')
        .eq('organization_id', user.organizationId)
        .eq('user_id', targetUser.id)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new BadRequestException(
          `Failed to check existing membership: ${existingError.message}`,
        );
      }

      if (existingMembership?.is_active) {
        throw new BadRequestException('This user is already on your team');
      }

      // If there is an inactive membership, reactivate it
      if (existingMembership && !existingMembership.is_active) {
        const { error: reactivateError } = await client
          .from('organization_users')
          .update({
            is_active: true,
            joined_at: new Date().toISOString(),
            invited_by: user.id,
          })
          .eq('id', existingMembership.id);

        if (reactivateError) {
          throw new BadRequestException(
            `Failed to reactivate team member: ${reactivateError.message}`,
          );
        }
      } else {
        // Insert new membership
        const { error: insertError } = await client
          .from('organization_users')
          .insert({
            organization_id: user.organizationId,
            user_id: targetUser.id,
            role_id: roleId,
            is_active: true,
            invited_by: user.id,
            joined_at: new Date().toISOString(),
          });

        if (insertError) {
          throw new BadRequestException(
            `Failed to add team member: ${insertError.message}`,
          );
        }
      }

      // Return updated member list when attaching an existing account
      return this.listOrganizationMembers(user);
    }

    // No user exists yet → create an invitation and send email
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error: insertInviteError } = await client
      .from('organization_invitations')
      .insert({
        organization_id: user.organizationId,
        email,
        role_id: roleId,
        inviter_user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertInviteError) {
      throw new BadRequestException(
        `Failed to create invitation: ${insertInviteError.message}`,
      );
    }

    const organizationName =
      (org as any).business_name || (org as any).name || 'your organization';
    const inviterName = user.email;

    await this.emailService.sendOrganizationInvitation(
      email,
      organizationName,
      inviterName,
      token,
    );

    return { success: true };
  }

  async listOrganizationInvitations(user: UserContext) {
    if (!user.organizationId) {
      throw new BadRequestException('No organization associated with user');
    }

    const client = this.supabase.getClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await client
      .from('organization_invitations')
      .select(
        'id, email, role_id, inviter_user_id, expires_at, accepted_at, created_at',
      )
      .eq('organization_id', user.organizationId)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to load invitations: ${error.message}`,
      );
    }

    return data;
  }

  async cancelOrganizationInvitation(user: UserContext, invitationId: string) {
    if (!user.organizationId) {
      throw new BadRequestException('No organization associated with user');
    }

    const client = this.supabase.getClient();

    const { data: invite, error: inviteError } = await client
      .from('organization_invitations')
      .select('id, organization_id, accepted_at')
      .eq('id', invitationId)
      .single();

    if (inviteError || !invite) {
      throw new BadRequestException('Invitation not found');
    }

    if (invite.organization_id !== user.organizationId) {
      throw new BadRequestException('Invalid organization context');
    }

    if (invite.accepted_at) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    const { error: deleteError } = await client
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId);

    if (deleteError) {
      throw new BadRequestException(
        `Failed to revoke invitation: ${deleteError.message}`,
      );
    }

    return { success: true };
  }

  /**
   * Soft-remove an organization member (sets is_active = false).
   * The caller must belong to the same organization.
   */
  async removeOrganizationMember(user: UserContext, orgUserId: string) {
    if (!user.organizationId) {
      throw new BadRequestException('No organization associated with user');
    }

    const client = this.supabase.getClient();

    const { data: membership, error: membershipError } = await client
      .from('organization_users')
      .select('id, organization_id, user_id, is_active')
      .eq('id', orgUserId)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      throw new BadRequestException('Team member not found');
    }

    if (membership.organization_id !== user.organizationId) {
      throw new BadRequestException('Invalid organization context');
    }

    if (!membership.is_active) {
      return { success: true };
    }

    if (membership.user_id === user.id) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const { error: updateError } = await client
      .from('organization_users')
      .update({ is_active: false })
      .eq('id', orgUserId);

    if (updateError) {
      throw new BadRequestException(
        `Failed to remove team member: ${updateError.message}`,
      );
    }

    return { success: true };
  }

  async createAvatarSignedUpload(user: UserContext, filename: string) {
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';
    const bucket = this.privateBucket;
    const objectPath = `avatars/users/${user.id}/${crypto.randomUUID()}.${ext}`;

    try {
      const signed = await this.supabase.createSignedUploadUrl(
        bucket,
        objectPath,
      );
      return {
        bucket,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      };
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 400;
      throw new HttpException('Failed to create signed upload URL', status);
    }
  }

  async adminOnly(user: UserContext) {
    return {
      message: 'This is admin-only data',
      user: user.email,
      role: user.role,
    };
  }

  async getUsersList(user: UserContext) {
    return {
      message: 'Users list functionality to be implemented',
      requesterPermissions: user.permissions,
    };
  }

  async createFarmersIdSignedUpload(
    user: UserContext,
    dto: CreateFarmersIdUploadUrlDto,
  ): Promise<FarmersIdUploadUrlResponseDto> {
    // Ensure the requester belongs to the target organization
    if (!user.organizationId || user.organizationId !== dto.organizationId) {
      throw new BadRequestException('Invalid organization context');
    }

    const ext = dto.filename.includes('.')
      ? dto.filename.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';
    const bucket = this.privateBucket;
    const objectPath = `ids/farmers/${dto.organizationId}/${crypto.randomUUID()}.${ext}`;

    try {
      const signed = await this.supabase.createSignedUploadUrl(
        bucket,
        objectPath,
      );
      return {
        bucket,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      };
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 400;
      throw new HttpException('Failed to create signed upload URL', status);
    }
  }

  async createLogoSignedUpload(
    user: UserContext,
    dto: CreateLogoUploadUrlDto,
  ): Promise<LogoUploadUrlResponseDto> {
    if (!user.organizationId || user.organizationId !== dto.organizationId) {
      throw new BadRequestException('Invalid organization context');
    }

    const ext = dto.filename.includes('.')
      ? dto.filename.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';
    const bucket = 'public';
    const objectPath = `logos/organizations/${dto.organizationId}/${crypto.randomUUID()}.${ext}`;

    // Ensure bucket exists and is public
    await this.supabase.ensureBucketExists(bucket, true);

    try {
      const signed = await this.supabase.createSignedUploadUrl(
        bucket,
        objectPath,
      );
      return {
        bucket,
        path: objectPath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      };
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 400;
      throw new HttpException('Failed to create signed upload URL', status);
    }
  }
}
