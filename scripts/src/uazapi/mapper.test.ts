import { describe, it, expect } from "bun:test";
import { mapMessage } from "./mapper";
import type { UazMessage } from "./types";

const base: UazMessage = {
  messageId: "MID1",
  chatId: "5511999999999@s.whatsapp.net",
  chatName: "Fulano",
  fromMe: false,
  senderPhone: "5511999999999",
  senderName: "Fulano",
  text: "oi",
  caption: null,
  mediaUrl: null,
  mediaMimeType: null,
  replyToMessageId: null,
  forwarded: false,
  reaction: null,
  reactedToMessageId: null,
  timestampMs: 1_720_000_000_000,
  rawType: "conversation",
  raw: { any: "thing" },
};

describe("mapMessage", () => {
  it("mapeia DM inbound com chat_id = telefone do parceiro", () => {
    const row = mapMessage(base, "5511000000000")!;
    expect(row.whatsapp_owner).toBe("5511000000000");
    expect(row.chat_type).toBe("private");
    expect(row.chat_id).toBe("5511999999999");
    expect(row.direction).toBe("inbound");
    expect(row.message).toBe("oi");
    expect(row.message_id).toBe("MID1");
    expect(row.message_created_at).toBe("2024-07-03T09:46:40.000Z");
    expect((row.metadata as { raw_type: string }).raw_type).toBe("conversation");
  });

  it("mapeia DM outbound (fromMe) como outbound", () => {
    const row = mapMessage({ ...base, fromMe: true }, "5511000000000")!;
    expect(row.direction).toBe("outbound");
  });

  it("mapeia grupo: chat_type group e chat_id = id do grupo", () => {
    const row = mapMessage(
      { ...base, chatId: "120363000000000000@g.us", chatName: "Meu Grupo" },
      "5511000000000",
    )!;
    expect(row.chat_type).toBe("group");
    expect(row.chat_id).toBe("120363000000000000");
    expect(row.chat_name).toBe("Meu Grupo");
  });

  it("mídia preenche media_url/mime e raw_type para a tela Mídia", () => {
    const row = mapMessage(
      { ...base, rawType: "imageMessage", mediaUrl: "https://x/y.jpg", mediaMimeType: "image/jpeg", caption: "foto" },
      "5511000000000",
    )!;
    expect(row.media_url).toBe("https://x/y.jpg");
    expect(row.media_mime_type).toBe("image/jpeg");
    expect(row.caption).toBe("foto");
    expect((row.metadata as { raw_type: string }).raw_type).toBe("imageMessage");
  });

  it("preserva reply e reação", () => {
    const row = mapMessage(
      { ...base, replyToMessageId: "MID0", reaction: "👍", reactedToMessageId: "MIDx", forwarded: true },
      "5511000000000",
    )!;
    expect(row.reply_to_message_id).toBe("MID0");
    expect(row.reaction).toBe("👍");
    expect(row.reacted_to_message_id).toBe("MIDx");
    expect(row.forwarded).toBe(true);
  });

  it("retorna null quando falta message_id", () => {
    expect(mapMessage({ ...base, messageId: "" }, "5511000000000")).toBeNull();
  });
});
