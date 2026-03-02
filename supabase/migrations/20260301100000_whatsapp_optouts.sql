-- Persistent WhatsApp opt-out store.
-- Redis wa:optout:{phone} is the fast cache; this table is the source of truth
-- so opt-outs survive a Redis flush.
create table if not exists whatsapp_optouts (
  phone_e164 text primary key,        -- E.164 without leading + (matches wa:optout: key format)
  opted_out_at timestamptz not null default now()
);

-- Allow the service role to read/write
alter table whatsapp_optouts enable row level security;
create policy "service role full access"
  on whatsapp_optouts
  using (true)
  with check (true);
