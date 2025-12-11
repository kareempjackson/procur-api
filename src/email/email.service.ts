import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private postmarkClient: postmark.ServerClient;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.postmarkApiKey');
    this.fromEmail =
      this.configService.get<string>('email.fromEmail') || 'noreply@procur.com';

    if (!apiKey) {
      throw new Error('Postmark API key is required');
    }

    this.postmarkClient = new postmark.ServerClient(apiKey);
    this.logger.log('Postmark client initialized');
  }
  async sendBasicEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string,
  ) {
    try {
      const result = await this.postmarkClient.sendEmail({
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

  async sendVerificationEmail(
    email: string,
    fullname: string,
    verificationToken: string,
  ) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const verificationUrl = `${frontendUrl}/verify?token=${verificationToken}`;

    try {
      const result = await this.postmarkClient.sendEmail({
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
      const result = await this.postmarkClient.sendEmail({
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
      const result = await this.postmarkClient.sendEmail({
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
    const explicitLogoUrl = this.configService.get<string>('email.logoUrl');
    if (explicitLogoUrl) {
      return explicitLogoUrl;
    }
    const assetsBaseUrl =
      this.configService.get<string>('app.assetsUrl') ||
      this.configService.get<string>('app.frontendUrl') ||
      '';
    // Default to PNG under assets if not explicitly set
    return `${assetsBaseUrl}/images/logos/procur_logo.png`;
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
                <img src="${logoUrl}" alt="Procur" />
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
    buyerContact?: string | null;
    paymentMethod: string;
    paymentReference?: string | null;
    paymentStatus: string;
    subtotal: number;
    delivery: number;
    platformFee: number;
    taxAmount: number;
    discount: number;
    totalPaid: number;
    currency: string;
  }): string {
    const {
      receiptNumber,
      paymentDate,
      orderNumber,
      buyerName,
      buyerEmail,
      buyerContact,
      paymentMethod,
      paymentReference,
      paymentStatus,
      subtotal,
      delivery,
      platformFee,
      taxAmount,
      discount,
      totalPaid,
      currency,
    } = params;

    const formatCurrency = (value: number): string => {
      const amount = Number.isFinite(value) ? Number(value) : 0;
      return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
    };

    const safeContact =
      buyerContact && buyerContact.trim().length > 0
        ? buyerContact.trim()
        : null;

    const contactLine = safeContact
      ? `<p class="muted" style="margin:0 0 2px;">Contact: ${safeContact}</p>`
      : '';

    const safeReference =
      paymentReference && paymentReference.trim().length > 0
        ? paymentReference.trim()
        : null;

    const referenceLine = safeReference
      ? `<p class="muted" style="margin:0 0 2px;">Ref: ${safeReference}</p>`
      : '';

    return `
        <div style="display:flex;justify-content:space-between;gap:16px;border-bottom:1px dashed #e5e7eb;padding-bottom:12px;margin-bottom:12px;">
          <div>
            <p style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;color:#6b7280;margin:0 0 4px;">
              Procur
            </p>
            <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 2px;">
              Payment receipt
            </p>
            <p class="muted" style="margin:0;font-size:12px;color:#6b7280;">
              Thank you for paying your Procur order.
            </p>
          </div>
          <div style="text-align:right;font-size:12px;color:#6b7280;">
            <p style="margin:0 0 2px;">
              Receipt:
              <span style="font-weight:500;color:#111827;">${receiptNumber}</span>
            </p>
            <p style="margin:0 0 2px;">${paymentDate}</p>
            <p style="margin:0;">Order: ${orderNumber}</p>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;margin-bottom:12px;">
          <div>
            <p style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;color:#6b7280;margin:0 0 2px;">
              Paid by
            </p>
            <p style="margin:0 0 2px;color:#111827;font-weight:500;">
              ${buyerName}
            </p>
            <p class="muted" style="margin:0 0 2px;">
              ${buyerEmail}
            </p>
            ${contactLine}
          </div>
          <div style="text-align:right;">
            <p style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;color:#6b7280;margin:0 0 2px;">
              Payment
            </p>
            <p style="margin:0 0 2px;color:#111827;font-weight:500;">
              ${paymentMethod}
            </p>
            ${referenceLine}
            <p class="muted" style="margin:0;">
              Status:
              <span style="text-transform:capitalize;">${paymentStatus}</span>
            </p>
          </div>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;font-size:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span class="muted">Subtotal</span>
            <span style="font-weight:500;color:#111827;">${formatCurrency(
              subtotal,
            )}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span class="muted">Delivery</span>
            <span style="font-weight:500;color:#111827;">${formatCurrency(
              delivery,
            )}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span class="muted">Platform fee</span>
            <span style="font-weight:500;color:#111827;">${formatCurrency(
              platformFee,
            )}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span class="muted">Tax</span>
            <span style="font-weight:500;color:#111827;">${formatCurrency(
              taxAmount,
            )}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px dashed #e5e7eb;">
            <span class="muted">Discount</span>
            <span style="font-weight:500;color:#059669;">
              -${formatCurrency(discount)}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid #1118271a;">
            <span style="text-transform:uppercase;letter-spacing:0.16em;font-size:11px;font-weight:600;color:#111827;">
              Total paid
            </span>
            <span style="font-size:15px;font-weight:600;color:#111827;">
              ${formatCurrency(totalPaid)}
            </span>
          </div>
        </div>

        <p class="muted" style="font-size:11px;color:#6b7280;line-height:1.5;margin:0;">
          This receipt confirms payment received via Procur for the above order.
          Keep this for your internal reconciliation and audit records.
        </p>
    `;
  }

  async sendBuyerCompletionReceipt(params: {
    email: string;
    buyerName: string;
    buyerEmail: string;
    buyerContact?: string | null;
    receiptNumber: string;
    paymentDate: string;
    orderNumber: string;
    paymentMethod: string;
    paymentReference?: string | null;
    paymentStatus: string;
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
      buyerContact: params.buyerContact,
      receiptNumber: params.receiptNumber,
      paymentDate: params.paymentDate,
      orderNumber: params.orderNumber,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      paymentStatus: params.paymentStatus,
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

    const textBody = [
      'Payment receipt',
      '',
      `Receipt: ${params.receiptNumber}`,
      `Order: ${params.orderNumber}`,
      `Paid by: ${params.buyerName} (${params.buyerEmail})`,
      `Payment method: ${params.paymentMethod}`,
      `Status: ${params.paymentStatus}`,
      '',
      `Subtotal: ${cur(params.subtotal)}`,
      `Delivery: ${cur(params.delivery)}`,
      `Platform fee: ${cur(params.platformFee)}`,
      `Tax: ${cur(params.taxAmount)}`,
      `Discount: -${cur(params.discount)}`,
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
      buyerContact: params.buyerContact,
      receiptNumber: params.receiptNumber,
      paymentDate: params.paymentDate,
      orderNumber: params.orderNumber,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      paymentStatus: params.paymentStatus,
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

    const textBody = [
      'Payment receipt (seller copy)',
      '',
      `Receipt: ${params.receiptNumber}`,
      `Order: ${params.orderNumber}`,
      `Paid by: ${params.buyerName} (${params.buyerEmail})`,
      `Payment method: ${params.paymentMethod}`,
      `Status: ${params.paymentStatus}`,
      '',
      `Subtotal: ${cur(params.subtotal)}`,
      `Delivery: ${cur(params.delivery)}`,
      `Platform fee: ${cur(params.platformFee)}`,
      `Tax: ${cur(params.taxAmount)}`,
      `Discount: -${cur(params.discount)}`,
      `Total paid: ${cur(params.totalPaid)}`,
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
