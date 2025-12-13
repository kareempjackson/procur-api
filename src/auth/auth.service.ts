import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../database/supabase.service';
import { EmailService } from '../email/email.service';
import {
  DatabaseUser,
  DatabaseUserWithOrganization,
} from '../database/types/database.types';
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
import { OrganizationStatus } from '../common/enums/organization-status.enum';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SendService as WaSendService } from '../whatsapp/send/send.service';
import { TemplateService as WaTemplateService } from '../whatsapp/templates/template.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CaptchaService } from '../common/utils/captcha.service';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserContext } from '../common/interfaces/jwt-payload.interface';

type InvitationRecord = {
  id: string;
  email: string;
  organization_id: string;
  role_id: string;
  expires_at: string;
  accepted_at: string | null;
};

type OrganizationUserRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  is_active: boolean;
};

const isInvitationRecord = (value: unknown): value is InvitationRecord => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.email === 'string' &&
    typeof record.organization_id === 'string' &&
    typeof record.role_id === 'string'
  );
};

const isOrganizationUserRecord = (
  value: unknown,
): value is OrganizationUserRecord => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.organization_id === 'string' &&
    typeof record.user_id === 'string' &&
    typeof record.role_id === 'string' &&
    typeof record.is_active === 'boolean'
  );
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly captchaService: CaptchaService,
    // Optional: present if WhatsappModule is loaded
    private readonly waSend?: WaSendService,
    private readonly waTemplates?: WaTemplateService,
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
      website,
      captchaToken,
    } = signupDto;

    // Honeypot: if filled, treat as bot and fail fast
    if (website && website.trim().length > 0) {
      this.logger.warn(`Signup honeypot triggered for email ${email}`);
      throw new BadRequestException('Unable to process signup');
    }

    // CAPTCHA verification
    await this.captchaService.verifyTurnstileToken(captchaToken);

    // Additional sanity check on fullname (backup to DTO validation)
    if (!/\s/.test(fullname) || /\d/.test(fullname) || fullname.length < 5) {
      throw new BadRequestException(
        'Please enter your real first and last name',
      );
    }

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

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const phone = dto.phoneNumber?.trim();
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    const user = await this.supabaseService.findUserByPhoneNumber(phone);
    if (!user) {
      // Hide existence
      return { message: 'Code sent if the account exists.' };
    }

    const code = this.generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await this.supabaseService.updateUser(user.id, {
      email_verification_token: code,
      email_verification_expires: expires,
    });

    const channel = dto.channel ?? 'whatsapp';
    try {
      if (channel === 'whatsapp' && user.phone_number) {
        const to = user.phone_number.replace('+', '');
        // Use template to allow delivery outside 24h window
        if (this.waTemplates) {
          await this.waTemplates.sendOtp(to, code, 'en');
        } else if (this.waSend) {
          await this.waSend.text(
            to,
            `Your Procur login code is ${code}. It expires in 10 minutes.`,
          );
        }
      } else {
        await this.emailService.sendVerificationEmail(
          user.email,
          user.fullname,
          code,
        );
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error('Failed to deliver OTP', error);
      // continue to hide delivery errors
    }

    this.logger.log(`OTP requested for phone ${phone}`);
    return { message: 'Code sent if the account exists.' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    const phone = dto.phoneNumber?.trim();
    const code = dto.code?.trim();
    if (!phone || !code) {
      throw new BadRequestException('Phone number and code are required');
    }
    const user = await this.supabaseService.findUserByPhoneNumber(phone);
    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }
    const expMs = user.email_verification_expires
      ? new Date(user.email_verification_expires).getTime()
      : 0;
    const valid =
      user.email_verification_token === code && expMs > 0 && Date.now() < expMs;
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const verificationCleared = {
      email_verification_token: null,
      email_verification_expires: null,
      email_verified: true,
    };
    await this.supabaseService.updateUser(user.id, verificationCleared);

    // Get user with organization info if applicable
    const userWithOrg = await this.supabaseService.getUserWithOrganization(
      user.id,
    );
    const { organizationId, organizationName, organizationRole, accountType } =
      this.extractOrganizationInfo(user, userWithOrg);

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

    this.logger.log(`OTP sign-in successful for ${phone}`);
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
        emailVerified: true,
        organizationId,
        organizationName,
        organizationRole,
      },
    };
  }
  async changePassword(
    userCtx: { id: string },
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = dto;
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException(
        'New password must be at least 8 characters',
      );
    }
    const user = await this.supabaseService.findUserById(userCtx.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await this.supabaseService.updateUserPassword(user.id, hashedPassword);
    this.logger.log(`Password updated for user ${user.email}`);
    return { message: 'Password updated successfully' };
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
    let isPasswordValid = false;

    const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';

    // Dev-only override for Kareem's super admin account to unblock local admin access
    if (
      nodeEnv !== 'production' &&
      email === 'kareem+admin@ghostsavvy.com' &&
      password === '123456789'
    ) {
      isPasswordValid = true;
      this.logger.log(
        `Dev override sign-in for super admin ${email} in ${nodeEnv} mode`,
      );
    } else {
      isPasswordValid = await bcrypt.compare(password, user.password);
    }
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

      // Load organization context (if any) for this user
      const userWithOrg = await this.supabaseService.getUserWithOrganization(
        user.id,
      );

      // If this is a buyer with a linked organization in pending state,
      // automatically mark the organization as active when email is verified.
      const orgUser = userWithOrg?.organization_users?.[0];
      const org = orgUser?.organizations;
      if (
        org &&
        org.account_type === AccountType.BUYER &&
        org.status === OrganizationStatus.PENDING_VERIFICATION
      ) {
        await this.supabaseService.updateOrganization(org.id, {
          status: OrganizationStatus.ACTIVE,
        });
      }

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

  private extractOrganizationInfo(
    user: DatabaseUser,
    userWithOrg: DatabaseUserWithOrganization | null,
  ) {
    let organizationId: string | undefined;
    let organizationName: string | undefined;
    let organizationRole: string | undefined;
    let accountType: AccountType | undefined = user.individual_account_type;

    if (userWithOrg?.organization_users?.[0]) {
      const orgUser = userWithOrg.organization_users[0];
      organizationId = orgUser.organization_id;
      organizationName = orgUser.organizations.name;
      organizationRole = orgUser.organization_roles.name;
      accountType = orgUser.organizations.account_type;
    }

    return { organizationId, organizationName, organizationRole, accountType };
  }

  async acceptInvitation(dto: AcceptInvitationDto): Promise<AuthResponseDto> {
    const { token, fullname, password } = dto;
    if (!token || !fullname || !password) {
      throw new BadRequestException(
        'Token, fullname and password are required',
      );
    }
    if (password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    const client = this.supabaseService.getClient();
    const nowIso = new Date().toISOString();

    // 1) Look up invitation
    const inviteResult = await client
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .gt('expires_at', nowIso)
      .is('accepted_at', null)
      .single();
    const inviteData: unknown = inviteResult.data;
    const inviteError = inviteResult.error;

    const inviteCandidate: unknown = inviteData;
    if (inviteError || !isInvitationRecord(inviteCandidate)) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const invite = inviteCandidate;
    const { email, organization_id: organizationId, role_id: roleId } = invite;

    // 2) Check if user already exists
    let user = await this.supabaseService.findUserByEmail(email);

    if (!user) {
      // Create new user account
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const userData = {
        email,
        password: hashedPassword,
        fullname,
        individual_account_type: undefined,
        phone_number: undefined,
        country: undefined,
        // Invitation-based accounts skip separate email verification
        email_verification_token: newId(),
        email_verification_expires: new Date(),
      };

      user = await this.supabaseService.createUser(userData);

      // Mark email as verified
      await this.supabaseService.updateUser(user.id, {
        email_verified: true,
      });
    } else {
      if (!user.is_active) {
        throw new BadRequestException(
          'This account is deactivated. Contact support to reactivate.',
        );
      }
    }

    // 3) Ensure membership in organization with the invited role
    const supabase = this.supabaseService.getClient();
    const membershipResult = await supabase
      .from('organization_users')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle();
    const existingMembershipData: unknown = membershipResult.data;
    const membershipErr = membershipResult.error;

    if (membershipErr) {
      this.logger.error('Error checking existing membership:', membershipErr);
      throw new BadRequestException('Failed to attach user to organization');
    }

    const membershipCandidate: unknown = existingMembershipData;

    if (!membershipCandidate) {
      const { error: createErr } = await supabase
        .from('organization_users')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          role_id: roleId,
          is_active: true,
        });
      if (createErr) {
        this.logger.error(
          'Error creating membership from invitation:',
          createErr,
        );
        throw new BadRequestException('Failed to attach user to organization');
      }
    } else if (!isOrganizationUserRecord(membershipCandidate)) {
      throw new BadRequestException('Membership record is malformed');
    } else if (!membershipCandidate.is_active) {
      const { error: reactivateErr } = await supabase
        .from('organization_users')
        .update({ is_active: true, role_id: roleId })
        .eq('id', membershipCandidate.id);
      if (reactivateErr) {
        this.logger.error(
          'Error reactivating membership from invitation:',
          reactivateErr,
        );
        throw new BadRequestException('Failed to attach user to organization');
      }
    }

    // 4) Mark invitation as accepted
    const { error: updateInviteErr } = await client
      .from('organization_invitations')
      .update({ accepted_at: nowIso })
      .eq('id', invite.id);

    if (updateInviteErr) {
      this.logger.error(
        'Error marking invitation as accepted:',
        updateInviteErr,
      );
    }

    // 5) Build auth response as in signin()
    const userWithOrg = await this.supabaseService.getUserWithOrganization(
      user.id,
    );

    const {
      organizationId: effectiveOrgId,
      organizationName,
      organizationRole,
      accountType,
    } = this.extractOrganizationInfo(user, userWithOrg);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accountType,
      organizationId: effectiveOrgId,
      organizationRole,
      emailVerified: true,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getTokenExpirationSeconds();

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
        emailVerified: true,
        organizationId: effectiveOrgId,
        organizationName,
        organizationRole,
      },
    };
  }

  async impersonateUser(
    admin: UserContext,
    targetUserId: string,
  ): Promise<AuthResponseDto> {
    // Only SUPER_ADMIN is allowed to impersonate
    if (admin.role !== UserRole.SUPER_ADMIN) {
      throw new UnauthorizedException(
        'Only super admins can impersonate users',
      );
    }

    const user = await this.supabaseService.findUserById(targetUserId);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Target user not found or inactive');
    }

    // Load organization/account context just like normal signin()
    const userWithOrg = await this.supabaseService.getUserWithOrganization(
      user.id,
    );
    const { organizationId, organizationName, organizationRole, accountType } =
      this.extractOrganizationInfo(user, userWithOrg);

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

    this.logger.log(
      `Admin ${admin.email} is impersonating user ${user.email} (${user.id})`,
    );

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
}
