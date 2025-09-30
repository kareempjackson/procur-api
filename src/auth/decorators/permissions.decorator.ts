import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSION_KEY = 'anyPermission';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSION_KEY, permissions);
