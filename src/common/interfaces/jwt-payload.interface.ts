import { UserRole } from '../enums/user-role.enum';
import { AccountType } from '../enums/account-type.enum';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  accountType?: AccountType; // for individual users
  organizationId?: string; // for organization members
  organizationRole?: string; // role within organization
  emailVerified: boolean;
  iat?: number;
  exp?: number;
}

export interface UserContext {
  id: string;
  email: string;
  role: UserRole;
  accountType?: AccountType;
  organizationId?: string;
  organizationRole?: string;
  emailVerified: boolean;
  permissions?: string[];
}
