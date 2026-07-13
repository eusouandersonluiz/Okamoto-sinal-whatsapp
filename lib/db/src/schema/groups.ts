import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

export const groupsTable = pgTable(
  "groups",
  {
    chatId: text("chat_id"),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name"),
    messageCount: integer("message_count"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    // Group-management state (see migration 0010_group_management.sql).
    relevance: text("relevance").notNull().default("monitored"),
    category: text("category"),
    tags: text("tags").array(),
    alias: text("alias"),
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    digestCadence: text("digest_cadence").notNull().default("weekly"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    // Real member count from uazapi /group/info (see migration 0012).
    participantCount: integer("participant_count"),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.chatId] })],
);

// Group members fetched from uazapi POST /group/info (group-deep-dive).
export const groupParticipantsTable = pgTable(
  "group_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    chatId: text("chat_id").notNull(),
    lid: text("lid").notNull(),
    phone: text("phone"),
    name: text("name"),
    isAdmin: boolean("is_admin").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.chatId, t.lid)],
);

// User-managed list of groups treated as "support/noise" and hidden by default
// on the Mentions page. Replaces the formerly hardcoded list in scope.ts.
export const supportGroupsTable = pgTable(
  "support_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    chatId: text("chat_id").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.tenantId, t.chatId)],
);

export const groupDigestsTable = pgTable("group_digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  chatId: text("chat_id"),
  periodStart: date("period_start", { mode: "string" }),
  periodEnd: date("period_end", { mode: "string" }),
  summary: text("summary"),
  topExcerpts: jsonb("top_excerpts"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Group = typeof groupsTable.$inferSelect;
export type GroupDigest = typeof groupDigestsTable.$inferSelect;
export type SupportGroup = typeof supportGroupsTable.$inferSelect;
export type GroupParticipant = typeof groupParticipantsTable.$inferSelect;
