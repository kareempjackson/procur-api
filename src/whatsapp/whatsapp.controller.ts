import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Body,
  HttpCode,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Headers, Req } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';
import * as crypto from 'crypto';

@Controller('whatsapp/webhook')
export class WhatsappController {
  constructor(private readonly svc: WhatsappService) {}

  @Get()
  @Public()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  @Post()
  @Public()
  @HttpCode(200)
  async receive(
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (secret) {
      const raw = (req as any).rawBody as Buffer | undefined;
      if (!raw || !signature) {
        return { status: 'missing_signature' };
      }
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(raw).digest('hex');
      const ok =
        Buffer.byteLength(signature) === Buffer.byteLength(digest) &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
      if (!ok) {
        // Forbidden when signature is invalid
        throw new (require('@nestjs/common').ForbiddenException)();
      }
    }
    await this.svc.handleWebhook(body);
    return { status: 'ok' };
  }

  @Post('/admin/token')
  @HttpCode(200)
  async setToken(
    @Body('token') token: string,
    @Headers('x-admin-token') adminToken?: string,
  ) {
    const expected = process.env.WHATSAPP_ADMIN_TOKEN;
    if (!expected || adminToken !== expected) {
      throw new (require('@nestjs/common').ForbiddenException)();
    }
    await this.svc.adminSetToken(token);
    return { status: 'ok' };
  }
}
