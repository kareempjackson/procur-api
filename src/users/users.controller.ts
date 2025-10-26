import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { SystemPermission } from '../common/enums/system-permission.enum';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import {
  CreateFarmersIdUploadUrlDto,
  FarmersIdUploadUrlResponseDto,
} from './dto/farmers-id-upload.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get('profile')
  @ApiOperation({
    summary: 'Get User Profile',
    description: "Get the current user's profile information",
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        accountType: { type: 'string' },
        emailVerified: { type: 'boolean' },
        organizationId: { type: 'string' },
        organizationRole: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'Email verification required' })
  async getProfile(@CurrentUser() user: UserContext) {
    return this.usersService.getProfile(user);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update User Profile',
    description: "Update the current user's profile information",
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiForbiddenResponse({ description: 'Email verification required' })
  async updateProfile(
    @CurrentUser() user: UserContext,
    @Body() updateData: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(user, updateData);
  }

  @Get('admin-only')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Admin Only Endpoint',
    description: 'Example endpoint that requires admin role',
  })
  @ApiResponse({ status: 200, description: 'Admin data retrieved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async adminOnly(@CurrentUser() user: UserContext) {
    return this.usersService.adminOnly(user);
  }

  @Get('users-list')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(SystemPermission.VIEW_USERS)
  @ApiOperation({
    summary: 'View Users List',
    description: 'Get list of users (requires VIEW_USERS permission)',
  })
  @ApiResponse({ status: 200, description: 'Users list retrieved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getUsersList(@CurrentUser() user: UserContext) {
    return this.usersService.getUsersList(user);
  }

  @Patch('farmers-id/signed-upload')
  @ApiOperation({
    summary: 'Create signed upload URL for Farmer ID (private storage)',
  })
  @ApiResponse({ status: 200, description: 'Signed URL created' })
  async createFarmersIdSignedUpload(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateFarmersIdUploadUrlDto,
  ): Promise<FarmersIdUploadUrlResponseDto> {
    const service: {
      createFarmersIdSignedUpload: (
        user: UserContext,
        dto: CreateFarmersIdUploadUrlDto,
      ) => Promise<FarmersIdUploadUrlResponseDto>;
    } = this.usersService as unknown as {
      createFarmersIdSignedUpload: (
        user: UserContext,
        dto: CreateFarmersIdUploadUrlDto,
      ) => Promise<FarmersIdUploadUrlResponseDto>;
    };
    const upload = await service.createFarmersIdSignedUpload(user, dto);
    return {
      bucket: upload.bucket,
      path: upload.path,
      signedUrl: upload.signedUrl,
      token: upload.token,
    };
  }
}
