// Backfills group_participants.name from message pushnames (sender_name), joined
// by the sender @lid (metadata.raw.sender), where the name is null. Uses the most
// recent pushname per lid; never overwrites an existing name; idempotent. Reads
// the read-only whatsapp_messages, updates only group_participants.
export const RESOLVE_NAMES_SQL = `
update group_participants gp
   set name = sub.pushname, updated_at = now()
  from (
    select distinct on (w.metadata->'raw'->>'sender')
           w.metadata->'raw'->>'sender' as lid,
           w.sender_name as pushname
      from whatsapp_messages w
     where w.chat_type = 'group'
       and w.sender_name is not null
       and w.metadata->'raw'->>'sender' like '%@lid'
     order by w.metadata->'raw'->>'sender', w.message_created_at desc
  ) sub
 where gp.tenant_id = $1 and gp.lid = sub.lid and gp.name is null`;

async function main(): Promise<void> {
  const { pool, MVP_TENANT_ID } = await import("@workspace/db");
  const tenantId = process.env.TENANT_ID ?? MVP_TENANT_ID;
  const res = await pool.query(RESOLVE_NAMES_SQL, [tenantId]);
  console.log(`resolve-names: ${res.rowCount ?? 0} nomes resolvidos`);
  await pool.end();
}

if (process.argv[1] && process.argv[1].endsWith("resolve-names.ts")) {
  void main();
}
