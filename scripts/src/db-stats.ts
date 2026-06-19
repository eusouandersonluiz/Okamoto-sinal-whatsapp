import { pool } from "@workspace/db";

const OWNER = process.env.WHATSAPP_OWNER;
const T = "00000000-0000-0000-0000-000000000001";

async function main(): Promise<void> {
  const q = async (label: string, sql: string, params: unknown[] = []) => {
    const { rows } = await pool.query(sql, params);
    console.log(`\n== ${label} ==`);
    for (const r of rows) console.log(JSON.stringify(r));
  };

  await q(
    "messages by chat_type",
    `select chat_type, count(*)::int n,
            count(*) filter (where coalesce(nullif(message,''),caption,transcription) is not null)::int with_text
       from whatsapp_messages where whatsapp_owner = $1 group by chat_type`,
    [OWNER],
  );
  await q(
    "enrichment by chat_type",
    `select chat_type, count(*)::int n from message_enrichment where tenant_id=$1 group by chat_type`,
    [T],
  );
  await q(
    "media messages available",
    `select message_type, count(*)::int n,
            count(media_url)::int with_url,
            count(transcription)::int with_transcription
       from whatsapp_messages
      where whatsapp_owner=$1 and message_type is not null
      group by message_type order by n desc limit 20`,
    [OWNER],
  );
  await q("topics count", `select count(*)::int n from topics where tenant_id=$1`, [T]);
  await q("mentions count", `select count(*)::int n from mentions where tenant_id=$1`, [T]);
  await q("entities", `select id,name,type,aliases from monitored_entities where tenant_id=$1`, [T]);
  await q("media_assets count", `select status,count(*)::int n from media_assets where tenant_id=$1 group by status`, [T]);
  await q(
    "sample enriched topics (group)",
    `select chat_type, topics from message_enrichment where tenant_id=$1 and chat_type='group' and topics is not null limit 10`,
    [T],
  );

  await pool.end();
}

void main().catch((e) => {
  console.error("db-stats failed:", (e as Error).message);
  process.exit(1);
});
