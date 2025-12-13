import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (
    data: keyof UserContext | undefined,
    ctx: ExecutionContext,
  ): UserContext | UserContext[keyof UserContext] | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: UserContext }>();
    const { user } = request;
    return data ? user?.[data] : user;
  },
);
