-- Group management state (refocus-on-groups). Extends the existing `groups`
-- table with columns the group-management UI drives. Additive + idempotent;
-- does not touch the read-only source table `whatsapp_messages`.
--
-- relevance       -> 'monitored' (default) | 'ignored' (excluded from analyses)
-- category / tags -> user-defined grouping and free tags
-- alias           -> display name overriding the WhatsApp `name`
-- digest_enabled  -> whether digests are generated for this group
-- digest_cadence  -> 'daily' | 'weekly' (default 'weekly')
-- archived_at     -> when archived (hidden from default lists; reversible)

alter table groups add column if not exists relevance text not null default 'monitored'
  check (relevance in ('monitored', 'ignored'));
alter table groups add column if not exists category text;
alter table groups add column if not exists tags text[];
alter table groups add column if not exists alias text;
alter table groups add column if not exists digest_enabled boolean not null default true;
alter table groups add column if not exists digest_cadence text not null default 'weekly'
  check (digest_cadence in ('daily', 'weekly'));
alter table groups add column if not exists archived_at timestamptz;

-- Backfill: groups previously flagged as support/noise become 'ignored'.
-- support_groups is left in place for now; code migrates off it in later phases.
update groups g
  set relevance = 'ignored'
  from support_groups s
  where s.tenant_id = g.tenant_id
    and s.chat_id = g.chat_id
    and g.relevance = 'monitored';
