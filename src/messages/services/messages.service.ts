import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async sendMessage(conversationId: string, body: any, userId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_user_id: body.senderUserId || userId,
          sender_org_id: body.senderOrgId ?? null,
          parent_message_id: body.parent_message_id ?? null,
          content_type: body.content_type ?? 'text',
          text: body.text ?? null,
          rich_content: body.rich_content ?? null,
          metadata: body.metadata ?? {},
        },
      ])
      .select()
      .single();
    if (error) throw error;

    // Emit real-time notification to other participants
    try {
      const participants =
        await this.getConversationParticipants(conversationId);
      participants.forEach((p) => {
        if (p.user_id !== userId) {
          this.notificationsGateway.emitToUser(p.user_id, 'new_message', {
            conversationId,
            message: data,
          });
        }
      });
    } catch (e) {
      // Don't fail message send if notification fails
      console.error('Failed to emit message notification:', e);
    }

    return data;
  }

  async getConversationParticipants(conversationId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversation_participants')
      .select('user_id, org_id, role')
      .eq('conversation_id', conversationId)
      .eq('is_removed', false);
    if (error) throw error;
    return data || [];
  }

  async getOtherParticipants(conversationId: string, currentUserId: string) {
    const participants = await this.getConversationParticipants(conversationId);
    return participants.filter((p) => p.user_id !== currentUserId);
  }

  async listMessages(
    conversationId: string,
    opts: { parentMessageId?: string; limit?: number; before?: string },
  ) {
    const client = this.supabase.getClient();
    let q = client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50);
    if (opts.parentMessageId)
      q = q.eq('parent_message_id', opts.parentMessageId);
    if (opts.before) q = q.lt('id', opts.before);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async getMessage(messageId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    if (error) throw error;
    return data;
  }

  async editMessage(messageId: string, updates: any) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('messages')
      .update({
        text: updates.text ?? null,
        rich_content: updates.rich_content ?? null,
        metadata: updates.metadata ?? undefined,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteMessage(messageId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
