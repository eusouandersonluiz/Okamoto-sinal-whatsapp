import { pool } from "@workspace/db";

// LOCAL-ONLY. In the cloud deployment `whatsapp_messages` is an external,
// read-only table and the canonical migrations never touch it. Locally it does
// not exist, so this bootstrap creates a mirror matching lib/db/src/schema/
// whatsapp.ts, plus a unique index on message_id to enable idempotent upserts.
// Do NOT move this into lib/db/migrations/.
const DDL = `
create table if not exists whatsapp_messages (
  id bigint generated always as identity primary key,
  whatsapp_owner text,
  chat_type text,
  chat_id text,
  chat_name text,
  contact_phone text,
  sender_phone text,
  sender_name text,
  recipient_phone text,
  direction text,
  message_type text,
  message text,
  caption text,
  media_url text,
  media_mime_type text,
  transcription text,
  message_id text,
  reply_to_message_id text,
  forwarded boolean,
  reaction text,
  reacted_to_message_id text,
  status text,
  message_created_at timestamptz,
  metadata jsonb
);
create unique index if not exists whatsapp_messages_message_id_uniq
  on whatsapp_messages (message_id);
`;

async function main(): Promise<void> {
  await pool.query(DDL);
  const { rows } = await pool.query<{ count: string }>(
    "select count(*)::text as count from whatsapp_messages",
  );
  console.log(`whatsapp_messages ready (rows: ${rows[0]?.count ?? "0"})`);
  await pool.end();
}

void main();
