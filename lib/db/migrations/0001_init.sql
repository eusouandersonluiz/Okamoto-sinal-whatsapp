-- Sinal — Phase 1 schema. All new tables live in the same Supabase DB as the
-- read-only source table `whatsapp_messages`. We never alter that table:
-- no FKs reference it, no indexes are added to it. message_id is stored as
-- plain text here and referential integrity is enforced in application code.

-- Multi-tenant from day 1: tenant_id + RLS on every table.

-- ============================================================
-- Tenancy
-- ============================================================
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

-- profiles maps a Supabase auth user -> tenant
create table if not exists profiles (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CRM
-- ============================================================
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  display_name text,
  email text,
  description text,
  primary_phone text,
  google_resource_name text,
  dominant_category text,
  last_interaction_at timestamptz,
  source text not null default 'dm',          -- 'dm' | 'promoted'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists contacts_tenant_phone_uq
  on contacts (tenant_id, primary_phone) where primary_phone is not null;
create index if not exists contacts_tenant_idx on contacts (tenant_id);
create index if not exists contacts_tenant_category_idx on contacts (tenant_id, dominant_category);

create table if not exists contact_identifiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contact_id uuid references contacts(id) on delete cascade,
  phone text not null,
  source text,
  unique (tenant_id, phone)
);

create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text,
  color text
);

create table if not exists contact_labels (
  contact_id uuid references contacts(id) on delete cascade,
  label_id uuid references labels(id) on delete cascade,
  primary key (contact_id, label_id)
);

-- ============================================================
-- Per-message enrichment (1:1 with whatsapp_messages.message_id)
-- ============================================================
create table if not exists message_enrichment (
  message_id text primary key,
  tenant_id uuid not null,
  chat_type text,
  category text,
  sentiment text,
  topics text[],
  is_question boolean,
  requires_reply boolean,
  summary text,
  model_used text,
  processed_at timestamptz not null default now()
);
create index if not exists me_tenant_category_idx on message_enrichment (tenant_id, category);
create index if not exists me_tenant_chattype_idx on message_enrichment (tenant_id, chat_type);
create index if not exists me_requires_reply_idx on message_enrichment (tenant_id, requires_reply);

-- Processed media (Whisper / OCR)
create table if not exists media_assets (
  message_id text primary key,
  tenant_id uuid not null,
  kind text,                                  -- 'audio' | 'image'
  extracted_text text,
  status text not null default 'pending',     -- 'pending' | 'done' | 'error'
  model_used text,
  processed_at timestamptz
);
create index if not exists media_tenant_status_idx on media_assets (tenant_id, status);

-- ============================================================
-- Topics / pautas (private and group)
-- ============================================================
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  label text,
  scope text,                                 -- 'private' | 'group'
  period_start date,
  period_end date,
  person_count int,
  message_count int,
  trend text,
  summary text,
  created_at timestamptz not null default now()
);
create index if not exists topics_tenant_scope_idx on topics (tenant_id, scope);

create table if not exists topic_messages (
  topic_id uuid references topics(id) on delete cascade,
  message_id text,
  primary key (topic_id, message_id)
);

create table if not exists topic_groups (
  topic_id uuid references topics(id) on delete cascade,
  chat_id text,
  message_count int,
  primary key (topic_id, chat_id)
);

-- ============================================================
-- Monitored entities + mentions
-- ============================================================
create table if not exists monitored_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text,
  type text,                                  -- 'person' | 'product' | 'competitor'
  aliases text[]
);
create index if not exists entities_tenant_idx on monitored_entities (tenant_id);

create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  message_id text,
  entity_id uuid references monitored_entities(id) on delete cascade,
  mention_type text,                          -- elogio|critica|objecao|recomendacao|indireta|neutra
  sentiment text,
  created_at timestamptz not null default now()
);
create index if not exists mentions_tenant_entity_idx on mentions (tenant_id, entity_id);
create index if not exists mentions_tenant_type_idx on mentions (tenant_id, mention_type);

