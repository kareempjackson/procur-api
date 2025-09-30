import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async createConversation(body: any) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversations')
      .insert([
        {
          type: body.type,
          title: body.title ?? null,
          context_type: body.context?.type ?? null,
          context_id: body.context?.id ?? null,
          created_by_user_id: body.createdByUserId,
          created_by_org_id: body.createdByOrgId ?? null,
          metadata: body.metadata ?? {},
        },
      ])
      .select()
      .single();
    if (error) throw error;

    const conversation = data;

    if (Array.isArray(body.participants) && body.participants.length > 0) {
      const participants = body.participants.map((p: any) => ({
        conversation_id: conversation.id,
        user_id: p.userId,
        org_id: p.orgId ?? null,
        role: p.role ?? 'member',
        permissions: p.permissions ?? {},
      }));
      const { error: pErr } = await client
        .from('conversation_participants')
        .insert(participants);
      if (pErr) throw pErr;
    }

    return conversation;
  }

  async listConversations(query: any) {
    const client = this.supabase.getClient();
    let q = client
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (query.type) q = q.eq('type', query.type);
    if (query.contextType) q = q.eq('context_type', query.contextType);
    if (query.contextId) q = q.eq('context_id', query.contextId);
    if (typeof query.archived !== 'undefined')
      q = q.eq(
        'is_archived',
        query.archived === 'true' || query.archived === true,
      );
    if (query.limit) q = q.limit(parseInt(query.limit, 10));
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async getConversation(id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async updateConversation(id: string, updates: any) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversations')
      .update({
        title: updates.title ?? null,
        metadata: updates.metadata ?? undefined,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
