import { UazapiClient } from "./uazapi/client";
import type { UazGroup, UazMessage, UazParticipant } from "./uazapi/types";
import { mapMessage, WHATSAPP_COLUMNS, type WhatsappInsertRow } from "./uazapi/mapper";
import { RESOLVE_NAMES_SQL } from "./resolve-names";

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

// Upserts group members into group_participants (keyed by lid) and returns the
// statement. Management/message data untouched.
export function buildParticipantUpsert(
  chatId: string,
  tenantId: string,
  participants: UazParticipant[],
): { text: string; values: unknown[] } | null {
  if (participants.length === 0) return null;
  const chatKey = chatId.split("@")[0] ?? chatId;
  const values: unknown[] = [];
  const tuples = participants.map((p) => {
    values.push(tenantId, chatKey, p.lid, p.phone, p.name, p.isAdmin);
    const n = values.length;
    return `($${n - 5},$${n - 4},$${n - 3},$${n - 2},$${n - 1},$${n})`;
  });
  const text =
    `insert into group_participants (tenant_id, chat_id, lid, phone, name, is_admin) ` +
    `values ${tuples.join(",")} ` +
    `on conflict (tenant_id, chat_id, lid) do update set ` +
    `phone = excluded.phone, name = excluded.name, is_admin = excluded.is_admin, updated_at = now()`;
  return { text, values };
}

export interface ImportDeps {
  owner: string;
  tenantId: string;
  listGroups: () => AsyncIterable<UazGroup>;
  listMessages: (chatId: string) => AsyncIterable<UazMessage>;
  insertRows: (rows: WhatsappInsertRow[]) => Promise<number>;
  upsertGroups: (groups: UazGroup[]) => Promise<void>;
  // Optional: fetch + persist participants/count for one group. A failure here
  // is logged and skipped (resilience per group), never aborting the import.
  syncParticipants?: (chatId: string) => Promise<void>;
  // Optional total number of groups (for `i/total` progress logging).
  groupsTotal?: number;
  // Optional resume check: when it returns true for a group, that group is
  // skipped entirely (already fully imported) — used by IMPORT_RESUME.
  isGroupDone?: (chatId: string) => Promise<boolean>;
  log?: (msg: string) => void;
  msgLimit?: number;
}

// Groups-only import: walk the full group roster, upsert each group's metadata,
// and import its messages. A group whose message fetch fails is logged and
// skipped without aborting the rest.
export async function runImport(
  deps: ImportDeps,
): Promise<{ groups: number; seen: number; inserted: number; emptyGroups: number }> {
  const log = deps.log ?? (() => {});
  const total = deps.groupsTotal;
  let groups = 0;
  let seen = 0;
  let inserted = 0;
  let emptyGroups = 0;
  let skipped = 0;
  let msgBuffer: WhatsappInsertRow[] = [];

  const flushMsgs = async () => {
    if (msgBuffer.length === 0) return;
    inserted += await deps.insertRows(msgBuffer); // insert errors propagate (fatal)
    msgBuffer = [];
  };

  for await (const group of deps.listGroups()) {
    groups++;
    const at = total ? `${groups}/${total}` : `${groups}`;

    // Resume: skip groups already fully imported.
    if (deps.isGroupDone && (await deps.isGroupDone(group.chatId))) {
      skipped++;
      log(`grupo ${at} ${group.chatId}: já importado — pulando (resume)`);
      continue;
    }

    // Upsert the roster row immediately (before participants) so the group exists
    // when syncParticipants updates its participant_count, and so a crash mid-run
    // still persists the groups seen so far.
    await deps.upsertGroups([group]);

    // Participants (own try: a failing /group/info must not abort the import).
    if (deps.syncParticipants) {
      try {
        await deps.syncParticipants(group.chatId);
      } catch (e) {
        log(`grupo ${group.chatId} participantes falharam: ${(e as Error).message} — seguindo`);
      }
    }

    let groupSeen = 0;
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
      groupSeen++;
      const row = mapMessage(m.chatName ? m : { ...m, chatName: group.name }, deps.owner);
      if (!row) continue;
      msgBuffer.push(row);
      if (msgBuffer.length >= BATCH) await flushMsgs();
      if (deps.msgLimit && groupSeen >= deps.msgLimit) break;
    }
    if (groupSeen === 0) emptyGroups++;
    log(`grupo ${at} ${group.chatId}: ${groupSeen} vistas nesta rodada (total ${seen})`);
  }
  await flushMsgs();
  if (skipped > 0) log(`${skipped} grupos pulados (resume)`);
  return { groups, seen, inserted, emptyGroups };
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

  const skipParticipants = process.env.IMPORT_SKIP_PARTICIPANTS === "1";
  const resume = process.env.IMPORT_RESUME === "1";
  const groupsTotal = await client.countGroups();
  console.log(`import-uazapi: ${groupsTotal} grupos disponíveis no uazapi`);
  let groupsDone = 0;
  const result = await runImport({
    owner,
    tenantId,
    msgLimit,
    groupsTotal: Number.isFinite(chatLimit) ? Math.min(groupsTotal, chatLimit) : groupsTotal,
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
    syncParticipants: skipParticipants
      ? undefined
      : async (chatId) => {
          const info = await client.getGroupInfo(chatId);
          const chatKey = chatId.split("@")[0] ?? chatId;
          const stmt = buildParticipantUpsert(chatId, tenantId, info.participants);
          if (stmt) await pool.query(stmt.text, stmt.values);
          if (info.participantCount != null) {
            await pool.query(
              `update groups set participant_count = $1 where tenant_id = $2 and chat_id = $3`,
              [info.participantCount, tenantId, chatKey],
            );
          }
        },
    isGroupDone: resume
      ? async (chatId) => {
          const chatKey = chatId.split("@")[0] ?? chatId;
          const r = await pool.query(
            `select 1 from groups g
              where g.tenant_id = $1 and g.chat_id = $2 and g.participant_count is not null
                and exists (
                  select 1 from whatsapp_messages w
                   where w.chat_id = $2 and w.chat_type = 'group' limit 1
                ) limit 1`,
            [tenantId, chatKey],
          );
          return (r.rowCount ?? 0) > 0;
        }
      : undefined,
    listGroups: async function* () {
      for await (const g of client.listGroups()) {
        if (groupsDone++ >= chatLimit) return;
        yield g;
      }
    },
    listMessages: (chatId) => client.listMessages(chatId, { since, limit: msgLimit }),
  });

  console.log(
    `import-uazapi done: grupos=${result.groups}/${groupsTotal} inseridas(novas)=${result.inserted} vistas=${result.seen} grupos_sem_msg=${result.emptyGroups}`,
  );

  // Resolve participant names from message pushnames (backfill).
  const named = await pool.query(RESOLVE_NAMES_SQL, [tenantId]);
  console.log(`resolve-names: ${named.rowCount ?? 0} nomes resolvidos`);

  await pool.end();
}

// Only run main when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("import-uazapi.ts")) {
  void main();
}
