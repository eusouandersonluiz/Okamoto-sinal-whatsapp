import {
  pgTable,
  bigint,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// READ-ONLY mapping of the source table. Never written to, never migrated by
// this app. Defined only so reads can be typed/queried via Drizzle when
// convenient; analytics use raw SQL.
export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: bigint("id", { mode: "number" }),
  whatsappOwner: text("whatsapp_owner"),
  chatType: text("chat_type"),
  chatId: text("chat_id"),
  chatName: text("chat_name"),
  contactPhone: text("contact_phone"),
  senderPhone: text("sender_phone"),
  senderName: text("sender_name"),
  recipientPhone: text("recipient_phone"),
  direction: text("direction"),
  messageType: text("message_type"),
  message: text("message"),
  caption: text("caption"),
  mediaUrl: text("media_url"),
  mediaMimeType: text("media_mime_type"),
  transcription: text("transcription"),
  messageId: text("message_id"),
  replyToMessageId: text("reply_to_message_id"),
  forwarded: boolean("forwarded"),
  reaction: text("reaction"),
  reactedToMessageId: text("reacted_to_message_id"),
  status: text("status"),
  messageCreatedAt: timestamp("message_created_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
});

export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
