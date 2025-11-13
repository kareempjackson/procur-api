-- Full-text search support and hybrid search function

-- FTS index
create index if not exists ai_embeddings_fts_idx
on ai_embeddings using gin (to_tsvector('english', coalesce(title,'') || ' ' || content));

-- Hybrid search: combine vector similarity and BM25 (ts_rank)
create or replace function public.search_ai_embeddings_hybrid(
  p_org uuid,
  p_scopes text[],
  p_query vector(1536),
  p_terms text,
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
  with base as (
    select
      e.id,
      e.scope,
      e.ref_id,
      e.title,
      e.content,
      e.metadata,
      (1 - (e.embedding <=> p_query)) as cos_sim,
      ts_rank(
        to_tsvector('english', coalesce(e.title,'') || ' ' || e.content),
        plainto_tsquery('english', coalesce(p_terms, ''))
      ) as fts_rank
    from ai_embeddings e
    where e.org_id = p_org
      and (p_scopes is null or cardinality(p_scopes) = 0 or e.scope = any(p_scopes))
  )
  select
    id, scope, ref_id, title, content, metadata,
    -- Blend scores; weights can be tuned (0.7 vector, 0.3 fts)
    (0.7 * cos_sim + 0.3 * fts_rank) as score
  from base
  order by (0.7 * cos_sim + 0.3 * fts_rank) desc
  limit greatest(1, p_k);
$$;

comment on function public.search_ai_embeddings_hybrid is
  'Hybrid search combining vector similarity and full-text relevance, filtered by org and scopes.';


