-- Server-side OAuth state store so the Google connect/callback flow does NOT
-- depend on cookies. Needed because the app runs in a cross-site iframe: Google
-- cannot be framed, so connect must open in a real (first-party) tab, which does
-- not carry the iframe's partitioned session cookie. The state row resolves the
-- tenant on callback instead.
create table if not exists google_oauth_states (
  state text primary key,
  tenant_id uuid not null,
  user_id uuid,
  email text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table google_oauth_states enable row level security;

drop policy if exists google_oauth_states_tenant on google_oauth_states;
create policy google_oauth_states_tenant on google_oauth_states for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
