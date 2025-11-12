import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from '../services/conversations.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ListConversationsQuery } from '../dto/list-conversations.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ConversationAccessGuard } from '../guards/conversation-access.guard';
import { UserContext } from '../../common/interfaces/jwt-payload.interface';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.conversationsService.createConversation(dto, user.id);
  }

  @Post('start')
  async startConversation(
    @Body()
    dto: {
      withUserId?: string;
      withOrgId?: string;
      contextType?: string;
      contextId?: string;
      title?: string;
    },
    @CurrentUser() user: UserContext,
  ) {
    return this.conversationsService.createOrGetConversation({
      type: dto.contextType ? 'contextual' : 'direct',
      contextType: dto.contextType,
      contextId: dto.contextId,
      currentUserId: user.id,
      currentOrgId: user.organizationId,
      otherUserId: dto.withUserId,
      otherOrgId: dto.withOrgId,
      title: dto.title,
    });
  }

  @Get()
  async listConversations(
    @Query() query: ListConversationsQuery,
    @CurrentUser() user: UserContext,
  ) {
    return this.conversationsService.listConversations(query, user.id);
  }

  @Get(':id')
  @UseGuards(ConversationAccessGuard)
  async getConversation(@Param('id') id: string) {
    return this.conversationsService.getConversation(id);
  }

  @Patch(':id')
  @UseGuards(ConversationAccessGuard)
  async updateConversation(@Param('id') id: string, @Body() body: any) {
    return this.conversationsService.updateConversation(id, body);
  }

  @Get(':id/unread-count')
  @UseGuards(ConversationAccessGuard)
  async getUnreadCount(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    const count = await this.conversationsService.getUnreadCount(user.id, id);
    return { conversationId: id, unreadCount: count };
  }

  @Post(':id/mark-read')
  @UseGuards(ConversationAccessGuard)
  async markAsRead(
    @Param('id') id: string,
    @Body() body: { messageId: string },
    @CurrentUser() user: UserContext,
  ) {
    return this.conversationsService.markAsRead(user.id, id, body.messageId);
  }
}
