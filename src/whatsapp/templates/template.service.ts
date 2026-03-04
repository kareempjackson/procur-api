import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import IORedis from 'ioredis';
import { SendService } from '../send/send.service';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  // Versioned template names with optional env overrides for future rotations
  private readonly TPL_NEW_ORDER =
    process.env.WA_TEMPLATE_NEW_ORDER || 'new_order_to_seller_v1';
  private readonly TPL_UPDATE_WITH_TRACKING =
    process.env.WA_TEMPLATE_UPDATE_WITH_TRACKING ||
    'order_update_with_tracking_v1';
  private readonly TPL_UPDATE_NO_TRACKING =
    process.env.WA_TEMPLATE_UPDATE_NO_TRACKING || 'order_update_no_tracking_v1';
  private readonly TPL_OTP = process.env.WA_TEMPLATE_OTP || 'otp_verify';
  private readonly TPL_MARKETPLACE_UPDATE =
    process.env.WA_TEMPLATE_MARKETPLACE_UPDATE || 'marketplace_update_v1';
  private readonly TPL_STOCK_INQUIRY =
    process.env.WA_TEMPLATE_STOCK_INQUIRY || 'seller_stock_check_v1';
  private readonly TPL_PAYOUT_RECEIPT =
    process.env.WA_TEMPLATE_PAYOUT_RECEIPT || 'payout_receipt_v1';
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
    // Templates are allowed at any time in WhatsApp Cloud; always use template
    await this.sendTemplate(
      to,
      this.TPL_NEW_ORDER,
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
    if (!stored) {
      this.logger.warn(
        `WA pairing missing for user ${userId}; skipping WhatsApp`,
      );
      return;
    }
    const fp = this.fpForPhone(phoneE164);
    if (stored !== fp) {
      this.logger.warn(
        `WA fingerprint mismatch for user ${userId}; ensure E.164 has + and matches stored pairing`,
      );
      return;
    }

    const to = phoneE164.replace(/^\+/, '');
    this.logger.log(
      `Sending WA new_order_to_seller to user=${userId} to=${to} order=${orderNumber}`,
    );
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
        this.TPL_OTP,
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
    // Templates are allowed at any time in WhatsApp Cloud; do not suppress
    if (tracking) {
      await this.sendTemplate(
        to,
        this.TPL_UPDATE_WITH_TRACKING,
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
        this.TPL_UPDATE_NO_TRACKING,
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
    if (!stored) {
      this.logger.warn(
        `WA pairing missing for user ${userId}; skipping order update`,
      );
      return;
    }
    const fp = this.fpForPhone(phoneE164);
    if (stored !== fp) {
      this.logger.warn(
        `WA fingerprint mismatch for user ${userId}; ensure E.164 has + and matches stored pairing`,
      );
      return;
    }
    const to = phoneE164.replace(/^\+/, '');
    this.logger.log(
      `Sending WA order_update to user=${userId} to=${to} order=${orderNumber} status=${status}`,
    );
    await this.sendOrderUpdate(to, orderNumber, status, tracking, locale);
  }

  async sendMarketplaceUpdate(
    to: string,
    buyerName: string,
    featuredItem: string,
    marketplaceUrl: string,
    locale: string,
  ) {
    await this.sendTemplate(
      to,
      this.TPL_MARKETPLACE_UPDATE,
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: buyerName },
            { type: 'text', text: featuredItem },
            { type: 'text', text: marketplaceUrl },
          ],
        },
      ],
      this.getTemplateLang(locale),
    );
  }

  async sendSellerStockInquiry(to: string, sellerName: string) {
    const outside = await this.isOutside24h(to);
    if (outside) {
      await this.sendTemplate(
        to,
        this.TPL_STOCK_INQUIRY,
        [{ type: 'body', parameters: [{ type: 'text', text: sellerName }] }],
        'en_US',
      );
    } else {
      const dest = to.replace(/^\+/, '');
      await this.send.buttons(
        dest,
        `Hi ${sellerName}, the Procur team wants to know — what do you have available right now?`,
        [
          { id: 'stock_ready', title: 'I have stock ready' },
          { id: 'stock_low', title: 'Low on stock' },
          { id: 'stock_update', title: 'Will update soon' },
        ],
      );
    }
  }

  async sendPayoutReceipt(
    to: string,
    sellerName: string,
    amount: string,
    reference: string,
    paidAt: string,
    locale = 'en',
  ) {
    await this.sendTemplate(
      to,
      this.TPL_PAYOUT_RECEIPT,
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: sellerName },
            { type: 'text', text: amount },
            { type: 'text', text: reference },
            { type: 'text', text: paidAt },
          ],
        },
      ],
      this.getTemplateLang(locale),
    );
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

  /**
   * Send Accept / Reject CTA buttons for a specific order.
   * Button ids: oa_accept_<orderId> / oa_reject_<orderId>
   * Optionally include a short human-readable summary of the order.
   */
  async sendOrderAcceptButtons(to: string, orderId: string, summary?: string) {
    const dest = to.replace(/^\+/, '');
    const text = summary
      ? `Please accept or reject order ${orderId} for ${summary}.`
      : `Please accept or reject order ${orderId}.`;
    await this.send['queue'].enqueueSendMessage({
      payload: {
        messaging_product: 'whatsapp',
        to: dest,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: { id: `oa_accept_${orderId}`, title: 'Accept' },
              },
              {
                type: 'reply',
                reply: { id: `oa_reject_${orderId}`, title: 'Reject' },
              },
            ],
          },
        },
      },
      meta: { kind: 'buttons', purpose: 'order_accept_reject' },
    });
  }
}
