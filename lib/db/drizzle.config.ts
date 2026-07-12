import { defineConfig } from "drizzle-kit";
import path from "path";

// Radar Stark uses the Supabase database (same DB as the read-only whatsapp_messages
// source). Schema is applied via raw SQL migrations (lib/db/migrations) to
// avoid drizzle-kit touching the source table; this config exists for
// introspection/tooling only.
const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("SUPABASE_DB_URL (or DATABASE_URL) must be set");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : false,
  },
});
