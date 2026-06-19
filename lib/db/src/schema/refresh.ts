import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// One row per run of the incremental data-refresh pipeline. Mirrors migration
// 0009_refresh_runs.sql. See lib/db/src/pipeline.ts for the orchestration that
// reads/writes these rows (start with concurrency lock, execute, finalize).
export const refreshRunsTable = pgTable("refresh_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  jobs: jsonb("jobs"),
  error: text("error"),
});

export type RefreshRunRow = typeof refreshRunsTable.$inferSelect;
