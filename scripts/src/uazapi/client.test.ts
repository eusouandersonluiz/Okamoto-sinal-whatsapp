import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeMessage, normalizeChat, UazapiClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (f: string) =>
  JSON.parse(readFileSync(path.join(here, "fixtures", f), "utf8"));

describe("normalizeMessage", () => {
  it("normaliza a fixture para UazMessage", () => {
    const m = normalizeMessage(load("message.json"));
    expect(m.messageId).toBe("3AFE00000000EXEMPLO");
    expect(m.chatId).toBe("120363000000000000@g.us");
    expect(m.fromMe).toBe(false);
    expect(m.senderPhone).toBeNull(); // sender é @lid, não telefone
    expect(m.senderName).toBe("Contato Exemplo");
    expect(m.text).toBe("mensagem de exemplo");
    expect(m.mediaUrl).toBeNull(); // fileURL vazio
    expect(m.rawType).toBe("Conversation");
    expect(m.timestampMs).toBe(1_720_000_000_000);
  });
});

describe("normalizeMessage senderPhone (jid parsing)", () => {
  const rawWith = (sender: string) => ({
    messageid: "X",
    chatid: "c@s.whatsapp.net",
    fromMe: false,
    sender,
    senderName: "n",
    messageType: "Conversation",
    text: "t",
    messageTimestamp: 1720000000000,
  });
  it("extrai telefone de jid @s.whatsapp.net removendo sufixo de device", () => {
    expect(normalizeMessage(rawWith("550000000000:17@s.whatsapp.net")).senderPhone).toBe("550000000000");
  });
  it("retorna null para sender de grupo @g.us", () => {
    expect(normalizeMessage(rawWith("120363000000000000@g.us")).senderPhone).toBeNull();
  });
});

describe("normalizeChat", () => {
  it("normaliza a fixture para UazChat (DM usa wa_chatid + wa_contactName)", () => {
    const c = normalizeChat(load("chat.json"));
    expect(c.chatId).toBe("5512900000000@s.whatsapp.net");
    expect(c.name).toBe("Cliente Exemplo");
  });
});

describe("UazapiClient.listMessages paginação", () => {
  it("segue paginando enquanto hasMore for true", async () => {
    const pages: unknown[] = [
      {
        messages: [
          { messageid: "1", chatid: "c@s.whatsapp.net", fromMe: false, sender: "c@s.whatsapp.net", senderName: "x", messageType: "Conversation", text: "oi", messageTimestamp: 1720000000000 },
        ],
        hasMore: true,
        nextOffset: 1,
      },
      { messages: [], hasMore: false },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => pages.shift() ?? { messages: [], hasMore: false },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new UazapiClient("http://x", "tok", 1); // pageSize 1
    const out: string[] = [];
    for await (const m of client.listMessages("c@s.whatsapp.net")) out.push(m.messageId);
    expect(out).toEqual(["1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("normalizeMessage timestamp", () => {
  const raw = (ts: number) => ({
    messageid: "T",
    chatid: "c@s.whatsapp.net",
    messageType: "Conversation",
    messageTimestamp: ts,
  });
  it("converte timestamp em segundos para ms", () => {
    expect(normalizeMessage(raw(1720000000)).timestampMs).toBe(1720000000000);
  });
  it("mantém timestamp já em ms", () => {
    expect(normalizeMessage(raw(1720000000000)).timestampMs).toBe(1720000000000);
  });
});
