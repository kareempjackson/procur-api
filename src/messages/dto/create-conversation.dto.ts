export type CreateConversationDto = {
  type: 'direct' | 'group' | 'contextual';
  title?: string;
  context?: { type: string; id: string };
  createdByUserId: string;
  createdByOrgId?: string;
  participants: Array<{
    userId: string;
    orgId?: string;
    role?: 'member' | 'admin';
    permissions?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
};
