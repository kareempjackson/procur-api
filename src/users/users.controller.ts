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

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class UsersController {
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
    return user;
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
    @Body() updateData: any,
  ) {
    return {
      message: 'Profile update functionality to be implemented',
      userId: user.id,
      updateData,
    };
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
    return {
      message: 'This is admin-only data',
      user: user.email,
      role: user.role,
    };
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
    return {
      message: 'Users list functionality to be implemented',
      requesterPermissions: user.permissions,
    };
  }
}
