import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);
  @WebSocketServer() server: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token ||
        (client.handshake.headers?.authorization as string)?.split(
          ' ',
        )[1]) as string;
      if (!token) {
        this.logger.warn('No token provided to websocket');
        return client.disconnect();
      }
      const payload = this.jwt.verify(token);
      const userId = payload?.sub as string | undefined;
      if (!userId) return client.disconnect();
      client.join(`user:${userId}`);
      client.emit('connected', { ok: true });
    } catch (e) {
      this.logger.warn('Websocket auth failed');
      client.disconnect();
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
}
