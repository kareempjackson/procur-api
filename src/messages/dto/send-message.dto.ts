export type SendMessageDto = {
  senderUserId: string;
  senderOrgId?: string;
  parent_message_id?: string;
  content_type?: 'text' | 'image' | 'file' | 'system';
  text?: string;
  rich_content?: Record<string, any> | null;
  metadata?: Record<string, any>;
};
