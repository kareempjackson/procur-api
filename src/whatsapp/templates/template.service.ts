import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
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

  private fpForPhone(phoneE164: string) {
    const e164 = phoneE164.startsWith('+') ? phoneE164 : `+${phoneE164}`;
    return createHash('sha256').update(e164).digest('hex');
  }

  async sendNewOrderToSeller(
    to: string,
    orderNumber: string,
    buyerName: string,
    totalAmount: number,
    currency: string,
    manageUrl: string,
    locale: string,
  ) {
    const outside = await this.isOutside24h(to);
    if (outside) {
      await this.sendTemplate(
        to,
        'new_order_to_seller',
        [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: orderNumber },
              { type: 'text', text: buyerName },
              { type: 'text', text: String(totalAmount.toFixed(2)) },
              { type: 'text', text: currency },
              { type: 'text', text: manageUrl },
            ],
          },
        ],
        this.getTemplateLang(locale),
      );
    } else {
      const text = `New order ${orderNumber} from ${buyerName}. Total: ${currency} ${totalAmount.toFixed(
        2,
      )}\nManage: ${manageUrl}`;
      await this.send.text(to, text);
    }
  }

  /**
   * Only send if a specific user has paired WhatsApp (signed up/verified).
   * Validates Redis key wa:fp:<userId> equals SHA256(phone E.164).
   */
  async sendNewOrderToSellerIfPaired(
    userId: string,
    phoneE164: string,
    orderNumber: string,
    buyerName: string,
    totalAmount: number,
    currency: string,
    manageUrl: string,
    locale: string,
  ) {
    const stored = await this.redis.get(`wa:fp:${userId}`);
    if (!stored) return;
    const fp = this.fpForPhone(phoneE164);
    if (stored !== fp) return;

    const to = phoneE164.replace(/^\+/, '');
    await this.sendNewOrderToSeller(
      to,
      orderNumber,
      buyerName,
      totalAmount,
      currency,
      manageUrl,
      locale,
    );
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

  /**
   * Only send order update template if the given user is WhatsApp paired.
   * Validates Redis key wa:fp:<userId> equals SHA256(phone E.164).
   */
  async sendOrderUpdateIfPaired(
    userId: string,
    phoneE164: string,
    orderNumber: string,
    status: string,
    tracking: string | undefined,
    locale: string,
  ) {
    const stored = await this.redis.get(`wa:fp:${userId}`);
    if (!stored) return;
    const fp = this.fpForPhone(phoneE164);
    if (stored !== fp) return;
    const to = phoneE164.replace(/^\+/, '');
    await this.sendOrderUpdate(to, orderNumber, status, tracking, locale);
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
