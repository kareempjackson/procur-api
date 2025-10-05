import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from '../services/messages.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ConversationAccessGuard } from '../guards/conversation-access.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard, ConversationAccessGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.messagesService.sendMessage(conversationId, dto, user.id);
  }

  @Get()
  async listMessages(
    @Param('conversationId') conversationId: string,
    @Query('parentMessageId') parentMessageId?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messagesService.listMessages(conversationId, {
      parentMessageId: parentMessageId || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      before: before || undefined,
    });
  }

  @Get('/:messageId')
  async getMessage(@Param('messageId') messageId: string) {
    return this.messagesService.getMessage(messageId);
  }

  @Patch('/:messageId')
  async editMessage(@Param('messageId') messageId: string, @Body() body: any) {
    return this.messagesService.editMessage(messageId, body);
  }

  @Delete('/:messageId')
  async deleteMessage(@Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(messageId);
  }
}
