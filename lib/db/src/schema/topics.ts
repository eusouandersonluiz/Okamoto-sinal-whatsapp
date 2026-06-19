import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const topicsTable = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  label: text("label"),
  scope: text("scope"),
  periodStart: date("period_start", { mode: "string" }),
  periodEnd: date("period_end", { mode: "string" }),
  personCount: integer("person_count"),
  messageCount: integer("message_count"),
  trend: text("trend"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const topicMessagesTable = pgTable(
  "topic_messages",
  {
    topicId: uuid("topic_id").references(() => topicsTable.id, {
      onDelete: "cascade",
    }),
    messageId: text("message_id"),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.messageId] })],
);

export const topicGroupsTable = pgTable(
  "topic_groups",
  {
    topicId: uuid("topic_id").references(() => topicsTable.id, {
      onDelete: "cascade",
    }),
    chatId: text("chat_id"),
    messageCount: integer("message_count"),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.chatId] })],
);

export type Topic = typeof topicsTable.$inferSelect;
export type TopicMessage = typeof topicMessagesTable.$inferSelect;
export type TopicGroup = typeof topicGroupsTable.$inferSelect;
