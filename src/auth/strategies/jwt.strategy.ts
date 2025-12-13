import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  JwtPayload,
  UserContext,
} from '../../common/interfaces/jwt-payload.interface';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<UserContext> {
    // Get user from database to ensure they still exist and are active
    const user = await this.supabaseService.findUserById(payload.sub);

    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // In development, allow devPermissions to short-circuit DB lookup
    let permissions: string[] = [];
    if (payload.devPermissions?.length) {
      permissions = payload.devPermissions;
      this.logger.debug(
        `Using dev permissions for ${payload.email}: ${JSON.stringify(permissions)}`,
      );
    } else if (payload.organizationId) {
      const userPermissions = await this.supabaseService.getUserPermissions(
        payload.sub,
        payload.organizationId,
      );
      permissions = userPermissions.map((p) => p.permission_name);
      this.logger.debug(
        `Loaded ${permissions.length} permissions for ${payload.email}: ${JSON.stringify(permissions)}`,
      );
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      accountType: payload.accountType,
      organizationId: payload.organizationId,
      organizationRole: payload.organizationRole,
      emailVerified: payload.emailVerified,
      permissions,
    };
  }
}