-- ============================================================
-- Groups (derived metadata) + digests
-- ============================================================
create table if not exists groups (
  chat_id text,
  tenant_id uuid not null,
  name text,
  message_count int,
  last_activity_at timestamptz,
  primary key (tenant_id, chat_id)
);

create table if not exists group_digests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  chat_id text,
  period_start date,
  period_end date,
  summary text,
  top_excerpts jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Tasks (central) + Saved items
-- ============================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contact_id uuid references contacts(id) on delete set null,
  title text,
  direction text,                             -- 'mine' | 'theirs' | 'internal'
  source_message_id text,
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_tenant_done_idx on tasks (tenant_id, done);
create index if not exists tasks_tenant_contact_idx on tasks (tenant_id, contact_id);

create table if not exists saved_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  kind text,                                  -- 'pauta' | 'prova_social'
  source_type text,                           -- 'topic' | 'mention'
  source_id text,
  text text,
  created_at timestamptz not null default now()
);
create index if not exists saved_tenant_idx on saved_items (tenant_id);

-- ============================================================
-- RLS: helper + enable + tenant-scoped policies (for authenticated role).
-- The server connects as the table owner (pooler `postgres`), which bypasses
-- RLS, so application code enforces tenant_id. These policies isolate any
-- future direct PostgREST/anon access by tenant.
-- ============================================================
create or replace function public.current_tenant_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

do $$
declare
  t text;
  tenant_tables text[] := array[
    'tenants','profiles','contacts','contact_identifiers','labels',
    'message_enrichment','media_assets','topics','monitored_entities',
    'mentions','groups','group_digests','tasks','saved_items'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tenants table: a user can see their own tenant row
drop policy if exists tenants_self on tenants;
create policy tenants_self on tenants for all to authenticated
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

-- profiles: a user can see their own profile
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Standard tenant-scoped tables
do $$
declare
  t text;
  scoped text[] := array[
    'contacts','contact_identifiers','labels','message_enrichment',
    'media_assets','topics','monitored_entities','mentions','groups',
    'group_digests','tasks','saved_items'
  ];
begin
  foreach t in array scoped loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      t || '_tenant', t
    );
  end loop;
end $$;

-- Join tables: scope via parent + enable RLS
alter table contact_labels enable row level security;
drop policy if exists contact_labels_tenant on contact_labels;
create policy contact_labels_tenant on contact_labels for all to authenticated
  using (exists (select 1 from contacts c where c.id = contact_labels.contact_id and c.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from contacts c where c.id = contact_labels.contact_id and c.tenant_id = public.current_tenant_id()));

alter table topic_messages enable row level security;
drop policy if exists topic_messages_tenant on topic_messages;
create policy topic_messages_tenant on topic_messages for all to authenticated
  using (exists (select 1 from topics tp where tp.id = topic_messages.topic_id and tp.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from topics tp where tp.id = topic_messages.topic_id and tp.tenant_id = public.current_tenant_id()));

alter table topic_groups enable row level security;
drop policy if exists topic_groups_tenant on topic_groups;
create policy topic_groups_tenant on topic_groups for all to authenticated
  using (exists (select 1 from topics tp where tp.id = topic_groups.topic_id and tp.tenant_id = public.current_tenant_id()))
  with check (exists (select 1 from topics tp where tp.id = topic_groups.topic_id and tp.tenant_id = public.current_tenant_id()));

-- ============================================================
-- Seed: tenant #1 (Bruno) + Bruno as a monitored entity
-- ============================================================
insert into tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Bruno')
on conflict (id) do nothing;

insert into monitored_entities (tenant_id, name, type, aliases)
select '00000000-0000-0000-0000-000000000001', 'Bruno', 'person',
  array['Bruno','Okamoto','Bruno Okamoto']
where not exists (
  select 1 from monitored_entities
  where tenant_id = '00000000-0000-0000-0000-000000000001' and name = 'Bruno'
);
