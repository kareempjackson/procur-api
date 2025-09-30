import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (
    data: keyof UserContext | undefined,
    ctx: ExecutionContext,
  ): UserContext | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
