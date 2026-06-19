-- Support/noise groups, now user-managed instead of hardcoded in app code
-- (was artifacts/api-server/src/lib/scope.ts SUPPORT_GROUP_CHAT_IDS /
-- SUPPORT_GROUP_NAME_PATTERNS). The Mentions filter reads this table so Bruno
-- can mark/unmark groups as "suporte/ruído" without a code deploy.
-- whatsapp_messages stays read-only: we only store chat_id (text) + a name copy.

create table if not exists support_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  chat_id text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (tenant_id, chat_id)
);
create index if not exists support_groups_tenant_idx on support_groups (tenant_id);

alter table support_groups enable row level security;
drop policy if exists support_groups_tenant on support_groups;
create policy support_groups_tenant on support_groups for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Seed: preserve the previously hardcoded support groups for tenant #1 (Bruno),
-- so the default "ocultar grupos de suporte" behavior is unchanged after merge.
insert into support_groups (tenant_id, chat_id, name)
values
  ('00000000-0000-0000-0000-000000000001', '120363426310596403', 'Suporte com @Openclawzinho'),
  ('00000000-0000-0000-0000-000000000001', '120363423863477359', 'Suporte com @Brainzinho')
on conflict (tenant_id, chat_id) do nothing;
