import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const messageEnrichmentTable = pgTable("message_enrichment", {
  messageId: text("message_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  chatType: text("chat_type"),
  category: text("category"),
  sentiment: text("sentiment"),
  topics: text("topics").array(),
  isQuestion: boolean("is_question"),
  requiresReply: boolean("requires_reply"),
  summary: text("summary"),
  modelUsed: text("model_used"),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mediaAssetsTable = pgTable("media_assets", {
  messageId: text("message_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  kind: text("kind"),
  extractedText: text("extracted_text"),
  status: text("status").notNull().default("pending"),
  modelUsed: text("model_used"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// Persisted triage state for invites/opportunities, one row per contact (DM
// partner, keyed by chat_id). Mirrors migration 0006_invite_triage.sql.
export const inviteTriageTable = pgTable("invite_triage", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  chatId: text("chat_id").notNull(),
  status: text("status").notNull().default("aberto"),
  contactId: uuid("contact_id"),
  sourceMessageId: text("source_message_id"),
  direction: text("direction"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MessageEnrichment = typeof messageEnrichmentTable.$inferSelect;
export type MediaAsset = typeof mediaAssetsTable.$inferSelect;
export type InviteTriage = typeof inviteTriageTable.$inferSelect;
