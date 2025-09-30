import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { AccountType } from '../../common/enums/account-type.enum';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'Bearer',
    description: 'Token type',
  })
  tokenType: string;

  @ApiProperty({
    example: 604800,
    description: 'Token expiration time in seconds',
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    fullname: string;
    role: UserRole;
    accountType?: AccountType;
    emailVerified: boolean;
    organizationId?: string;
    organizationName?: string;
    organizationRole?: string;
  };
}

export class SignupResponseDto {
  @ApiProperty({
    example:
      'User created successfully. Please check your email for verification.',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email where verification was sent',
  })
  email: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({
    example: 'Email verified successfully. Welcome to Procur!',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    description: 'Authentication details after successful verification',
  })
  auth: AuthResponseDto;
}
