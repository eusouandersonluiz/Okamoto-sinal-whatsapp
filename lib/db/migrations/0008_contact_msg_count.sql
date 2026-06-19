-- Cache each contact's private (DM) message volume on the contacts row so the
-- /contacts list no longer scans the whole READ-ONLY whatsapp_messages table
-- (~85k rows, un-indexable) on every request. The cached count is refreshed by
-- the backfill-contacts job via refreshContactMsgCounts() (see lib/db), using
-- the same effective-phone keying as the per-contact history/metrics endpoints
-- so the numbers stay consistent across screens.
--
-- msg_count     -> cached count of private messages attributed to this contact
-- msg_count_at  -> when that count was last refreshed (null = never)

alter table contacts add column if not exists msg_count integer not null default 0;
alter table contacts add column if not exists msg_count_at timestamptz;
