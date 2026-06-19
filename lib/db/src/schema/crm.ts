import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactsTable = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  description: text("description"),
  primaryPhone: text("primary_phone"),
  googleResourceName: text("google_resource_name"),
  dominantCategory: text("dominant_category"),
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
  aiAnalysis: text("ai_analysis"),
  aiAnalysisAt: timestamp("ai_analysis_at", { withTimezone: true }),
  aiAnalysisMsgCount: integer("ai_analysis_msg_count"),
  source: text("source").notNull().default("dm"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const contactIdentifiersTable = pgTable("contact_identifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contactId: uuid("contact_id").references(() => contactsTable.id, {
    onDelete: "cascade",
  }),
  phone: text("phone").notNull(),
  source: text("source"),
});

export const labelsTable = pgTable("labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name"),
  color: text("color"),
});

export const contactLabelsTable = pgTable(
  "contact_labels",
  {
    contactId: uuid("contact_id").references(() => contactsTable.id, {
      onDelete: "cascade",
    }),
    labelId: uuid("label_id").references(() => labelsTable.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.labelId] })],
);

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLabelSchema = createInsertSchema(labelsTable).omit({
  id: true,
});

export type Contact = typeof contactsTable.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactIdentifier = typeof contactIdentifiersTable.$inferSelect;
export type Label = typeof labelsTable.$inferSelect;
