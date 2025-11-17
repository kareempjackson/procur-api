import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Query,
} from '@nestjs/common';
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
import { DevSigninDto } from './dto/dev-signin.dto';
import {
  AuthResponseDto,
  SignupResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
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
}
