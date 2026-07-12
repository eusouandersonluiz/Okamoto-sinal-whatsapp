import { describe, it, expect, vi } from "vitest";
import { buildInsert, runImport } from "./import-uazapi";
import { mapMessage } from "./uazapi/mapper";
import type { UazMessage } from "./uazapi/types";

const msg = (id: string): UazMessage => ({
  messageId: id,
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
  raw: {},
});

describe("buildInsert", () => {
  it("gera SQL parametrizado com on conflict do nothing", () => {
    const rows = [mapMessage(msg("A"), "OWNER")!, mapMessage(msg("B"), "OWNER")!];
    const stmt = buildInsert(rows)!;
    expect(stmt.text).toContain("insert into whatsapp_messages");
    expect(stmt.text).toContain("on conflict (message_id) do nothing");
    expect(stmt.text).toContain("$46"); // 23 colunas * 2 linhas
    expect(stmt.values.length).toBe(46);
  });

  it("retorna null para lista vazia", () => {
    expect(buildInsert([])).toBeNull();
  });
});

describe("runImport", () => {
  it("percorre chats + mensagens, mapeia e insere em lote", async () => {
    const insertRows = vi.fn(async (rows) => rows.length);
    const result = await runImport({
      owner: "OWNER",
      listChats: async function* () {
        yield { chatId: "5511999999999@s.whatsapp.net", name: "Fulano" };
      },
      listMessages: async function* () {
        yield msg("A");
        yield msg("B");
      },
      insertRows,
    });
    expect(result).toEqual({ chats: 1, seen: 2, inserted: 2 });
    expect(insertRows).toHaveBeenCalledTimes(1);
  });

  it("descarta mensagens sem message_id", async () => {
    const insertRows = vi.fn(async (rows) => rows.length);
    const result = await runImport({
      owner: "OWNER",
      listChats: async function* () {
        yield { chatId: "5511999999999@s.whatsapp.net", name: "Fulano" };
      },
      listMessages: async function* () {
        yield msg("A");
        yield { ...msg(""), messageId: "" };
      },
      insertRows,
    });
    expect(result.seen).toBe(2);
    expect(result.inserted).toBe(1);
  });

  it("um chat que falha não aborta os demais", async () => {
    const insertRows = vi.fn(async (rows) => rows.length);
    const result = await runImport({
      owner: "OWNER",
      listChats: async function* () {
        yield { chatId: "BAD@s.whatsapp.net", name: "x" };
        yield { chatId: "5511999999999@s.whatsapp.net", name: "Fulano" };
      },
      listMessages: (chatId) =>
        (async function* () {
          if (chatId.startsWith("BAD")) throw new Error("boom");
          yield msg("A");
        })(),
      insertRows,
    });
    expect(result.chats).toBe(2);
    expect(result.inserted).toBe(1);
  });
});
