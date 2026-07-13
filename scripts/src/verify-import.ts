import { pool, MVP_TENANT_ID } from "@workspace/db";
import { UazapiClient } from "./uazapi/client";

// Read-only completeness report: compares what is in the DB with what the uazapi
// instance exposes, and flags gaps (missing groups, empty groups, missing counts).
async function main(): Promise<void> {
  const tenantId = process.env.TENANT_ID ?? MVP_TENANT_ID;
  const base = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;

  let available: number | null = null;
  if (base && token) {
    try {
      available = await new UazapiClient(base, token).countGroups();
    } catch (e) {
      console.log(`(não deu para contar grupos no uazapi: ${(e as Error).message})`);
    }
  }

  const n = async (sql: string, params: unknown[] = []): Promise<number> =>
    Number((await pool.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);

  const groups = await n(`select count(*)::text n from groups where tenant_id = $1`, [tenantId]);
  const withMsgs = await n(
    `select count(distinct chat_id)::text n from whatsapp_messages where chat_type = 'group' and chat_id is not null`,
  );
  const emptyGroups = await n(
    `select count(*)::text n from groups g
      where g.tenant_id = $1
        and not exists (
          select 1 from whatsapp_messages w
           where w.chat_id = g.chat_id and w.chat_type = 'group'
        )`,
    [tenantId],
  );
  const noCount = await n(
    `select count(*)::text n from groups where tenant_id = $1 and participant_count is null`,
    [tenantId],
  );
  const msgs = await n(`select count(*)::text n from whatsapp_messages where chat_type = 'group'`);
  const parts = await n(`select count(*)::text n from group_participants where tenant_id = $1`, [tenantId]);
  const named = await n(
    `select count(*)::text n from group_participants where tenant_id = $1 and name is not null`,
    [tenantId],
  );

  console.log("=== verify-import ===");
  console.log(`grupos no DB:                 ${groups}${available != null ? ` / ${available} disponíveis` : ""}`);
  console.log(`grupos com mensagens:         ${withMsgs}`);
  console.log(`grupos SEM mensagens:         ${emptyGroups}`);
  console.log(`grupos SEM participant_count: ${noCount}`);
  console.log(`mensagens de grupo:           ${msgs}`);
  console.log(`participantes:                ${parts} (com nome: ${named}, sem nome: ${parts - named})`);
  if (available != null && groups < available) {
    console.log(`⚠️  INCOMPLETO: faltam ${available - groups} grupos no DB (rode o import sem IMPORT_CHAT_LIMIT)`);
  } else if (available != null) {
    console.log("✓ roster completo (grupos no DB >= disponíveis no uazapi)");
  }
  await pool.end();
}

void main();
