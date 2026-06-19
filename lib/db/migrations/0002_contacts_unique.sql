-- Unique contact per tenant by phone, to support idempotent CRM backfill
-- (on conflict upsert). NULL primary_phone is allowed and not deduplicated.
create unique index if not exists contacts_tenant_phone_uniq
  on contacts (tenant_id, primary_phone)
  where primary_phone is not null;
