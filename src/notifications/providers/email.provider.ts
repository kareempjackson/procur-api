import { Injectable } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

@Injectable()
export class EmailProvider implements OnModuleInit {
  static instance: EmailProvider | null = null;
  constructor(private readonly email: EmailService) {}

  onModuleInit() {
    EmailProvider.instance = this;
  }

  static async send(userId: string, subject: string, body: string, data?: any) {
    // TODO: lookup user email by userId and send using EmailService
    return;
  }
}
