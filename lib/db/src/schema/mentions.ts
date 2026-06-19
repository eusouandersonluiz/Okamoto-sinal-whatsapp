import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monitoredEntitiesTable = pgTable("monitored_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name"),
  type: text("type"),
  aliases: text("aliases").array(),
});

export const mentionsTable = pgTable("mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  messageId: text("message_id"),
  entityId: uuid("entity_id").references(() => monitoredEntitiesTable.id, {
    onDelete: "cascade",
  }),
  mentionType: text("mention_type"),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMonitoredEntitySchema = createInsertSchema(
  monitoredEntitiesTable,
).omit({ id: true });

export type MonitoredEntity = typeof monitoredEntitiesTable.$inferSelect;
export type InsertMonitoredEntity = z.infer<
  typeof insertMonitoredEntitySchema
>;
export type Mention = typeof mentionsTable.$inferSelect;
