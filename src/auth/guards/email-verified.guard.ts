import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
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

    const requireEmailVerification = this.reflector.getAllAndOverride<boolean>(
      'requireEmailVerification',
      [context.getHandler(), context.getClass()],
    );

    // If email verification is not required for this route, allow access
    if (requireEmailVerification === false) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: UserContext;
    }>();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Allow organization admins to proceed even if email not yet verified
    if (!user.emailVerified && user.organizationRole !== 'admin') {
      throw new ForbiddenException(
        'Email verification required. Please verify your email address.',
      );
    }

    return true;
  }
}
