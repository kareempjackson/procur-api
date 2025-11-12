import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  PORT?: number = 3000;

  @IsString()
  @IsNotEmpty()
  NODE_ENV: string;

  @IsUrl()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_ANON_KEY: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '7d';

  @IsString()
  @IsNotEmpty()
  POSTMARK_API_KEY: string;

  @IsString()
  @IsOptional()
  POSTMARK_FROM_EMAIL?: string = 'noreply@procur.com';

  @IsUrl()
  @IsOptional()
  LOGO_URL?: string;

  @IsUrl()
  @IsOptional()
  FRONTEND_URL?: string = 'http://localhost:3001';

  @IsUrl()
  @IsOptional()
  EMAIL_ASSETS_URL?: string;

  @IsString()
  @IsOptional()
  API_PREFIX?: string = 'api';

  @IsString()
  @IsOptional()
  API_VERSION?: string = 'v1';

  // WhatsApp (optional)
  @IsString()
  @IsOptional()
  WHATSAPP_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_APP_SECRET?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);

  // Basic validation - in a real app you'd use class-validator's validate function
  if (!validatedConfig.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required');
  }
  if (!validatedConfig.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
  if (!validatedConfig.POSTMARK_API_KEY) {
    throw new Error('POSTMARK_API_KEY is required');
  }

  return validatedConfig;
}
