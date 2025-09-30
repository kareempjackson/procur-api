import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountType } from '../../common/enums/account-type.enum';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AccountTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAccountTypes = this.reflector.getAllAndOverride<
      AccountType[]
    >('accountTypes', [context.getHandler(), context.getClass()]);

    if (!requiredAccountTypes) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserContext = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check individual account type or organization account type
    const userAccountType = user.accountType; // Individual user account type

    // For organization users, we need to get the organization's account type
    // This would require additional database lookup, but for now we'll use the user's context

    const hasAccountType = requiredAccountTypes.some(
      (accountType) => userAccountType === accountType,
    );

    if (!hasAccountType) {
      throw new ForbiddenException(
        'Account type not authorized for this resource',
      );
    }

    return true;
  }
}
