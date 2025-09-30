import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

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

    const request = context.switchToHttp().getRequest();
    const user: UserContext = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions = user.permissions || [];

    // Check if user has ALL required permissions
    if (requiredPermissions) {
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
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
