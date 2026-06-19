import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedItemsTable = pgTable("saved_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  kind: text("kind"),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  text: text("text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSavedItemSchema = createInsertSchema(savedItemsTable).omit({
  id: true,
  createdAt: true,
});

export type SavedItem = typeof savedItemsTable.$inferSelect;
export type InsertSavedItem = z.infer<typeof insertSavedItemSchema>;
