import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class MessagesService {
  constructor(private readonly supabase: SupabaseService) {}

  async sendMessage(conversationId: string, body: any) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_user_id: body.senderUserId,
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
    return data;
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
