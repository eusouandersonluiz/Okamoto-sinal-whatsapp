import { describe, it, expect, mock } from "bun:test";
import { buildInsert, buildGroupUpsert, runImport } from "./import-uazapi";
import { mapMessage } from "./uazapi/mapper";
import type { UazMessage, UazGroup } from "./uazapi/types";

const TENANT = "00000000-0000-0000-0000-000000000001";

const msg = (id: string): UazMessage => ({
  messageId: id,
  chatId: "120363000000000000@g.us",
  chatName: "Grupo",
  fromMe: false,
  senderPhone: null,
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

const grp = (chatId: string, name: string | null = "Grupo"): UazGroup => ({
  chatId,
  name,
  participantsCount: null,
});

describe("buildInsert", () => {
  it("gera SQL parametrizado com on conflict do nothing", () => {
    const rows = [mapMessage(msg("A"), "OWNER")!, mapMessage(msg("B"), "OWNER")!];
    const stmt = buildInsert(rows)!;
    expect(stmt.text).toContain("insert into whatsapp_messages");
    expect(stmt.text).toContain("on conflict (message_id) do nothing");
    expect(stmt.values.length).toBe(46); // 23 colunas * 2 linhas
  });

  it("retorna null para lista vazia", () => {
    expect(buildInsert([])).toBeNull();
  });
});

describe("buildGroupUpsert", () => {
  it("upsert com chat_id local part e on conflict do update", () => {
    const stmt = buildGroupUpsert([grp("120363000000000000@g.us", "G1")], TENANT)!;
    expect(stmt.text).toContain("insert into groups (tenant_id, chat_id, name)");
    expect(stmt.text).toContain("on conflict (tenant_id, chat_id) do update");
    expect(stmt.values).toEqual([TENANT, "120363000000000000", "G1"]);
  });

  it("retorna null para lista vazia", () => {
    expect(buildGroupUpsert([], TENANT)).toBeNull();
  });
});

describe("runImport (só grupos + roster)", () => {
  it("percorre grupos: upsert roster + importa mensagens", async () => {
    const insertRows = mock(async (rows: unknown[]) => rows.length);
    const upsertGroups = mock(async () => {});
    const result = await runImport({
      owner: "OWNER",
      tenantId: TENANT,
      listGroups: async function* () {
        yield grp("120363000000000000@g.us");
      },
      listMessages: async function* () {
        yield msg("A");
        yield msg("B");
      },
      insertRows,
      upsertGroups,
    });
    expect(result).toEqual({ groups: 1, seen: 2, inserted: 2 });
    expect(upsertGroups).toHaveBeenCalledTimes(1);
    expect(insertRows).toHaveBeenCalledTimes(1);
  });

  it("registra grupo silencioso (sem mensagens) no roster", async () => {
    const insertRows = mock(async (rows: unknown[]) => rows.length);
    const upsertGroups = mock(async () => {});
    const result = await runImport({
      owner: "OWNER",
      tenantId: TENANT,
      listGroups: async function* () {
        yield grp("120363000000000000@g.us", "Silencioso");
      },
      // eslint-disable-next-line require-yield
      listMessages: async function* () {
        return;
      },
      insertRows,
      upsertGroups,
    });
    expect(result.groups).toBe(1);
    expect(result.seen).toBe(0);
    expect(upsertGroups).toHaveBeenCalledTimes(1); // roster mesmo sem mensagens
  });

  it("descarta mensagens sem message_id", async () => {
    const insertRows = mock(async (rows: unknown[]) => rows.length);
    const upsertGroups = mock(async () => {});
    const result = await runImport({
      owner: "OWNER",
      tenantId: TENANT,
      listGroups: async function* () {
        yield grp("120363000000000000@g.us");
      },
      listMessages: async function* () {
        yield msg("A");
        yield { ...msg(""), messageId: "" };
      },
      insertRows,
      upsertGroups,
    });
    expect(result.seen).toBe(2);
    expect(result.inserted).toBe(1);
  });

  it("um grupo que falha não aborta os demais", async () => {
    const insertRows = mock(async (rows: unknown[]) => rows.length);
    const upsertGroups = mock(async () => {});
    const result = await runImport({
      owner: "OWNER",
      tenantId: TENANT,
      listGroups: async function* () {
        yield grp("BAD@g.us");
        yield grp("120363000000000000@g.us");
      },
      listMessages: (chatId) =>
        (async function* () {
          if (chatId.startsWith("BAD")) throw new Error("boom");
          yield msg("A");
        })(),
      insertRows,
      upsertGroups,
    });
    expect(result.groups).toBe(2);
    expect(result.inserted).toBe(1);
  });
});
