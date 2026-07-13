import { describe, it, expect, mock, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeMessage, normalizeChat, normalizeGroup, normalizeGroupInfo, UazapiClient } from "./client";

// Deterministic fetch mocking without vi.stubGlobal: swap globalThis.fetch and
// always restore it after each test.
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

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

describe("normalizeGroup", () => {
  it("normaliza a fixture de grupo (wa_chatid + wa_name)", () => {
    const g = normalizeGroup(load("group.json"));
    expect(g.chatId).toBe("120363000000000000@g.us");
    expect(g.name).toBe("Grupo Exemplo");
    expect(g.participantsCount).toBeNull(); // /chat/find não traz contagem
  });
  it("captura contagem de participantes quando presente", () => {
    const g = normalizeGroup({ wa_chatid: "1@g.us", wa_name: "X", wa_groupSize: 42 });
    expect(g.participantsCount).toBe(42);
  });
});

describe("normalizeGroupInfo", () => {
  it("normaliza participantes e contagem da fixture de /group/info", () => {
    const gi = normalizeGroupInfo(load("group-info.json"));
    expect(gi.participantCount).toBe(3);
    expect(gi.participants.length).toBe(3);
    const first = gi.participants[0]!;
    expect(first.lid).toBe("111111@lid");
    expect(first.phone).toBe("5511000000000");
    expect(first.name).toBe("Fulano");
    expect(first.isAdmin).toBe(true);
  });
  it("extrai telefone de jid e trata ausência (phone null)", () => {
    const gi = normalizeGroupInfo(load("group-info.json"));
    expect(gi.participants[1]!.phone).toBe("5511000000001"); // veio como jid
    expect(gi.participants[2]!.phone).toBeNull(); // sem PhoneNumber
  });
  it("cai para o tamanho da lista quando ParticipantCount vem 0", () => {
    const gi = normalizeGroupInfo({ ParticipantCount: 0, Participants: [{ LID: "a@lid" }, { LID: "b@lid" }] });
    expect(gi.participantCount).toBe(2);
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
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => pages.shift() ?? { messages: [], hasMore: false },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
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

describe("normalizeMessage mídia", () => {
  // Historical media: uazapi leaves fileURL empty; the (encrypted) WhatsApp URL
  // and mimetype live under content. media_url must fall back to content.URL so
  // the row is non-null and the Mídia page counts it.
  const audio = {
    messageid: "AUD1",
    chatid: "120363000000000000@g.us",
    messageType: "AudioMessage",
    fileURL: "",
    text: "",
    content: { URL: "https://mmg.whatsapp.net/x.enc", mimetype: "audio/ogg; codecs=opus" },
    messageTimestamp: 1720000000000,
  };
  it("usa content.URL quando fileURL está vazio", () => {
    const m = normalizeMessage(audio);
    expect(m.mediaUrl).toBe("https://mmg.whatsapp.net/x.enc");
    expect(m.mediaMimeType).toBe("audio/ogg; codecs=opus");
    expect(m.rawType).toBe("AudioMessage");
  });
  it("prefere fileURL quando presente", () => {
    const m = normalizeMessage({ ...audio, fileURL: "https://cache/x.ogg" });
    expect(m.mediaUrl).toBe("https://cache/x.ogg");
  });
});
