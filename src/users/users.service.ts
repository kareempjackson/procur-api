import { BadRequestException, Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { SupabaseService } from '../database/supabase.service';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import {
  CreateFarmersIdUploadUrlDto,
  FarmersIdUploadUrlResponseDto,
} from './dto/farmers-id-upload.dto';

@Injectable()
export class UsersService {
  private readonly privateBucket: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
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
            const signed = await this.supabase.createSignedDownloadUrl(
              this.privateBucket,
              farmersIdPath,
              60 * 60, // 1 hour
            );
            farmersIdUrl = signed.signedUrl;
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
        };
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
      phone: (dbUser as any)?.phone ?? null,
      firstName: (dbUser as any)?.first_name ?? null,
      lastName: (dbUser as any)?.last_name ?? null,
      organization,
    };
  }

  async updateProfile(user: UserContext, updateData: UpdateUserProfileDto) {
    const orgUpdates: Record<string, any> = {};
    const userUpdates: Record<string, any> = {};

    if (typeof updateData?.phone === 'string')
      userUpdates.phone = updateData.phone;
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
}
