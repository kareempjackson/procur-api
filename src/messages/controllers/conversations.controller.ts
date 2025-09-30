import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationsService } from '../services/conversations.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ListConversationsQuery } from '../dto/list-conversations.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async createConversation(@Body() dto: CreateConversationDto) {
    return this.conversationsService.createConversation(dto);
  }

  @Get()
  async listConversations(@Query() query: ListConversationsQuery) {
    return this.conversationsService.listConversations(query);
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.conversationsService.getConversation(id);
  }

  @Patch(':id')
  async updateConversation(@Param('id') id: string, @Body() body: any) {
    return this.conversationsService.updateConversation(id, body);
  }
}
