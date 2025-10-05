import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParticipantsService } from '../services/participants.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ConversationAccessGuard } from '../guards/conversation-access.guard';

@Controller('conversations/:conversationId/participants')
@UseGuards(JwtAuthGuard, ConversationAccessGuard)
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  async list(@Param('conversationId') conversationId: string) {
    return this.participantsService.listParticipants(conversationId);
  }

  @Post()
  async add(
    @Param('conversationId') conversationId: string,
    @Body() body: any,
  ) {
    return this.participantsService.addParticipant(conversationId, body);
  }

  @Patch(':userId')
  async update(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
    @Body() body: any,
  ) {
    return this.participantsService.updateParticipant(
      conversationId,
      userId,
      body,
    );
  }

  @Delete(':userId')
  async remove(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ) {
    return this.participantsService.removeParticipant(conversationId, userId);
  }
}
