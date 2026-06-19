-- Persisted triage state for invites/opportunities, one row per contact (DM
-- partner, keyed by chat_id). The "Convites & oportunidades" section detects
-- invites per message from message_enrichment (category convite /
-- oportunidade/parceria), so the same person repeats and there is no saved
-- state — everything looked "em aberto" forever. This table gives each contact
-- a real, persisted status (aberto / resolvido / ignorado) plus a reference to
-- the representative source message, so the count of "em aberto" finally means
-- something and invites can be triaged into a Kanban / turned into tasks.
--
-- whatsapp_messages stays READ-ONLY: we only store chat_id (text) + the latest
-- source_message_id (text), never an FK to it.

create table if not exists invite_triage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  chat_id text not null,
  status text not null default 'aberto',
  contact_id uuid references contacts(id) on delete set null,
  source_message_id text,
  direction text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, chat_id),
  constraint invite_triage_status_chk check (status in ('aberto','resolvido','ignorado'))
);
create index if not exists invite_triage_tenant_idx on invite_triage (tenant_id);

alter table invite_triage enable row level security;
drop policy if exists invite_triage_tenant on invite_triage;
create policy invite_triage_tenant on invite_triage for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
