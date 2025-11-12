import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Body,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';

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
  async receive(@Body() body: any) {
    await this.svc.handleWebhook(body);
    return { status: 'ok' };
  }
}
