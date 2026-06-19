-- Snooze/dismiss state for "não respondida" (unanswered) pendencies, so Bruno
-- can clear a pending contact from the Privado worklist for a chosen period
-- without it bouncing back on the next refresh. Keyed by chat_id (the DM
-- partner's phone), scoped by tenant. whatsapp_messages stays read-only: we only
-- store the chat_id (text) plus a snooze deadline.
--
-- snooze_until > now()  -> hidden from the unanswered queue
-- snooze_until <= now()  -> reappears automatically
-- snooze_until is null   -> dismissed indefinitely

create table if not exists pending_dismissals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  chat_id text not null,
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, chat_id)
);
create index if not exists pending_dismissals_tenant_idx on pending_dismissals (tenant_id);

alter table pending_dismissals enable row level security;
drop policy if exists pending_dismissals_tenant on pending_dismissals;
create policy pending_dismissals_tenant on pending_dismissals for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
