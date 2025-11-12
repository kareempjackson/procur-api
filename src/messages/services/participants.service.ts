import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class ParticipantsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listParticipants(conversationId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversation_participants')
      .select(
        `
        *,
        users:user_id (
          id,
          email,
          full_name:fullname
        ),
        organizations:org_id (
          id,
          name,
          business_name,
          country,
          address,
          logo_url
        )
      `,
      )
      .eq('conversation_id', conversationId)
      .eq('is_removed', false);
    if (error) throw error;
    return data;
  }

  async addParticipant(conversationId: string, body: any) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversation_participants')
      .insert([
        {
          conversation_id: conversationId,
          user_id: body.userId,
          org_id: body.orgId ?? null,
          role: body.role ?? 'member',
          permissions: body.permissions ?? {},
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateParticipant(
    conversationId: string,
    userId: string,
    updates: any,
  ) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversation_participants')
      .update({
        role: updates.role ?? undefined,
        muted_until: updates.muted_until ?? undefined,
        permissions: updates.permissions ?? undefined,
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async removeParticipant(conversationId: string, userId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversation_participants')
      .update({ is_removed: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
