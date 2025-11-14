import { Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { SendService } from '../send/send.service';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  constructor(
    private readonly send: SendService,
    private readonly redis: IORedis,
  ) {}

  private async isOutside24h(to: string): Promise<boolean> {
    const ts = await this.redis.get(`wa:last_inbound:${to}`);
    if (!ts) return true;
    const diff = Date.now() - Number(ts);
    return diff > 24 * 60 * 60 * 1000;
  }

  private getTemplateLang(locale: string): 'en_US' | 'es_ES' {
    return locale === 'es' ? 'es_ES' : 'en_US';
  }

  async sendOtp(to: string, otp: string, locale: string) {
    const outside = await this.isOutside24h(to);
    if (outside) {
      await this.sendTemplate(
        to,
        'otp_verify',
        [{ type: 'body', parameters: [{ type: 'text', text: otp }] }],
        this.getTemplateLang(locale),
      );
    } else {
      await this.send.text(to, `Your Procur verification code is: ${otp}`);
    }
  }

  async sendOrderUpdate(
    to: string,
    orderNumber: string,
    status: string,
    tracking: string | undefined,
    locale: string,
  ) {
    const outside = await this.isOutside24h(to);
    if (!outside) return;
    if (tracking) {
      await this.sendTemplate(
        to,
        'order_update_with_tracking',
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: orderNumber },
              { type: 'text', text: status },
              { type: 'text', text: tracking },
            ],
          },
        ],
        this.getTemplateLang(locale),
      );
    } else {
      await this.sendTemplate(
        to,
        'order_update_no_tracking',
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: orderNumber },
              { type: 'text', text: status },
            ],
          },
        ],
        this.getTemplateLang(locale),
      );
    }
  }

  async sendTemplate(
    to: string,
    name: string,
    components: any[],
    languageCode: 'en_US' | 'es_ES',
  ) {
    const opted = await this.redis.get(`wa:optout:${to}`);
    if (opted) {
      this.logger.warn(`Template suppressed due to opt-out for ${to}`);
      return;
    }
    await this.send['queue'].enqueueSendMessage({
      payload: {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name,
          language: { code: languageCode },
          components,
        },
      },
      meta: { template: name, language: languageCode, outside24h: true },
    });
  }
}
