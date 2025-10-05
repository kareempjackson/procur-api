import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConversationsController } from './controllers/conversations.controller';
import { MessagesController } from './controllers/messages.controller';
import { ParticipantsController } from './controllers/participants.controller';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { ParticipantsService } from './services/participants.service';

@Module({
  imports: [ConfigModule, DatabaseModule, NotificationsModule],
  controllers: [
    ConversationsController,
    MessagesController,
    ParticipantsController,
  ],
  providers: [ConversationsService, MessagesService, ParticipantsService],
  exports: [ConversationsService, MessagesService, ParticipantsService],
})
export class MessagesModule {}
