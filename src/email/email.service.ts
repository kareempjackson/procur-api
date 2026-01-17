import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private postmarkClient: postmark.ServerClient;
  private fromEmail: string;
  private readonly sendTimeoutMs: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.postmarkApiKey');
    this.fromEmail =
      this.configService.get<string>('email.fromEmail') || 'noreply@procur.com';
    this.sendTimeoutMs =
      Number(this.configService.get<string>('email.timeoutMs')) ||
      Number(process.env.EMAIL_TIMEOUT_MS) ||
      10_000;

    if (!apiKey) {
      throw new Error('Postmark API key is required');
    }

    this.postmarkClient = new postmark.ServerClient(apiKey);
    this.logger.log('Postmark client initialized');
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let t: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          t = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (t) clearTimeout(t);
    }
  }

  private async sendPostmarkEmail(payload: postmark.Models.Message) {
    return this.withTimeout(
      this.postmarkClient.sendEmail(payload),
      this.sendTimeoutMs,
      'Postmark sendEmail',
    );
  }

  async sendBasicEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string,
  ) {
    try {
      const result = await this.sendPostmarkEmail({
        From: this.fromEmail,
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody ?? '',
        MessageStream: 'outbound',
      });
      this.logger.log(`Email sent to ${to}`, { messageId: result.MessageID });
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      // Do not throw to avoid breaking critical flows like payment webhooks
    }
  }

  /**
   * Strict send for admin-triggered actions where we want to surface errors.
   */
  async sendBasicEmailStrict(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string,
  ) {
    const result = await this.sendPostmarkEmail({
      From: this.fromEmail,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody ?? '',
      MessageStream: 'outbound',
    });
    this.logger.log(`Email sent to ${to}`, { messageId: result.MessageID });
    return result;
  }

  async sendVerificationEmail(
    email: string,
    fullname: string,
    verificationToken: string,
  ) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const verificationUrl = `${frontendUrl}/verify?token=${verificationToken}`;

    try {
      const result = await this.sendPostmarkEmail({
        From: this.fromEmail,
        To: email,
        Subject: 'Verify Your Procur Account',
        HtmlBody: this.getVerificationEmailTemplate(fullname, verificationUrl),
        TextBody: `Hi ${fullname},\n\nPlease verify your email address by clicking the following link:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Procur Team`,
        MessageStream: 'outbound',
      });

      this.logger.log(`Verification email sent to ${email}`, {
        messageId: result.MessageID,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullname: string) {
    try {
      const result = await this.sendPostmarkEmail({
        From: this.fromEmail,
        To: email,
        Subject: 'Welcome to Procur!',
        HtmlBody: this.getWelcomeEmailTemplate(fullname),
        TextBody: `Hi ${fullname},\n\nWelcome to Procur! Your account has been successfully verified.\n\nYou can now log in and start using our platform.\n\nBest regards,\nThe Procur Team`,
        MessageStream: 'outbound',
      });

      this.logger.log(`Welcome email sent to ${email}`, {
        messageId: result.MessageID,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
      throw error;
    }
  }

  async sendOrganizationInvitation(
    email: string,
    organizationName: string,
    inviterName: string,
    invitationToken: string,
  ) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const invitationUrl = `${frontendUrl}/auth/accept-invitation?token=${invitationToken}`;

    try {
      const result = await this.sendPostmarkEmail({
        From: this.fromEmail,
        To: email,
        Subject: `Invitation to join ${organizationName} on Procur`,
        HtmlBody: this.getInvitationEmailTemplate(
          organizationName,
          inviterName,
          invitationUrl,
        ),
        TextBody: `Hi,\n\n${inviterName} has invited you to join ${organizationName} on Procur.\n\nClick the following link to accept the invitation:\n${invitationUrl}\n\nThis invitation will expire in 7 days.\n\nBest regards,\nThe Procur Team`,
        MessageStream: 'outbound',
      });

      this.logger.log(`Invitation email sent to ${email}`, {
        messageId: result.MessageID,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${email}`, error);
      throw error;
    }
  }

  private getLogoUrl(): string {
    const nodeEnv =
      this.configService.get<string>('nodeEnv') ||
      process.env.NODE_ENV ||
      'development';
    const explicitLogoUrl = this.configService.get<string>('email.logoUrl');
    if (explicitLogoUrl) {
      // If someone configured a relative URL, make it absolute using assets/front-end base.
      if (explicitLogoUrl.startsWith('/')) {
        const base =
          this.configService.get<string>('app.assetsUrl') ||
          this.configService.get<string>('app.frontendUrl') ||
          '';
        return `${base.replace(/\/+$/, '')}${explicitLogoUrl}`;
      }
      return explicitLogoUrl;
    }
    const assetsBaseUrl =
      this.configService.get<string>('app.assetsUrl') ||
      this.configService.get<string>('app.frontendUrl') ||
      '';
    // Default to PNG under assets if not explicitly set
    const base = assetsBaseUrl.replace(/\/+$/, '');

    // If prod is still pointing at localhost/empty, fall back to the public site.
    const isBadProdBase =
      !base ||
      base.includes('localhost') ||
      base.includes('127.0.0.1') ||
      base.startsWith('http://');

    if (nodeEnv === 'production' && isBadProdBase) {
      this.logger.warn(
        `Email assets URL misconfigured for production (assetsBaseUrl="${assetsBaseUrl}"). Falling back to https://www.procurapp.co`,
      );
      return `https://www.procurapp.co/images/logos/procur_logo.png`;
    }

    return `${base}/images/logos/procur_logo.png`;
  }

  private getBrandHead(title: string): string {
    const logoUrl = this.getLogoUrl();
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          /* Base and brand styles */
          body { margin: 0; padding: 0; background-color: #f6f6f6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          .container { max-width: 640px; margin: 0 auto; padding: 24px; }
          .card { background: #ffffff; border: 1px solid #ececec; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
          .header { padding: 20px 24px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f1f1f1; }
          .brand { display: inline-flex; align-items: center; gap: 12px; color: #0f172a; font-weight: 700; font-size: 18px; }
          .brand img { display: block; height: 28px; width: auto; }
          .content { padding: 28px 24px; color: #1f2937; font: 14px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; }
          h1, h2, h3 { margin: 0 0 12px; color: #0f172a; }
          h2 { font-size: 20px; font-weight: 700; }
          p { margin: 0 0 12px; }
          ul { margin: 0 0 12px 18px; }
          .button { display: inline-block; background-color: #0f172a; color: #ffffff !important; padding: 12px 22px; text-decoration: none; border-radius: 9999px; font-weight: 600; }
          .muted { color: #6b7280; font-size: 12px; }
          .footer { padding: 18px 24px; text-align: center; color: #6b7280; font-size: 12px; background: #fafafa; border-top: 1px solid #f1f1f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="brand">
                <img src="${logoUrl}" alt="Procur" width="120" style="display:block;height:28px;max-height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
              </span>
            </div>
            <div class="content">`;
  }

  private getBrandFoot(): string {
    return `
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Procur Grenada Ltd. All rights reserved.</p>
              <p>Procur Grenada Ltd. Annandale, St. Georges, Grenada W.I., 473-538-4365</p>
            </div>
          </div>
        </div>
      </body>
      </html>`;
  }

  private buildBrandedBody(title: string, innerHtml: string): string {
    return `
      ${this.getBrandHead(title)}
        ${innerHtml}
      ${this.getBrandFoot()}
    `;
  }

  async sendBrandedEmail(
    to: string,
    subject: string,
    title: string,
    innerHtml: string,
    textBody?: string,
  ) {
    const htmlBody = this.buildBrandedBody(title, innerHtml);
    return this.sendBasicEmail(to, subject, htmlBody, textBody);
  }

  async sendBrandedEmailStrict(
    to: string,
    subject: string,
    title: string,
    innerHtml: string,
    textBody?: string,
  ) {
    const htmlBody = this.buildBrandedBody(title, innerHtml);
    return this.sendBasicEmailStrict(to, subject, htmlBody, textBody);
  }

  private getVerificationEmailTemplate(
    fullname: string,
    verificationUrl: string,
  ): string {
    const innerHtml = `
        <h2>Hi ${fullname},</h2>
        <p>Thanks for joining Procur. Please verify your email address to complete your account setup.</p>
        <p style="margin-top: 16px;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </p>
        <p class="muted">Or copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p class="muted"><strong>This link will expire in 24 hours.</strong></p>
        <p class="muted">If you didn't create an account with Procur, you can safely ignore this email.</p>
    `;
    return this.buildBrandedBody('Verify Your Procur Account', innerHtml);
  }

  private getWelcomeEmailTemplate(fullname: string): string {
    const dashboardUrl = `${this.configService.get('app.frontendUrl')}/dashboard`;
    const innerHtml = `
        <h2>Hi ${fullname},</h2>
        <p>🎉 Your account has been verified. Welcome to Procur.</p>
        <p>Here’s what you can do next:</p>
        <ul>
          <li>Complete your profile setup</li>
          <li>Explore opportunities and suppliers</li>
          <li>Connect with buyers and sellers</li>
        </ul>
        <p style="margin-top: 16px;">
          <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
        </p>
        <p class="muted">Need help? Just reply to this email.</p>
    `;
    return this.buildBrandedBody('Welcome to Procur!', innerHtml);
  }

  private getInvitationEmailTemplate(
    organizationName: string,
    inviterName: string,
    invitationUrl: string,
  ): string {
    const innerHtml = `
        <h2>Join ${organizationName} on Procur</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Procur.</p>
        <p>By accepting this invitation, you'll be able to collaborate with your team and access organization resources.</p>
        <p style="margin-top: 16px;">
          <a href="${invitationUrl}" class="button">Accept Invitation</a>
        </p>
        <p class="muted">Or copy and paste this link:</p>
        <p><a href="${invitationUrl}">${invitationUrl}</a></p>
        <p class="muted"><strong>This invitation will expire in 7 days.</strong></p>
    `;
    return this.buildBrandedBody(
      `Invitation to join ${organizationName}`,
      innerHtml,
    );
  }

  /**
   * Shared HTML body for a compact payment receipt, mirroring the layout
   * showcased in procur-ui /test/receipts ("Compact slip").
   */
  private buildPaymentReceiptInnerHtml(params: {
    receiptNumber: string;
    paymentDate: string;
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    buyerAddress?: string | null;
    buyerContact?: string | null;
    paymentMethod: string;
    paymentReference?: string | null;
    paymentStatus: string;
    items?: {
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
    subtotal: number;
    delivery: number;
    platformFee: number;
    taxAmount: number;
    discount: number;
    totalPaid: number;
    currency: string;
    totalsMode?: 'buyer' | 'seller';
    deliveryLabel?: string;
    totalLabel?: string;
    showPlatformFee?: boolean;
    deliveryIsDeduction?: boolean;
  }): string {
    const {
      receiptNumber,
      paymentDate,
      orderNumber,
      buyerName,
      buyerEmail,
      buyerAddress,
      buyerContact,
      paymentMethod,
      paymentReference,
      paymentStatus,
      items,
      subtotal,
      delivery,
      platformFee,
      taxAmount,
      discount,
      totalPaid,
      currency,
      totalsMode = 'buyer',
      deliveryLabel,
      totalLabel,
      showPlatformFee,
      deliveryIsDeduction,
    } = params;

    const safeText = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    };

    const formatCurrency = (value: number): string => {
      const amount = Number.isFinite(value) ? Number(value) : 0;
      return `${currency.toUpperCase()} ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    const formatPaymentDate = (value: string): string => {
      // Accept ISO strings and already formatted text.
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) return safeText(value);
      return parsed.toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const safeContact =
      buyerContact && buyerContact.trim().length > 0
        ? buyerContact.trim()
        : null;

    const contactLine = safeContact
      ? `
          <tr>
            <td style="padding:0 0 2px 0;color:#6b7280;font-size:12px;line-height:1.4;">
              Contact: ${safeText(safeContact)}
            </td>
          </tr>
        `
      : '';

    const safeAddress =
      buyerAddress && buyerAddress.trim().length > 0
        ? buyerAddress.trim()
        : null;

    const addressLine = safeAddress
      ? `
          <tr>
            <td style="padding:0 0 2px 0;color:#6b7280;font-size:12px;line-height:1.4;">
              ${safeText(safeAddress)}
            </td>
          </tr>
        `
      : '';

    const safeReference =
      paymentReference && paymentReference.trim().length > 0
        ? paymentReference.trim()
        : null;

    const referenceLine = safeReference
      ? `
          <tr>
            <td style="padding:0 0 2px 0;color:#6b7280;font-size:12px;line-height:1.4;">
              Ref: ${safeText(safeReference)}
            </td>
          </tr>
        `
      : '';

    const effectiveShowPlatformFee =
      typeof showPlatformFee === 'boolean'
        ? showPlatformFee
        : totalsMode === 'buyer';

    const effectiveDeliveryLabel =
      deliveryLabel?.trim() ||
      (totalsMode === 'seller' ? 'Delivery fee' : 'Delivery');

    const effectiveDeliveryIsDeduction =
      typeof deliveryIsDeduction === 'boolean'
        ? deliveryIsDeduction
        : totalsMode === 'seller';

    const effectiveTotalLabel =
      totalLabel?.trim() || (totalsMode === 'seller' ? 'Total received' : 'Total paid');

    const discountRow =
      totalsMode === 'buyer' && Number(discount || 0) > 0
        ? `
            <tr>
              <td style="padding:0 0 0 0;color:#6b7280;font-size:12px;line-height:1.4;">Discount</td>
              <td align="right" style="padding:0 0 0 0;color:#059669;font-size:12px;line-height:1.4;font-weight:700;">-${formatCurrency(
                discount,
              )}</td>
            </tr>
          `
        : '';

    const platformFeeRow = effectiveShowPlatformFee
      ? `
                <tr>
                  <td style="padding:0 0 6px 0;color:#6b7280;font-size:12px;line-height:1.4;">Platform fee</td>
                  <td align="right" style="padding:0 0 6px 0;color:#111827;font-size:12px;line-height:1.4;font-weight:600;">${formatCurrency(
                    platformFee,
                  )}</td>
                </tr>
      `
      : '';

    const deliveryValue = effectiveDeliveryIsDeduction
      ? `-${formatCurrency(delivery)}`
      : formatCurrency(delivery);

    const itemRows = Array.isArray(items)
      ? items
          .filter((it) => (it?.name ?? '').toString().trim().length > 0)
          .slice(0, 50)
          .map((it) => {
            const name = safeText(it.name);
            const qty = Number(it.quantity ?? 0) || 0;
            const unitPrice = Number(it.unitPrice ?? 0) || 0;
            const lineTotal = Number(it.lineTotal ?? qty * unitPrice) || 0;
            return `
              <tr>
                <td style="padding:8px 0;border-top:1px solid #f1f1f1;color:#111827;font-size:12px;line-height:1.4;">
                  ${name}
                </td>
                <td align="right" style="padding:8px 0;border-top:1px solid #f1f1f1;color:#6b7280;font-size:12px;line-height:1.4;">
                  ${qty}
                </td>
                <td align="right" style="padding:8px 0;border-top:1px solid #f1f1f1;color:#6b7280;font-size:12px;line-height:1.4;">
                  ${formatCurrency(unitPrice)}
                </td>
                <td align="right" style="padding:8px 0;border-top:1px solid #f1f1f1;color:#111827;font-size:12px;line-height:1.4;font-weight:600;">
                  ${formatCurrency(lineTotal)}
                </td>
              </tr>
            `;
          })
          .join('')
      : '';

    const itemsBlock =
      itemRows.trim().length > 0
        ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px 0;">
              <tr>
                <td style="padding:0 0 8px 0;color:#111827;font-size:12px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:0.16em;">
                  Items purchased
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:8px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">
                        Item
                      </td>
                      <td align="right" style="padding:8px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">
                        Qty
                      </td>
                      <td align="right" style="padding:8px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">
                        Unit
                      </td>
                      <td align="right" style="padding:8px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;line-height:1.4;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">
                        Total
                      </td>
                    </tr>
                    ${itemRows}
                  </table>
                </td>
              </tr>
            </table>
          `
        : '';

    const receiptTitle =
      totalsMode === 'seller' ? 'Payment receipt (seller copy)' : 'Payment receipt';
    const receiptSubtitle =
      totalsMode === 'seller'
        ? 'A confirmation of payment received for your Procur order.'
        : 'Thank you for paying your Procur order.';

    return `
        <!-- Receipt header (table-based for email client compatibility) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 12px 0;border-bottom:1px dashed #e5e7eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="top" style="padding:0;">
                    <p style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;color:#6b7280;margin:0 0 4px;">
                      Procur
                    </p>
                    <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 2px;">
                      ${safeText(receiptTitle)}
                    </p>
                    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.4;">
                      ${safeText(receiptSubtitle)}
                    </p>
                  </td>
                  <td valign="top" align="right" style="padding:0;text-align:right;">
                    <p style="margin:0 0 2px;font-size:12px;color:#6b7280;line-height:1.4;">
                      Receipt:
                      <span style="font-weight:600;color:#111827;">${safeText(
                        receiptNumber,
                      )}</span>
                    </p>
                    <p style="margin:0 0 2px;font-size:12px;color:#6b7280;line-height:1.4;">
                      ${formatPaymentDate(paymentDate)}
                    </p>
                    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.4;">
                      Order: ${safeText(orderNumber)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Buyer + payment meta -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 12px 0;">
          <tr>
            <td valign="top" style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="top" style="padding:0;">
                    <p style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;color:#6b7280;margin:0 0 2px;">
                      Paid by
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:0 0 2px 0;color:#111827;font-size:12px;line-height:1.4;font-weight:600;">
                          ${safeText(buyerName)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 2px 0;color:#6b7280;font-size:12px;line-height:1.4;">
                          <a href="mailto:${safeText(
                            buyerEmail,
                          )}" style="color:#6b7280;text-decoration:underline;">${safeText(
                            buyerEmail,
                          )}</a>
                        </td>
                      </tr>
                      ${addressLine}
                      ${contactLine}
                    </table>
                  </td>
                  <td valign="top" align="right" style="padding:0;text-align:right;">
                    <p style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;color:#6b7280;margin:0 0 2px;">
                      Payment
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:0 0 2px 0;color:#111827;font-size:12px;line-height:1.4;font-weight:600;">
                          ${safeText(paymentMethod)}
                        </td>
                      </tr>
                      ${referenceLine}
                      <tr>
                        <td style="padding:0;color:#6b7280;font-size:12px;line-height:1.4;">
                          Status:
                          <span style="text-transform:capitalize;">${safeText(
                            paymentStatus,
                          )}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${itemsBlock}

        <!-- Totals -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e5e7eb;border-radius:12px;margin:0 0 12px 0;">
          <tr>
            <td style="padding:12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 6px 0;color:#6b7280;font-size:12px;line-height:1.4;">Subtotal</td>
                  <td align="right" style="padding:0 0 6px 0;color:#111827;font-size:12px;line-height:1.4;font-weight:600;">${formatCurrency(
                    subtotal,
                  )}</td>
                </tr>
                <tr>
                  <td style="padding:0 0 6px 0;color:#6b7280;font-size:12px;line-height:1.4;">${safeText(
                    effectiveDeliveryLabel,
                  )}</td>
                  <td align="right" style="padding:0 0 6px 0;color:#111827;font-size:12px;line-height:1.4;font-weight:600;">${safeText(
                    deliveryValue,
                  )}</td>
                </tr>
                ${platformFeeRow}
                ${discountRow}
                <tr>
                  <td colspan="2" style="padding:10px 0 0 0;border-top:1px solid #1118271a;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;font-weight:700;color:#111827;padding:0;">
                          ${safeText(effectiveTotalLabel)}
                        </td>
                        <td align="right" style="font-size:15px;font-weight:800;color:#111827;padding:0;">
                          ${formatCurrency(totalPaid)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size:11px;color:#6b7280;line-height:1.5;margin:0;">
          This receipt confirms payment received via Procur for the above order.
          Keep this for your internal reconciliation and audit records.
        </p>
    `;
  }

  async sendBuyerCompletionReceipt(params: {
    email: string;
    buyerName: string;
    buyerEmail: string;
    buyerAddress?: string | null;
    buyerContact?: string | null;
    receiptNumber: string;
    paymentDate: string;
    orderNumber: string;
    paymentMethod: string;
    paymentReference?: string | null;
    paymentStatus: string;
    items?: {
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
    subtotal: number;
    delivery: number;
    platformFee: number;
    taxAmount: number;
    discount: number;
    totalPaid: number;
    currency: string;
  }): Promise<void> {
    const innerHtml = this.buildPaymentReceiptInnerHtml({
      buyerName: params.buyerName,
      buyerEmail: params.buyerEmail,
      buyerAddress: params.buyerAddress,
      buyerContact: params.buyerContact,
      receiptNumber: params.receiptNumber,
      paymentDate: params.paymentDate,
      orderNumber: params.orderNumber,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      paymentStatus: params.paymentStatus,
      items: params.items,
      subtotal: params.subtotal,
      delivery: params.delivery,
      platformFee: params.platformFee,
      taxAmount: params.taxAmount,
      discount: params.discount,
      totalPaid: params.totalPaid,
      currency: params.currency,
    });

    const cur = (v: number) =>
      `${params.currency.toUpperCase()} ${Number(v || 0).toFixed(2)}`;

    const itemsText = Array.isArray(params.items) && params.items.length > 0
      ? [
          '',
          'Items purchased:',
          ...params.items.slice(0, 50).map((it) => {
            const qty = Number(it.quantity ?? 0) || 0;
            const unit = cur(Number(it.unitPrice ?? 0));
            const total = cur(Number(it.lineTotal ?? 0));
            const name = String(it.name ?? 'Item');
            return `- ${name} (${qty} × ${unit}) = ${total}`;
          }),
        ]
      : [];

    const textBody = [
      'Payment receipt',
      '',
      `Receipt: ${params.receiptNumber}`,
      `Order: ${params.orderNumber}`,
      `Paid by: ${params.buyerName} (${params.buyerEmail})`,
      `Payment method: ${params.paymentMethod}`,
      `Status: ${params.paymentStatus}`,
      ...itemsText,
      '',
      `Subtotal: ${cur(params.subtotal)}`,
      `Delivery: ${cur(params.delivery)}`,
      `Platform fee: ${cur(params.platformFee)}`,
      ...(Number(params.discount || 0) > 0
        ? [`Discount: -${cur(params.discount)}`]
        : []),
      `Total paid: ${cur(params.totalPaid)}`,
      '',
      'This receipt confirms payment received via Procur for the above order.',
      'Keep this for your internal reconciliation and audit records.',
    ].join('\n');

    const subject = `Payment receipt for your Procur order ${params.orderNumber}`;

    await this.sendBrandedEmail(
      params.email,
      subject,
      'Payment receipt',
      innerHtml,
      textBody,
    );
  }

  async sendSellerCompletionReceipt(params: {
    email: string;
    sellerName: string;
    buyerName: string;
    buyerEmail: string;
    buyerContact?: string | null;
    receiptNumber: string;
    paymentDate: string;
    orderNumber: string;
    paymentMethod: string;
    paymentReference?: string | null;
    paymentStatus: string;
    items?: {
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
    subtotal: number;
    delivery: number;
    platformFee: number;
    taxAmount: number;
    discount: number;
    totalPaid: number;
    currency: string;
  }): Promise<void> {
    const totalReceived = Number((Number(params.subtotal || 0) - Number(params.delivery || 0)).toFixed(2));
    const innerHtml = this.buildPaymentReceiptInnerHtml({
      buyerName: params.buyerName,
      buyerEmail: params.buyerEmail,
      buyerContact: params.buyerContact,
      receiptNumber: params.receiptNumber,
      paymentDate: params.paymentDate,
      orderNumber: params.orderNumber,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      paymentStatus: params.paymentStatus,
      items: params.items,
      subtotal: params.subtotal,
      delivery: params.delivery,
      platformFee: 0,
      taxAmount: 0,
      discount: 0,
      totalPaid: totalReceived,
      currency: params.currency,
      totalsMode: 'seller',
      deliveryLabel: 'Delivery fee',
      deliveryIsDeduction: true,
      showPlatformFee: false,
      totalLabel: 'Total received',
    });

    const cur = (v: number) =>
      `${params.currency.toUpperCase()} ${Number(v || 0).toFixed(2)}`;

    const itemsText = Array.isArray(params.items) && params.items.length > 0
      ? [
          '',
          'Items purchased:',
          ...params.items.slice(0, 50).map((it) => {
            const qty = Number(it.quantity ?? 0) || 0;
            const unit = cur(Number(it.unitPrice ?? 0));
            const total = cur(Number(it.lineTotal ?? 0));
            const name = String(it.name ?? 'Item');
            return `- ${name} (${qty} × ${unit}) = ${total}`;
          }),
        ]
      : [];

    const textBody = [
      'Payment receipt (seller copy)',
      '',
      `Receipt: ${params.receiptNumber}`,
      `Order: ${params.orderNumber}`,
      `Paid by: ${params.buyerName} (${params.buyerEmail})`,
      `Payment method: ${params.paymentMethod}`,
      `Status: ${params.paymentStatus}`,
      ...itemsText,
      '',
      `Subtotal: ${cur(params.subtotal)}`,
      `Delivery fee: -${cur(params.delivery)}`,
      `Total received: ${cur(totalReceived)}`,
      '',
      'This receipt confirms payment received via Procur for the above order.',
      'Keep this for your internal reconciliation and audit records.',
    ].join('\n');

    const subject = `Payment received for Procur order ${params.orderNumber}`;

    await this.sendBrandedEmail(
      params.email,
      subject,
      'Payment receipt',
      innerHtml,
      textBody,
    );
  }
}
