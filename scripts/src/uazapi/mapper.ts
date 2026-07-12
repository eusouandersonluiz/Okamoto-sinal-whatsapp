import type { UazMessage } from "./types";

// Column order used by both the mapper output and the batch INSERT builder.
export const WHATSAPP_COLUMNS = [
  "whatsapp_owner",
  "chat_type",
  "chat_id",
  "chat_name",
  "contact_phone",
  "sender_phone",
  "sender_name",
  "recipient_phone",
  "direction",
  "message_type",
  "message",
  "caption",
  "media_url",
  "media_mime_type",
  "transcription",
  "message_id",
  "reply_to_message_id",
  "forwarded",
  "reaction",
  "reacted_to_message_id",
  "status",
  "message_created_at",
  "metadata",
] as const;

export type WhatsappInsertRow = Record<(typeof WHATSAPP_COLUMNS)[number], unknown>;

function jidLocalPart(jid: string): string {
  return jid.split("@")[0] ?? jid;
}

// DMs are keyed by the partner phone (contact_phone is empty for DMs); groups
// are keyed by the group id. See docs/ARQUITETURA.md ("Chats privados").
export function mapMessage(
  m: UazMessage,
  owner: string,
): WhatsappInsertRow | null {
  if (!m.messageId) return null;
  const isGroup = m.chatId.endsWith("@g.us");
  const chatKey = jidLocalPart(m.chatId);
  return {
    whatsapp_owner: owner,
    chat_type: isGroup ? "group" : "private",
    chat_id: chatKey,
    chat_name: m.chatName,
    contact_phone: null,
    sender_phone: m.senderPhone,
    sender_name: m.senderName,
    recipient_phone: null,
    direction: m.fromMe ? "outbound" : "inbound",
    message_type: m.rawType,
    message: m.text,
    caption: m.caption,
    media_url: m.mediaUrl,
    media_mime_type: m.mediaMimeType,
    transcription: null,
    message_id: m.messageId,
    reply_to_message_id: m.replyToMessageId,
    forwarded: m.forwarded,
    reaction: m.reaction,
    reacted_to_message_id: m.reactedToMessageId,
    status: null,
    message_created_at: new Date(m.timestampMs).toISOString(),
    metadata: { source: "uazapi", raw_type: m.rawType, raw: m.raw },
  };
}
