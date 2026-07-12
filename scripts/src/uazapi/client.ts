import type { UazMessage, UazChat } from "./types";

// Endpoints confirmed against the live instance (2026-07-12). All uazapi
// coupling lives in this file; change only here if the instance version differs.
const CHAT_ENDPOINT = "/chat/find";
const MESSAGE_ENDPOINT = "/message/find";

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Only "@s.whatsapp.net" jids are real phone numbers. Group senders use "@lid"
// (WhatsApp linked-id) and group jids use "@g.us" — neither is a phone. Strips a
// device suffix ("558...:17@s.whatsapp.net") before extracting digits.
function phoneFromJid(jid: unknown): string | null {
  const s = str(jid);
  if (!s || !s.endsWith("@s.whatsapp.net")) return null;
  const local = (s.split("@")[0] ?? "").split(":")[0] ?? "";
  const digits = local.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function toMs(ts: unknown): number {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return 0;
  return n < 1_000_000_000_000 ? n * 1000 : n; // seconds → ms
}

// `quoted` is "" when absent, or a string/object carrying the quoted message id.
function normalizeQuoted(q: unknown): string | null {
  if (typeof q === "string") return q.length > 0 ? q : null;
  if (q && typeof q === "object") {
    const o = q as Record<string, unknown>;
    return str(o.messageid) ?? str(o.id);
  }
  return null;
}

export function normalizeMessage(raw: Record<string, unknown>): UazMessage {
  const content = (raw.content ?? {}) as Record<string, unknown>;
  return {
    messageId: str(raw.messageid) ?? "",
    chatId: str(raw.chatid) ?? "",
    chatName: null, // messages carry no chat name; the orchestrator fills it
    fromMe: raw.fromMe === true,
    senderPhone: phoneFromJid(raw.sender),
    senderName: str(raw.senderName),
    text: str(raw.text) ?? str(content.text),
    caption: str(content.caption) ?? str(raw.caption),
    // uazapi only fills fileURL when it has downloaded/cached the media;
    // for historical messages that's empty and the (encrypted) WhatsApp URL
    // lives in content.URL. Prefer the cached fileURL, fall back to content.URL
    // so media-bearing rows still get a non-null media_url (the Mídia page
    // filters `media_url is not null`).
    mediaUrl: str(raw.fileURL) ?? str(content.URL),
    mediaMimeType: str(content.mimetype) ?? str(raw.mimetype),
    replyToMessageId: normalizeQuoted(raw.quoted),
    forwarded: raw.forwarded === true || raw.isForwarded === true,
    reaction: str(raw.reaction),
    reactedToMessageId: null,
    timestampMs: toMs(raw.messageTimestamp),
    rawType: str(raw.messageType) ?? "unknown",
    raw,
  };
}

export function normalizeChat(raw: Record<string, unknown>): UazChat {
  return {
    chatId: str(raw.wa_chatid) ?? str(raw.id) ?? "",
    name: str(raw.name) ?? str(raw.wa_contactName) ?? str(raw.phone) ?? null,
  };
}

async function postJson(
  base: string,
  token: string,
  endpoint: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const maxAttempts = 4;
  const backoff = (attempt: number) =>
    new Promise((r) => setTimeout(r, Math.min(15000, 500 * 2 ** attempt)));
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: { token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Network-level failure (DNS/reset/timeout): retry with backoff.
      if (attempt < maxAttempts) {
        await backoff(attempt);
        continue;
      }
      throw e;
    }
    if (res.ok) return (await res.json()) as Record<string, unknown>;
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      await backoff(attempt);
      continue;
    }
    throw new Error(`uazapi ${endpoint} ${res.status}: ${await res.text()}`);
  }
}

export class UazapiClient {
  constructor(
    private readonly base: string,
    private readonly token: string,
    private readonly pageSize = 200,
  ) {}

  async *listChats(): AsyncIterable<UazChat> {
    let offset = 0;
    for (;;) {
      const payload = await postJson(this.base, this.token, CHAT_ENDPOINT, {
        operator: "AND",
        sort: "-wa_lastMsgTimestamp",
        limit: this.pageSize,
        offset,
      });
      const batch = (payload.chats ?? []) as Record<string, unknown>[];
      for (const c of batch) yield normalizeChat(c);
      if (batch.length === 0) return;
      offset += batch.length;
      const total = (payload.pagination as { totalRecords?: number } | undefined)?.totalRecords;
      // With a known total, stop at it; otherwise fall back to "a short page
      // means the end" so a missing totalRecords doesn't silently truncate.
      if (typeof total === "number") {
        if (offset >= total) return;
      } else if (batch.length < this.pageSize) {
        return;
      }
    }
  }

  async *listMessages(
    chatId: string,
    opts: { since?: number; limit?: number } = {},
  ): AsyncIterable<UazMessage> {
    let offset = 0;
    let yielded = 0;
    for (;;) {
      const payload = await postJson(this.base, this.token, MESSAGE_ENDPOINT, {
        chatid: chatId,
        sort: "-messageTimestamp",
        limit: this.pageSize,
        offset,
      });
      const batch = (payload.messages ?? []) as Record<string, unknown>[];
      for (const raw of batch) {
        const msg = normalizeMessage(raw);
        if (opts.since && msg.timestampMs < opts.since) return;
        yield msg;
        if (opts.limit && ++yielded >= opts.limit) return;
      }
      if (batch.length === 0 || payload.hasMore !== true) return;
      const next = (payload.nextOffset as number | undefined) ?? offset + batch.length;
      // Guard against a non-advancing cursor (would loop forever).
      if (next <= offset) return;
      offset = next;
    }
  }
}
