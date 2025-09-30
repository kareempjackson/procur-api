export type ListConversationsQuery = {
  type?: 'direct' | 'group' | 'contextual';
  contextType?: string;
  contextId?: string;
  archived?: boolean | string;
  limit?: number | string;
};
