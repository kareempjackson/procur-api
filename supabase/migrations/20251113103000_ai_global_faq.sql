-- Make ai_embeddings support global rows (org_id nullable) and include them in search

-- 1) Allow org_id to be NULL
alter table ai_embeddings
  alter column org_id drop not null;

-- 2) Update RLS policy to allow selecting global rows (org_id is null)
drop policy if exists "Organizations can view their own embeddings." on ai_embeddings;
create policy "View org or global embeddings" on ai_embeddings
  for select
  using (
    org_id is null
    or org_id in (
      select organization_id
      from organization_users
      where user_id = auth.uid()
    )
  );

-- 3) Update existing search RPC to include global rows
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
  where (e.org_id = p_org or e.org_id is null)
    and (p_scopes is null or cardinality(p_scopes) = 0 or e.scope = any(p_scopes))
  order by e.embedding <=> p_query
  limit greatest(1, p_k);
$$;

-- 4) Update hybrid RPC to include global rows
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
    where (e.org_id = p_org or e.org_id is null)
      and (p_scopes is null or cardinality(p_scopes) = 0 or e.scope = any(p_scopes))
  )
  select
    id, scope, ref_id, title, content, metadata,
    (0.7 * cos_sim + 0.3 * fts_rank) as score
  from base
  order by (0.7 * cos_sim + 0.3 * fts_rank) desc
  limit greatest(1, p_k);
$$;


