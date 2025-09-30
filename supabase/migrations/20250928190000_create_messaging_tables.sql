-- Messaging schema: conversations, participants, messages, attachments, reactions, receipts

-- Enums
CREATE TYPE conversation_type AS ENUM ('direct', 'group', 'contextual');
CREATE TYPE participant_role AS ENUM ('member', 'admin');
CREATE TYPE message_content_type AS ENUM ('text', 'image', 'file', 'system');
CREATE TYPE receipt_status AS ENUM ('delivered', 'read');

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type NOT NULL,
  title VARCHAR(255),
  context_type VARCHAR(100),
  context_id UUID,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role participant_role DEFAULT 'member',
  muted_until TIMESTAMP WITH TIME ZONE,
  last_read_message_id UUID,
  is_removed BOOLEAN DEFAULT false,
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sender_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  content_type message_content_type DEFAULT 'text',
  text TEXT,
  rich_content JSONB,
  metadata JSONB DEFAULT '{}',
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attachments
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(255),
  thumbnail_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reactions
CREATE TABLE message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Read receipts
CREATE TABLE message_read_receipts (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status receipt_status DEFAULT 'delivered',
  read_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (message_id, user_id)
);

-- Function: ensure message sender is participant and not removed
CREATE OR REPLACE FUNCTION validate_message_sender_participant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id = NEW.sender_user_id
      AND cp.is_removed = false
  ) THEN
    RAISE EXCEPTION 'Sender is not an active participant of the conversation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_message_sender_participant_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION validate_message_sender_participant();

-- Indexes
CREATE INDEX idx_conversations_created_by ON conversations(created_by_user_id);
CREATE INDEX idx_conversations_context ON conversations(context_type, context_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_messages_conversation_created_at ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_parent_message ON messages(parent_message_id);
CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);

-- Full-text search index on messages.text
CREATE INDEX idx_messages_text_search ON messages USING gin (to_tsvector('english', coalesce(text, '')));

-- Triggers for updated_at
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


