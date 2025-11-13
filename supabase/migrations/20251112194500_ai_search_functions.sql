-- Enable extension (no-op if already enabled)
create extension if not exists vector;

-- Ensure drop before recreate to avoid return type change conflicts
drop function if exists public.search_ai_embeddings(uuid, text[], vector(1536), int);
-- Similarity search over ai_embeddings with org/scopes filtering
create or replace function public.search_ai_embeddings(
  p_org uuid,
  p_scopes text[],
  p_query vector(1536),
  p_k int default 5
)
returns table (
  id uuid,
  scope text,
  ref_id uuid,
  title text,
  content text,
  metadata jsonb,
  score float
)
language sql
stable
as $$
  select
    e.id,
    e.scope,
    e.ref_id,
    e.title,
    e.content,
    e.metadata,
    1 - (e.embedding <=> p_query) as score
  from ai_embeddings e
  where e.org_id = p_org
    and (p_scopes is null or cardinality(p_scopes) = 0 or e.scope = any(p_scopes))
  order by e.embedding <=> p_query
  limit greatest(1, p_k);
$$;

-- LangChain-compatible function signature (queryName can be set to this)
-- Matches common pattern: (query_embedding, match_count, filter)
-- filter jsonb may include: {"org_id":"...","scopes":["faq","product"]}
create or replace function public.match_ai_embeddings(
  query_embedding vector(1536),
  match_count int default 5,
  filter jsonb default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  with f as (
    select
      (filter ->> 'org_id')::uuid as org_id,
      (select array_agg(value::text) from jsonb_array_elements_text(coalesce(filter->'scopes','[]'::jsonb))) as scopes
  )
  select
    e.id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from ai_embeddings e, f
  where (f.org_id is null or e.org_id = f.org_id)
    and (f.scopes is null or cardinality(f.scopes) = 0 or e.scope = any(f.scopes))
  order by e.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

comment on function public.search_ai_embeddings is
  'Vector similarity search over ai_embeddings with org and scopes filter. Returns score = cosine similarity.';

comment on function public.match_ai_embeddings is
  'LangChain-compatible similarity search over ai_embeddings using filter jsonb {org_id, scopes}.';


