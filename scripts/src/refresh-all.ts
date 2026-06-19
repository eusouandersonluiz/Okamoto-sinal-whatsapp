import {
  pool,
  MVP_TENANT_ID,
  startRefreshRun,
  executeRefreshRun,
  RefreshAlreadyRunningError,
} from "@workspace/db";

// Unified incremental refresh — runs the whole data pipeline that feeds every
// tab in order, so a single run keeps Visão Geral, Privado, Grupos, Menções and
// Contatos current. The job order, cheap-provider defaults and resilience now
// live in @workspace/db (pipeline.ts) so this script, the dashboard "Atualizar"
// button and the in-process scheduler all share one definition and one
// concurrency lock.
//
// Designed to be the run command of a Scheduled Deployment (cron, every 6h). If
// a cycle is already running (e.g. a manual click), this exits 0 without
// starting a second one. Exits non-zero if any job failed so the scheduler
// surfaces the failure.
//
// Run: pnpm --filter @workspace/scripts run refresh-all
async function main(): Promise<void> {
  console.log(`[refresh-all] início — ${new Date().toISOString()}`);

  let run;
  try {
    run = await startRefreshRun(pool, {
      tenantId: MVP_TENANT_ID,
      trigger: "scheduled",
    });
  } catch (e) {
    if (e instanceof RefreshAlreadyRunningError) {
      console.log(
        "[refresh-all] já existe um ciclo em andamento; ignorando este disparo.",
      );
      await pool.end();
      process.exit(0);
    }
    throw e;
  }

  const finished = await executeRefreshRun(pool, run);
  const jobs = finished.jobs ?? [];
  const failed = jobs.filter((j) => j.code !== 0);

  console.log("\n[refresh-all] resumo:");
  for (const j of jobs)
    console.log(`  ${j.code === 0 ? "✓" : "✗"} ${j.label}`);
  console.log(
    `[refresh-all] ${jobs.length - failed.length}/${jobs.length} etapas ok — status ${finished.status} — ${new Date().toISOString()}`,
  );

  await pool.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main().catch(async (e) => {
  console.error("refresh-all failed:", (e as Error).message);
  await pool.end().catch(() => {});
  process.exit(1);
});
