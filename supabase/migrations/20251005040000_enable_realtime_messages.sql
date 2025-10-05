-- Enable real-time replication for messaging tables
-- This allows Supabase real-time subscriptions to work

-- Enable real-time on conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable real-time on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable real-time on conversation_participants table
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

-- Enable real-time on message_read_receipts table (for read status)
ALTER PUBLICATION supabase_realtime ADD TABLE message_read_receipts;

-- Add comment
COMMENT ON PUBLICATION supabase_realtime IS 'Real-time replication publication for messaging system';

