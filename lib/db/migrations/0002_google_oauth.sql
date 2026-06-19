-- Google OAuth tokens for Google Contacts (People API) sync. Tenant-scoped + RLS,
-- consistent with the multi-tenant model (one Google account per tenant).
create table if not exists google_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  google_sub text,
  email text,
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

alter table google_oauth_tokens enable row level security;

drop policy if exists google_oauth_tokens_tenant on google_oauth_tokens;
create policy google_oauth_tokens_tenant on google_oauth_tokens for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
