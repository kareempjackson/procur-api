-- Enable pgvector and create ai_embeddings table and search function
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS ai_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  ref_id UUID,
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_embeddings_org_scope ON ai_embeddings(org_id, scope);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_embedding ON ai_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Basic RLS: restrict rows by org_id membership
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_embeddings_select ON ai_embeddings;
CREATE POLICY ai_embeddings_select ON ai_embeddings
  FOR SELECT
  USING (
    org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid())
  );

-- Search function using cosine distance; pass embedding from client
CREATE OR REPLACE FUNCTION search_ai_embeddings(
  p_org UUID,
  p_scopes TEXT[],
  p_query VECTOR(1536),
  p_k INT DEFAULT 5
) RETURNS TABLE (
  id UUID,
  org_id UUID,
  scope TEXT,
  ref_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  score DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT e.id, e.org_id, e.scope, e.ref_id, e.title, e.content, e.metadata,
         1 - (e.embedding <=> p_query) AS score
  FROM ai_embeddings e
  WHERE e.org_id = p_org
    AND (p_scopes IS NULL OR e.scope = ANY(p_scopes))
  ORDER BY e.embedding <=> p_query
  LIMIT p_k
$$;


