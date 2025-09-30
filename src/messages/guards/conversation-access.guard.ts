import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class ConversationAccessGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const conversationId = req.params.conversationId || req.params.id;

    if (!user || !conversationId) {
      throw new ForbiddenException('Access denied');
    }

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ForbiddenException('Not a conversation participant');
    return true;
  }
}
