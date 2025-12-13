import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/enums/user-role.enum';
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    const anyPermission = this.reflector.getAllAndOverride<string[]>(
      'anyPermission',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions && !anyPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: UserContext;
    }>();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Platform super admins always have full access to all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Organization admins have full access within their org by default
    // Also grant if user holds organization-wide management permission
    if (user.organizationRole === 'admin') {
      return true;
    }

    const userPermissions = user.permissions || [];

    if (userPermissions.includes('manage_organization')) {
      return true;
    }

    // Log for debugging
    this.logger.debug(
      `Permission Check - Required: ${JSON.stringify(requiredPermissions)}, User has: ${JSON.stringify(userPermissions)}, User: ${user.email}`,
    );

    // Check if user has ALL required permissions
    if (requiredPermissions) {
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        const missingPermissions = requiredPermissions.filter(
          (permission) => !userPermissions.includes(permission),
        );
        this.logger.warn(
          `User ${user.email} missing permissions: ${JSON.stringify(missingPermissions)}`,
        );
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // Check if user has ANY of the required permissions
    if (anyPermission) {
      const hasAnyPermission = anyPermission.some((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
