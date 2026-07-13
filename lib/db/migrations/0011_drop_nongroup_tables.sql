-- Refocus on groups: drop the tables owned by the removed features (CRM/
-- contacts, mentions, saved, tasks, Google OAuth). The data loss is intended
-- (see the refocus-on-groups change). `cascade` also drops dependent FKs/objects.
--
-- Left in place (kept schemas / edge): invite_triage and media_assets live in
-- enrichment.ts (kept); pending_dismissals is not part of a removed schema.

drop table if exists contact_labels cascade;
drop table if exists contact_identifiers cascade;
drop table if exists labels cascade;
drop table if exists contacts cascade;
drop table if exists mentions cascade;
drop table if exists monitored_entities cascade;
drop table if exists saved_items cascade;
drop table if exists tasks cascade;
drop table if exists google_oauth_tokens cascade;
drop table if exists google_oauth_states cascade;
