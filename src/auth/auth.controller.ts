import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DevSigninDto } from './dto/dev-signin.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserContext } from '../common/interfaces/jwt-payload.interface';
import {
  AuthResponseDto,
  SignupResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountType } from '../common/enums/account-type.enum';
import {
  ListOrganizationsResponseDto,
  SwitchOrganizationDto,
} from './dto/switch-organization.dto';
import { OnboardBecomeRoleDto } from './dto/onboarding.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 3, ttl: 60 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User Registration',
    description:
      'Register a new user account. An email verification will be sent to the provided email address.',
  })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully. Verification email sent.',
    type: SignupResponseDto,
  })
  @ApiConflictResponse({
    description: 'User with this email already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'User with this email already exists',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async signup(
    @Body(ValidationPipe) signupDto: SignupDto,
  ): Promise<SignupResponseDto> {
    return this.authService.signup(signupDto);
  }

  @Public()
  @Post('signin')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User Sign In',
    description:
      'Authenticate user with email and password. Returns JWT token for authenticated requests.',
  })
  @ApiBody({ type: SigninDto })
  @ApiResponse({
    status: 200,
    description: 'User authenticated successfully',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or account deactivated',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async signin(
    @Body(ValidationPipe) signinDto: SigninDto,
  ): Promise<AuthResponseDto> {
    return this.authService.signin(signinDto);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Email Address',
    description:
      'Verify user email address using the token sent via email. Returns JWT token upon successful verification.',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: VerifyEmailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired verification token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Invalid or expired verification token',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async verifyEmail(
    @Body(ValidationPipe) verifyEmailDto: VerifyEmailDto,
  ): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend Verification Email',
    description: "Resend email verification link to the user's email address.",
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Verification email sent. Please check your inbox.',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'User not found or email already verified',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'User not found' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async resendVerificationEmail(
    @Query('email') email: string,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(email);
  }

  @Public()
  @Post('dev-signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dev-only Sign In by Account Type',
    description:
      'Authenticate as a seeded user by account type. Available only in non-production environments.',
  })
  @ApiBody({ type: DevSigninDto })
  @ApiResponse({
    status: 200,
    description: 'Dev user authenticated successfully',
    type: AuthResponseDto,
  })
  async devSignin(
    @Body(ValidationPipe) devSigninDto: DevSigninDto,
  ): Promise<AuthResponseDto> {
    return this.authService.devSignin(devSigninDto);
  }

  @Public()
  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 300 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request login OTP via WhatsApp or Email',
    description:
      'Generates a 6-digit OTP for the given phone number and delivers it via WhatsApp (default) or email.',
  })
  @ApiBody({ type: RequestOtpDto })
  async requestOtp(
    @Body(ValidationPipe) dto: RequestOtpDto,
  ): Promise<{ message: string }> {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and sign in',
    description:
      'Verifies a 6-digit OTP for the given phone number and returns a signed-in session.',
  })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(
    @Body(ValidationPipe) dto: VerifyOtpDto,
  ): Promise<AuthResponseDto> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept organization invitation',
    description:
      'Accept an organization invitation using the token from the email, create or attach a user account, and return an authenticated session.',
  })
  @ApiBody({ type: AcceptInvitationDto })
  async acceptInvitation(
    @Body(ValidationPipe) dto: AcceptInvitationDto,
  ): Promise<AuthResponseDto> {
    return this.authService.acceptInvitation(dto);
  }

  @Post('impersonate/:userId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Impersonate a user (admin-only)',
    description:
      'Generate an access token that authenticates as the target user. Only SUPER_ADMIN can call this.',
  })
  @ApiResponse({
    status: 200,
    description: 'Impersonation token generated successfully',
    type: AuthResponseDto,
  })
  async impersonate(
    @CurrentUser() admin: UserContext,
    @Param('userId') userId: string,
  ): Promise<AuthResponseDto> {
    return this.authService.impersonateUser(admin, userId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Access Token',
    description:
      'Exchange a valid refresh token for a new access token and rotated refresh token.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'userId.tokenId' },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'New access token issued successfully',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token expired or invalid' })
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change Password',
    description:
      'Change the password for the authenticated user by providing the current and new passwords.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password updated successfully' },
      },
    },
  })
  async changePassword(
    @CurrentUser() user: UserContext,
    @Body(ValidationPipe) dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user, dto);
  }

  // ================================================================
  // Multi-org / role-toggle (Airbnb-style "Switch to Selling")
  // ================================================================

  @Get('organizations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List the authenticated user\'s organization memberships',
    description:
      'Returns every org the user belongs to with its account type (buyer/seller/government). The frontend uses this to render the role-switcher pill and decide whether the user can switch directly into an existing role or needs to go through the become-a-seller / become-a-buyer onboarding flow.',
  })
  @ApiResponse({ status: 200, type: ListOrganizationsResponseDto })
  async listOrganizations(
    @CurrentUser() user: UserContext,
  ): Promise<ListOrganizationsResponseDto> {
    return this.authService.listUserOrganizations(user.id);
  }

  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Switch the active organization for the current session',
    description:
      'Persist a new active org on the user and re-mint access + refresh tokens scoped to it. The frontend should replace its stored tokens with the response before navigating, since downstream APIs depend on the JWT\'s organizationId / accountType claims.',
  })
  @ApiBody({ type: SwitchOrganizationDto })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'User is not a member of the requested organization',
  })
  async switchOrganization(
    @CurrentUser() user: UserContext,
    @Body(ValidationPipe) dto: SwitchOrganizationDto,
  ): Promise<AuthResponseDto> {
    return this.authService.switchOrganization(user.id, dto);
  }

  @Post('onboarding/become-seller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a seller role to the current user (Airbnb-style "Start selling")',
    description:
      'Creates a seller organization for an existing buyer user and switches into it. Idempotent: if the user already has a seller org, switches to that one without creating a duplicate. Returns new tokens scoped to the seller context.',
  })
  @ApiBody({ type: OnboardBecomeRoleDto })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async becomeSeller(
    @CurrentUser() user: UserContext,
    @Body(ValidationPipe) dto: OnboardBecomeRoleDto,
  ): Promise<AuthResponseDto> {
    return this.authService.becomeRole(user.id, AccountType.SELLER, dto);
  }

  @Post('onboarding/become-buyer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a buyer role to the current user',
    description:
      'Creates a buyer organization for an existing seller user and switches into it. Same idempotency and token-rotation semantics as become-seller.',
  })
  @ApiBody({ type: OnboardBecomeRoleDto })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async becomeBuyer(
    @CurrentUser() user: UserContext,
    @Body(ValidationPipe) dto: OnboardBecomeRoleDto,
  ): Promise<AuthResponseDto> {
    return this.authService.becomeRole(user.id, AccountType.BUYER, dto);
  }
}
