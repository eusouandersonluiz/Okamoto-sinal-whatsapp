-- Tracks each run of the incremental data-refresh pipeline (the one that feeds
-- every tab: classify new -> contacts -> topics -> mentions). One row per cycle,
-- scoped by tenant. Powers the dashboard "Atualizar" button ("última
-- atualização" + live "Atualizando..." state) and the 6-hourly automatic refresh.
--
-- status    -> 'running' | 'completed' | 'failed'
-- trigger   -> 'manual' (dashboard button) | 'scheduled' (6h automation)
-- jobs      -> JSON array of per-step results [{label, script, code}]
-- error     -> human-readable summary when the cycle failed

create table if not exists refresh_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  trigger text not null check (trigger in ('manual', 'scheduled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  jobs jsonb,
  error text
);

-- Concurrency lock: at most one running cycle per tenant. A second start (manual
-- click while a cycle runs, or the 6h job colliding with a manual one) hits this
-- unique violation and is refused instead of double-spending AI budget.
create unique index if not exists refresh_runs_one_running
  on refresh_runs (tenant_id)
  where status = 'running';

-- Fast "latest cycle for this tenant" lookups for the status endpoint.
create index if not exists refresh_runs_tenant_started
  on refresh_runs (tenant_id, started_at desc);
