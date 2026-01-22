import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { EventsService } from '../../events/events.service';
import { EventTypes, AggregateTypes } from '../../events/event-types';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventsService: EventsService,
  ) {}

  async createConversation(body: any, userId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversations')
      .insert([
        {
          type: body.type,
          title: body.title ?? null,
          context_type: body.context?.type ?? null,
          context_id: body.context?.id ?? null,
          created_by_user_id: body.createdByUserId || userId,
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

    // Emit conversation created event
    await this.eventsService.emit({
      type: EventTypes.Message.CONVERSATION_CREATED,
      aggregateType: AggregateTypes.MESSAGE,
      aggregateId: conversation.id,
      actorId: userId,
      payload: {
        type: body.type,
        contextType: body.context?.type,
        contextId: body.context?.id,
      },
    });

    return conversation;
  }

  async createOrGetConversation(dto: {
    type: 'direct' | 'contextual';
    contextType?: string;
    contextId?: string;
    currentUserId: string;
    currentOrgId?: string;
    otherUserId?: string;
    otherOrgId?: string;
    title?: string;
  }) {
    const client = this.supabase.getClient();

    // If org is provided but not a specific user, resolve an active user from that org
    if (!dto.otherUserId && dto.otherOrgId) {
      const { data: orgUser, error: orgErr } = await client
        .from('organization_users')
        .select('user_id, joined_at')
        .eq('organization_id', dto.otherOrgId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (orgErr) throw orgErr;
      if (orgUser?.user_id) {
        dto.otherUserId = orgUser.user_id as string;
      }
    }
    // Check if conversation already exists for this context
    if (dto.contextType && dto.contextId) {
      const existing = await this.findByContext(dto.contextType, dto.contextId);
      if (existing) {
        // Make sure the current user is a participant
        await this.ensureParticipant(
          existing.id,
          dto.currentUserId,
          dto.currentOrgId,
        );
        // If the other user/org is provided, try to ensure they are a participant too
        if (dto.otherUserId) {
          await this.ensureParticipant(existing.id, dto.otherUserId);
        } else if (dto.otherOrgId) {
          // Resolve a user for the org and ensure presence
          const { data: orgUser } = await this.supabase
            .getClient()
            .from('organization_users')
            .select('user_id')
            .eq('organization_id', dto.otherOrgId)
            .eq('is_active', true)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (orgUser?.user_id) {
            await this.ensureParticipant(
              existing.id,
              orgUser.user_id as string,
            );
          }
        }
        return existing;
      }
    }

    // For direct messages, check if conversation already exists between these users
    if (dto.type === 'direct' && dto.otherUserId) {
      const existing = await this.findDirectConversation(
        dto.currentUserId,
        dto.otherUserId,
      );
      if (existing) {
        await this.ensureParticipant(
          existing.id,
          dto.currentUserId,
          dto.currentOrgId,
        );
        return existing;
      }
    }

    // Create new conversation with participants
    return this.createConversation(
      {
        type: dto.type,
        title: dto.title,
        context: dto.contextType
          ? { type: dto.contextType, id: dto.contextId }
          : undefined,
        createdByUserId: dto.currentUserId,
        createdByOrgId: dto.currentOrgId,
        participants: [
          {
            userId: dto.currentUserId,
            orgId: dto.currentOrgId,
            role: 'member',
          },
          ...(dto.otherUserId
            ? [{ userId: dto.otherUserId, role: 'member' as const }]
            : []),
        ],
      },
      dto.currentUserId,
    );
  }

  private async ensureParticipant(
    conversationId: string,
    userId: string,
    orgId?: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const { data: existing, error: checkErr } = await client
      .from('conversation_participants')
      .select('id, is_removed')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (checkErr) throw checkErr;

    if (!existing) {
      const { error: insertErr } = await client
        .from('conversation_participants')
        .insert([
          {
            conversation_id: conversationId,
            user_id: userId,
            org_id: orgId ?? null,
            role: 'member',
            permissions: {},
            is_removed: false,
          },
        ]);
      if (insertErr) throw insertErr;
    } else if (existing && existing.is_removed) {
      const { error: restoreErr } = await client
        .from('conversation_participants')
        .update({ is_removed: false })
        .eq('id', existing.id);
      if (restoreErr) throw restoreErr;
    }
  }

  async findByContext(contextType: string, contextId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findDirectConversation(userId1: string, userId2: string) {
    const client = this.supabase.getClient();
    // Find conversations where both users are participants and it's a direct type
    const { data, error } = await client
      .from('conversations')
      .select(
        `
        *,
        conversation_participants!inner(user_id)
      `,
      )
      .eq('type', 'direct')
      .in('conversation_participants.user_id', [userId1, userId2]);

    if (error) throw error;

    // Filter to find conversation where both users are present
    const conversation = data?.find((conv: any) => {
      const participantIds = conv.conversation_participants.map(
        (p: any) => p.user_id,
      );
      return (
        participantIds.includes(userId1) && participantIds.includes(userId2)
      );
    });

    return conversation || null;
  }

  async listConversations(query: any, userId: string) {
    const client = this.supabase.getClient();
    // Join with conversation_participants to filter by user
    let q = client
      .from('conversations')
      .select(
        `
        *,
        conversation_participants!inner(user_id)
      `,
      )
      .eq('conversation_participants.user_id', userId)
      .eq('conversation_participants.is_removed', false)
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

    // Remove the join data from response
    return data?.map((conv: any) => {
      const { conversation_participants, ...rest } = conv;
      return rest;
    });
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

  async getUnreadCount(
    userId: string,
    conversationId: string,
  ): Promise<number> {
    const client = this.supabase.getClient();

    // Get participant's last read message timestamp
    const { data: participant } = await client
      .from('conversation_participants')
      .select('last_read_message_id, joined_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!participant) return 0;

    // Count messages after last read or after join time
    let query = client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_user_id', userId)
      .is('deleted_at', null);

    // If user has read messages, count after last read
    if (participant.last_read_message_id) {
      // Get the timestamp of the last read message
      const { data: lastReadMsg } = await client
        .from('messages')
        .select('created_at')
        .eq('id', participant.last_read_message_id)
        .single();

      if (lastReadMsg) {
        query = query.gt('created_at', lastReadMsg.created_at);
      }
    } else {
      // Otherwise, count messages after user joined
      query = query.gt('created_at', participant.joined_at);
    }

    const { count, error } = await query;
    if (error) throw error;

    return count || 0;
  }

  async markAsRead(userId: string, conversationId: string, messageId: string) {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('conversation_participants')
      .update({ last_read_message_id: messageId })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  }
}
