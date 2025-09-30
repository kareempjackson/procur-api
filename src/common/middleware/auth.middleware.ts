import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../database/supabase.service';
import { JwtPayload, UserContext } from '../interfaces/jwt-payload.interface';

// Extend Express Request interface to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: UserContext;
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const payload: JwtPayload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Get user from database to ensure they still exist and are active
      const user = await this.supabaseService.findUserById(payload.sub);

      if (!user || !user.is_active) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Get user permissions if they belong to an organization
      let permissions: string[] = [];
      if (payload.organizationId) {
        const userPermissions = await this.supabaseService.getUserPermissions(
          payload.sub,
          payload.organizationId,
        );
        permissions = userPermissions.map((p) => p.permission_name);
      }

      // Attach user context to request
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        accountType: payload.accountType,
        organizationId: payload.organizationId,
        organizationRole: payload.organizationRole,
        emailVerified: payload.emailVerified,
        permissions,
      };
    } catch (error) {
      // Invalid token - continue without user context
      // The guards will handle authorization
    }

    next();
  }
}
