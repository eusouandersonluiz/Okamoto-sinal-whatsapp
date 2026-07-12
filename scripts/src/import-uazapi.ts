import { UazapiClient } from "./uazapi/client";
import type { UazChat, UazMessage } from "./uazapi/types";
import { mapMessage, WHATSAPP_COLUMNS, type WhatsappInsertRow } from "./uazapi/mapper";

const BATCH = 500;

export function buildInsert(
  rows: WhatsappInsertRow[],
): { text: string; values: unknown[] } | null {
  if (rows.length === 0) return null;
  const cols = WHATSAPP_COLUMNS;
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const ph = cols.map((c) => {
      const v = row[c];
      values.push(c === "metadata" ? JSON.stringify(v) : v);
      return `$${values.length}`;
    });
    return `(${ph.join(",")})`;
  });
  const text =
    `insert into whatsapp_messages (${cols.join(",")}) values ` +
    `${tuples.join(",")} on conflict (message_id) do nothing`;
  return { text, values };
}

export interface ImportDeps {
  owner: string;
  listChats: () => AsyncIterable<UazChat>;
  listMessages: (chatId: string) => AsyncIterable<UazMessage>;
  insertRows: (rows: WhatsappInsertRow[]) => Promise<number>;
  log?: (msg: string) => void;
  msgLimit?: number;
}

export async function runImport(
  deps: ImportDeps,
): Promise<{ chats: number; seen: number; inserted: number }> {
  const log = deps.log ?? (() => {});
  let chats = 0;
  let seen = 0;
  let inserted = 0;
  let buffer: WhatsappInsertRow[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    inserted += await deps.insertRows(buffer); // insert errors propagate (fatal)
    buffer = [];
  };

  for await (const chat of deps.listChats()) {
    chats++;
    let perChat = 0;
    // Catch ONLY message-fetch errors per chat (a failing chat must not abort
    // the rest). Insert errors from flush() are fatal and must NOT be swallowed.
    const it = deps.listMessages(chat.chatId)[Symbol.asyncIterator]();
    for (;;) {
      let res: IteratorResult<UazMessage>;
      try {
        res = await it.next();
      } catch (e) {
        log(`chat ${chat.chatId} falhou: ${(e as Error).message} — seguindo`);
        break;
      }
      if (res.done) break;
      const m = res.value;
      seen++;
      // Messages carry no chat display name; take it from the chat.
      const row = mapMessage(m.chatName ? m : { ...m, chatName: chat.name }, deps.owner);
      if (!row) continue;
      buffer.push(row);
      if (buffer.length >= BATCH) await flush();
      if (deps.msgLimit && ++perChat >= deps.msgLimit) break;
    }
    log(`chat ${chat.chatId}: ${perChat} vistas nesta rodada (total ${seen})`);
  }
  await flush();
  return { chats, seen, inserted };
}

async function main(): Promise<void> {
  const base = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;
  const owner = process.env.WHATSAPP_OWNER;
  if (!base || !token) throw new Error("UAZAPI_BASE_URL e UAZAPI_TOKEN são obrigatórios.");
  if (!owner) throw new Error("WHATSAPP_OWNER é obrigatório.");

  const { pool } = await import("@workspace/db");
  const client = new UazapiClient(base, token);
  const chatLimit = Number(process.env.IMPORT_CHAT_LIMIT ?? Infinity);
  const msgLimit = process.env.IMPORT_MSG_LIMIT ? Number(process.env.IMPORT_MSG_LIMIT) : undefined;
  const since = process.env.IMPORT_SINCE ? Date.parse(process.env.IMPORT_SINCE) : undefined;

  let chatsDone = 0;
  const result = await runImport({
    owner,
    msgLimit,
    log: (m) => console.log(m),
    insertRows: async (rows) => {
      const stmt = buildInsert(rows);
      if (!stmt) return 0;
      const res = await pool.query(stmt.text, stmt.values);
      return res.rowCount ?? 0;
    },
    listChats: async function* () {
      for await (const c of client.listChats()) {
        if (chatsDone++ >= chatLimit) return;
        yield c;
      }
    },
    listMessages: (chatId) => client.listMessages(chatId, { since, limit: msgLimit }),
  });

  console.log(
    `import-uazapi done: chats=${result.chats} seen=${result.seen} inserted(novas)=${result.inserted}`,
  );
  await pool.end();
}

// Only run main when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("import-uazapi.ts")) {
  void main();
}
