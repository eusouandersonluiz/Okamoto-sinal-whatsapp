-- Group participants (group-deep-dive). Members fetched from uazapi
-- POST /group/info, persisted per group. lid is the stable linked-id; phone may
-- be null (privacy / lid-only). participant_count on groups holds the real count.
-- Additive + idempotent; does not touch the read-only whatsapp_messages.

create table if not exists group_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  chat_id text not null,
  lid text not null,
  phone text,
  name text,
  is_admin boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (tenant_id, chat_id, lid)
);

create index if not exists group_participants_group
  on group_participants (tenant_id, chat_id);

alter table groups add column if not exists participant_count integer;
