import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CaptchaService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Kept the same method name so existing AuthService.signup calls still work,
   * but the implementation now verifies Google reCAPTCHA instead of Turnstile.
   */
  async verifyTurnstileToken(token: string, remoteIp?: string): Promise<void> {
    const secret = this.config.get<string>('RECAPTCHA_SECRET');

    // If not configured (e.g., local dev), skip verification
    if (!secret) {
      return;
    }

    try {
      const { data } = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret,
            response: token,
            ...(remoteIp ? { remoteip: remoteIp } : {}),
          },
        },
      );

      if (!data.success) {
        throw new BadRequestException('Bot verification failed');
      }
    } catch {
      throw new BadRequestException('Bot verification failed');
    }
  }
}
