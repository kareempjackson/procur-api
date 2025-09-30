import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { NotificationsGateway } from '../notifications.gateway';

@Injectable()
export class WebsocketProvider implements OnModuleInit {
  static instance: WebsocketProvider | null = null;
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    WebsocketProvider.instance = this;
  }

  private get gateway(): NotificationsGateway | undefined {
    try {
      return this.moduleRef.get(NotificationsGateway, { strict: false });
    } catch {
      return undefined;
    }
  }

  static async sendToUser(userId: string, payload: any) {
    WebsocketProvider.instance?.gateway?.emitToUser(
      userId,
      'notification',
      payload,
    );
  }
}
