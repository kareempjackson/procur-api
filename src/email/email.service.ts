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
              <p>© ${new Date().getFullYear()} Procur. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>`;
  }

  private getVerificationEmailTemplate(
    fullname: string,
    verificationUrl: string,
  ): string {
    return `
      ${this.getBrandHead('Verify Your Procur Account')}
        <h2>Hi ${fullname},</h2>
        <p>Thanks for joining Procur. Please verify your email address to complete your account setup.</p>
        <p style="margin-top: 16px;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </p>
        <p class="muted">Or copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p class="muted"><strong>This link will expire in 24 hours.</strong></p>
        <p class="muted">If you didn't create an account with Procur, you can safely ignore this email.</p>
      ${this.getBrandFoot()}
    `;
  }

  private getWelcomeEmailTemplate(fullname: string): string {
    const dashboardUrl = `${this.configService.get('app.frontendUrl')}/dashboard`;
    return `
      ${this.getBrandHead('Welcome to Procur!')}
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
      ${this.getBrandFoot()}
    `;
  }

  private getInvitationEmailTemplate(
    organizationName: string,
    inviterName: string,
    invitationUrl: string,
  ): string {
    return `
      ${this.getBrandHead(`Invitation to join ${organizationName}`)}
        <h2>Join ${organizationName} on Procur</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Procur.</p>
        <p>By accepting this invitation, you'll be able to collaborate with your team and access organization resources.</p>
        <p style="margin-top: 16px;">
          <a href="${invitationUrl}" class="button">Accept Invitation</a>
        </p>
        <p class="muted">Or copy and paste this link:</p>
        <p><a href="${invitationUrl}">${invitationUrl}</a></p>
        <p class="muted"><strong>This invitation will expire in 7 days.</strong></p>
      ${this.getBrandFoot()}
    `;
  }
}
