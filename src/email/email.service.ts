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

  private getVerificationEmailTemplate(
    fullname: string,
    verificationUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Procur Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { 
            display: inline-block; 
            background-color: #2563eb; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Procur</h1>
          </div>
          <div class="content">
            <h2>Hi ${fullname},</h2>
            <p>Thank you for signing up for Procur! Please verify your email address to complete your account setup.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with Procur, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Procur. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(fullname: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Procur!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { 
            display: inline-block; 
            background-color: #16a34a; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Procur!</h1>
          </div>
          <div class="content">
            <h2>Hi ${fullname},</h2>
            <p>🎉 Your account has been successfully verified! Welcome to the Procur platform.</p>
            <p>You can now:</p>
            <ul>
              <li>Complete your profile setup</li>
              <li>Explore procurement opportunities</li>
              <li>Connect with buyers and sellers</li>
              <li>Access our full suite of tools</li>
            </ul>
            <p>Ready to get started?</p>
            <a href="${this.configService.get('app.frontendUrl')}/dashboard" class="button">Go to Dashboard</a>
            <p>If you have any questions, our support team is here to help!</p>
          </div>
          <div class="footer">
            <p>© 2024 Procur. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getInvitationEmailTemplate(
    organizationName: string,
    inviterName: string,
    invitationUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to join ${organizationName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { 
            display: inline-block; 
            background-color: #7c3aed; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <h2>Join ${organizationName} on Procur</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on the Procur platform.</p>
            <p>By accepting this invitation, you'll be able to:</p>
            <ul>
              <li>Collaborate with your team</li>
              <li>Access organization resources</li>
              <li>Participate in procurement activities</li>
              <li>Use advanced platform features</li>
            </ul>
            <p>Click the button below to accept the invitation:</p>
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${invitationUrl}">${invitationUrl}</a></p>
            <p><strong>This invitation will expire in 7 days.</strong></p>
            <p>If you don't want to join this organization, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Procur. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
