import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../database/supabase.service';
import { EmailService } from '../email/email.service';
import { DatabaseUser } from '../database/types/database.types';
import { newId } from '../common/utils/id.utils';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { DevSigninDto } from './dto/dev-signin.dto';
import {
  AuthResponseDto,
  SignupResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AccountType } from '../common/enums/account-type.enum';
import { BusinessType } from '../common/enums/business-types.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private supabaseService: SupabaseService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(signupDto: SignupDto): Promise<SignupResponseDto> {
    const {
      email,
      password,
      fullname,
      accountType,
      country,
      businessType,
      businessName,
    } = signupDto;

    // Check if user already exists
    const existingUser = await this.supabaseService.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const verificationToken = newId();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

    try {
      // Create user in database
      const userData = {
        email,
        password: hashedPassword,
        fullname,
        individual_account_type: accountType,
        country,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
      };

      const user = await this.supabaseService.createUser(userData);

      // For buyer and seller accounts, create an organization
      if (
        accountType === AccountType.BUYER ||
        accountType === AccountType.SELLER
      ) {
        const organizationData = {
          name:
            businessName ||
            `${fullname}'s ${accountType === AccountType.BUYER ? 'Business' : 'Company'}`,
          business_name: businessName || undefined,
          account_type: accountType,
          business_type: (businessType || 'general') as BusinessType,
          country,
        };

        const organization =
          await this.supabaseService.createOrganization(organizationData);

        // Ensure creator is added as organization admin (with retries if needed)
        await this.supabaseService.ensureCreatorIsOrganizationAdmin(
          user.id,
          organization.id,
        );

        this.logger.log(
          `Organization created for user: ${email}, org: ${organization.id}`,
        );
      }

      // Send verification email
      await this.emailService.sendVerificationEmail(
        email,
        fullname,
        verificationToken,
      );

      this.logger.log(`User created successfully: ${email}`);

      return {
        message:
          'User created successfully. Please check your email for verification.',
        email,
      };
    } catch (error) {
      this.logger.error('Error during signup:', error);
      throw new BadRequestException('Failed to create user account');
    }
  }

  async signin(signinDto: SigninDto): Promise<AuthResponseDto> {
    const { email, password } = signinDto;

    // Find user by email
    const user = await this.supabaseService.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.supabaseService.updateUserLastLogin(user.id);

    // Get user with organization info if applicable
    const userWithOrg = await this.supabaseService.getUserWithOrganization(
      user.id,
    );

    const { organizationId, organizationName, organizationRole, accountType } =
      this.extractOrganizationInfo(user, userWithOrg);

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountType,
      organizationId,
      organizationRole,
      emailVerified: user.email_verified,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getTokenExpirationSeconds();

    this.logger.log(`User signed in successfully: ${email}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        accountType,
        emailVerified: user.email_verified,
        organizationId,
        organizationName,
        organizationRole,
      },
    };
  }

  async devSignin(devSigninDto: DevSigninDto): Promise<AuthResponseDto> {
    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
    if (nodeEnv === 'production') {
      throw new UnauthorizedException(
        'Dev sign-in is not allowed in production',
      );
    }

    const { accountType } = devSigninDto;

    // Choose a seeded user email for each account type
    const seedEmailByType: Record<string, string> = {
      seller: 'john@greenfarms.com',
      buyer: 'chef@finedining.com',
      government: 'admin@agriculture.gov',
    };

    const email = seedEmailByType[accountType];
    if (!email) {
      throw new BadRequestException('Unsupported account type');
    }

    const user = await this.supabaseService.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Seed user not found for dev sign-in');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last login
    await this.supabaseService.updateUserLastLogin(user.id);

    // Enrich with organization info to determine effective account type
    const userWithOrg = await this.supabaseService.getUserWithOrganization(
      user.id,
    );

    const {
      organizationId,
      organizationName,
      organizationRole,
      accountType: effectiveAccountType,
    } = this.extractOrganizationInfo(user, userWithOrg);

    // In dev, attach a comprehensive permission set for the chosen account type
    const devPermissionSets: Record<string, string[]> = {
      seller: [
        'view_products',
        'manage_products',
        'view_orders',
        'accept_orders',
        'manage_orders',
        'view_transactions',
        'manage_posts',
        'manage_seller_analytics',
        'manage_inventory',
        'view_posts',
      ],
      buyer: [
        'browse_marketplace',
        'manage_cart',
        'create_product_requests',
        'manage_product_requests',
        'place_orders',
        'view_buyer_orders',
        'cancel_orders',
        'review_orders',
        'manage_buyer_profile',
        'manage_addresses',
        'manage_favorites',
        'view_buyer_transactions',
      ],
      government: [
        'manage_role_permissions',
        'view_government_data',
        'manage_government_tables',
        'edit_seller_data',
        'create_government_charts',
        'manage_government_reports',
        'view_reports',
      ],
    };

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountType: effectiveAccountType,
      organizationId,
      organizationRole,
      emailVerified: user.email_verified,
      devPermissions: devPermissionSets[accountType] || [],
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getTokenExpirationSeconds();

    this.logger.log(`Dev sign-in successful for ${email} as ${accountType}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        accountType: effectiveAccountType,
        emailVerified: user.email_verified,
        organizationId,
        organizationName,
        organizationRole,
      },
    };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<VerifyEmailResponseDto> {
    const { token } = verifyEmailDto;

    try {
      // Verify email using token
      const user = await this.supabaseService.verifyUserEmail(token);

      if (!user) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.fullname);

      // Generate JWT token for the verified user
      const userWithOrg = await this.supabaseService.getUserWithOrganization(
        user.id,
      );

      const {
        organizationId,
        organizationName,
        organizationRole,
        accountType,
      } = this.extractOrganizationInfo(user, userWithOrg);

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        accountType,
        organizationId,
        organizationRole,
        emailVerified: true,
      };

      const accessToken = this.jwtService.sign(payload);
      const expiresIn = this.getTokenExpirationSeconds();

      this.logger.log(`Email verified successfully: ${user.email}`);

      return {
        message: 'Email verified successfully. Welcome to Procur!',
        auth: {
          accessToken,
          tokenType: 'Bearer',
          expiresIn,
          user: {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role,
            accountType,
            emailVerified: true,
            organizationId,
            organizationName,
            organizationRole,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error during email verification:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to verify email');
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.supabaseService.findUserByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = newId();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    // Update user with new token
    await this.supabaseService.updateUser(user.id, {
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires.toISOString(),
    });

    // Send new verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      user.fullname,
      verificationToken,
    );

    this.logger.log(`Verification email resent to: ${email}`);

    return {
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  private getTokenExpirationSeconds(): number {
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '7d';

    // Convert to seconds (assuming format like '7d', '24h', '3600s')
    if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    } else if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 60 * 60;
    } else if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    } else if (expiresIn.endsWith('s')) {
      return parseInt(expiresIn);
    }

    // Default to 7 days
    return 7 * 24 * 60 * 60;
  }

  private extractOrganizationInfo(user: DatabaseUser, userWithOrg: any) {
    let organizationId: string | undefined;
    let organizationName: string | undefined;
    let organizationRole: string | undefined;
    let accountType: AccountType | undefined =
      user.individual_account_type as AccountType;

    if (userWithOrg?.organization_users?.[0]) {
      const orgUser = userWithOrg.organization_users[0];
      organizationId = orgUser.organization_id;
      organizationName = orgUser.organizations.name;
      organizationRole = orgUser.organization_roles.name;
      accountType = orgUser.organizations.account_type as AccountType;
    }

    return { organizationId, organizationName, organizationRole, accountType };
  }
}
