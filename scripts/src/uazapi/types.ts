// Normalized shapes OWNED by this repo. The uazapi client is responsible for
// translating the provider's raw JSON into these; everything downstream depends
// only on these, never on uazapi's wire format.
export interface UazMessage {
  messageId: string; // unique id; rows without it are dropped
  chatId: string; // raw jid, e.g. "5511...@s.whatsapp.net" or "...@g.us"
  chatName: string | null;
  fromMe: boolean;
  senderPhone: string | null; // digits only
  senderName: string | null;
  text: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  replyToMessageId: string | null;
  forwarded: boolean;
  reaction: string | null;
  reactedToMessageId: string | null;
  timestampMs: number; // epoch milliseconds
  rawType: string; // original message type string (feeds metadata.raw_type)
  raw: unknown; // original payload, stored in metadata
}

export interface UazChat {
  chatId: string; // raw jid
  name: string | null;
}
