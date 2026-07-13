import { UazapiClient } from "./uazapi/client";
import type { UazGroup, UazMessage } from "./uazapi/types";
import { mapMessage, WHATSAPP_COLUMNS, type WhatsappInsertRow } from "./uazapi/mapper";

const BATCH = 500;

// MVP single-tenant id (see docs/SUPABASE.md). Group rows are scoped by tenant.
const MVP_TENANT_ID = "00000000-0000-0000-0000-000000000001";

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

// Upserts group roster metadata into `groups`. chat_id is the jid local part
// (matching whatsapp_messages.chat_id). Only `name` is touched — management
// columns (relevance, tags, alias, digest_*, archived_at) are left intact.
export function buildGroupUpsert(
  groups: UazGroup[],
  tenantId: string,
): { text: string; values: unknown[] } | null {
  if (groups.length === 0) return null;
  const values: unknown[] = [];
  const tuples = groups.map((g) => {
    const chatKey = g.chatId.split("@")[0] ?? g.chatId;
    values.push(tenantId, chatKey, g.name);
    const n = values.length;
    return `($${n - 2},$${n - 1},$${n})`;
  });
  const text =
    `insert into groups (tenant_id, chat_id, name) values ${tuples.join(",")} ` +
    `on conflict (tenant_id, chat_id) do update set name = coalesce(excluded.name, groups.name)`;
  return { text, values };
}

export interface ImportDeps {
  owner: string;
  tenantId: string;
  listGroups: () => AsyncIterable<UazGroup>;
  listMessages: (chatId: string) => AsyncIterable<UazMessage>;
  insertRows: (rows: WhatsappInsertRow[]) => Promise<number>;
  upsertGroups: (groups: UazGroup[]) => Promise<void>;
  log?: (msg: string) => void;
  msgLimit?: number;
}

// Groups-only import: walk the full group roster, upsert each group's metadata,
// and import its messages. A group whose message fetch fails is logged and
// skipped without aborting the rest.
export async function runImport(
  deps: ImportDeps,
): Promise<{ groups: number; seen: number; inserted: number }> {
  const log = deps.log ?? (() => {});
  let groups = 0;
  let seen = 0;
  let inserted = 0;
  let msgBuffer: WhatsappInsertRow[] = [];
  let rosterBuffer: UazGroup[] = [];

  const flushMsgs = async () => {
    if (msgBuffer.length === 0) return;
    inserted += await deps.insertRows(msgBuffer); // insert errors propagate (fatal)
    msgBuffer = [];
  };
  const flushRoster = async () => {
    if (rosterBuffer.length === 0) return;
    await deps.upsertGroups(rosterBuffer);
    rosterBuffer = [];
  };

  for await (const group of deps.listGroups()) {
    groups++;
    rosterBuffer.push(group);
    if (rosterBuffer.length >= BATCH) await flushRoster();

    let perGroup = 0;
    // Catch ONLY message-fetch errors per group. Insert errors from flush() are
    // fatal and must NOT be swallowed.
    const it = deps.listMessages(group.chatId)[Symbol.asyncIterator]();
    for (;;) {
      let res: IteratorResult<UazMessage>;
      try {
        res = await it.next();
      } catch (e) {
        log(`grupo ${group.chatId} falhou: ${(e as Error).message} — seguindo`);
        break;
      }
      if (res.done) break;
      const m = res.value;
      seen++;
      const row = mapMessage(m.chatName ? m : { ...m, chatName: group.name }, deps.owner);
      if (!row) continue;
      msgBuffer.push(row);
      if (msgBuffer.length >= BATCH) await flushMsgs();
      if (deps.msgLimit && ++perGroup >= deps.msgLimit) break;
    }
    log(`grupo ${group.chatId}: ${perGroup} vistas nesta rodada (total ${seen})`);
  }
  await flushRoster();
  await flushMsgs();
  return { groups, seen, inserted };
}

async function main(): Promise<void> {
  const base = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;
  const owner = process.env.WHATSAPP_OWNER;
  if (!base || !token) throw new Error("UAZAPI_BASE_URL e UAZAPI_TOKEN são obrigatórios.");
  if (!owner) throw new Error("WHATSAPP_OWNER é obrigatório.");

  const tenantId = process.env.TENANT_ID ?? MVP_TENANT_ID;
  const { pool } = await import("@workspace/db");
  const client = new UazapiClient(base, token);
  // Groups-only: no chat limit by default (pull ALL groups). IMPORT_CHAT_LIMIT
  // still caps the number of groups for a cheap pilot.
  const chatLimit = Number(process.env.IMPORT_CHAT_LIMIT ?? Infinity);
  const msgLimit = process.env.IMPORT_MSG_LIMIT ? Number(process.env.IMPORT_MSG_LIMIT) : undefined;
  const since = process.env.IMPORT_SINCE ? Date.parse(process.env.IMPORT_SINCE) : undefined;

  let groupsDone = 0;
  const result = await runImport({
    owner,
    tenantId,
    msgLimit,
    log: (m) => console.log(m),
    insertRows: async (rows) => {
      const stmt = buildInsert(rows);
      if (!stmt) return 0;
      const res = await pool.query(stmt.text, stmt.values);
      return res.rowCount ?? 0;
    },
    upsertGroups: async (gs) => {
      const stmt = buildGroupUpsert(gs, tenantId);
      if (stmt) await pool.query(stmt.text, stmt.values);
    },
    listGroups: async function* () {
      for await (const g of client.listGroups()) {
        if (groupsDone++ >= chatLimit) return;
        yield g;
      }
    },
    listMessages: (chatId) => client.listMessages(chatId, { since, limit: msgLimit }),
  });

  console.log(
    `import-uazapi done: groups=${result.groups} seen=${result.seen} inserted(novas)=${result.inserted}`,
  );
  await pool.end();
}

// Only run main when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("import-uazapi.ts")) {
  void main();
}
