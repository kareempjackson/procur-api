import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { EmailService } from './email.service';
import { SendTestTemplateDto } from './dto/send-test-template.dto';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  @Post('test-template')
  @Public()
  @ApiOperation({
    summary: 'Send a test email template (internal)',
    description:
      'Internal helper for previewing email templates. Recipient is fixed to the configured test recipient.',
  })
  @ApiResponse({ status: 201, description: 'Test email queued/sent' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async sendTestTemplateEmail(
    @Headers('x-test-emails-key') key: string | undefined,
    @Body() dto: SendTestTemplateDto,
  ) {
    const nodeEnv =
      this.configService.get<string>('nodeEnv') ||
      process.env.NODE_ENV ||
      'development';
    const requiredKey =
      this.configService.get<string>('email.testEmailsKey') || '';

    // In production we always require a key. In non-prod, we allow missing key
    // to keep local/dev preview simple.
    if (nodeEnv === 'production') {
      if (!requiredKey || !key || key !== requiredKey) {
        throw new ForbiddenException('Invalid test email key');
      }
    } else if (requiredKey) {
      if (!key || key !== requiredKey) {
        throw new ForbiddenException('Invalid test email key');
      }
    }

    const to =
      this.configService.get<string>('email.testEmailsRecipient') ||
      'kareem@procurapp.co';

    const title = dto.previewTitle?.trim() || 'Email template preview';
    const safeBody = escapeHtml(dto.body);
    const templateMeta = dto.templateId
      ? `<p class="muted" style="margin:0 0 12px;">Template: ${escapeHtml(
          dto.templateId,
        )}</p>`
      : '';

    const innerHtml = `
      <h2 style="margin:0 0 12px;">${escapeHtml(title)}</h2>
      ${templateMeta}
      <pre style="white-space:pre-wrap;margin:0;font:14px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';">${safeBody}</pre>
    `;

    const result = await this.emailService.sendBrandedEmail(
      to,
      dto.subject,
      title,
      innerHtml,
      dto.body,
    );

    return {
      ok: true,
      to,
      messageId: (result as any)?.MessageID ?? null,
    };
  }
}
