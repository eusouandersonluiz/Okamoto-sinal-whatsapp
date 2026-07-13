import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { OWNER } from "../lib/scope";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

const CADENCES = new Set(["daily", "weekly"]);
const RELEVANCES = new Set(["monitored", "ignored"]);

// List managed groups: rows come from the `groups` table (management state,
// populated by the roster import) joined with live stats from whatsapp_messages.
// Default view hides ignored and archived groups; ?include=all shows everything,
// ?include=archived shows only archived.
router.get("/groups", async (req: AuthedRequest, res) => {
  const t = req.auth!.tenantId;
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  const include = String(req.query.include ?? "active");

  let filter = "";
  if (include === "active") filter = "and g.relevance <> 'ignored' and g.archived_at is null";
  else if (include === "archived") filter = "and g.archived_at is not null";
  // include=all → no filter

  const { rows } = await pool.query(
    `select g.chat_id,
            coalesce(g.alias, g.name) as name,
            g.name as raw_name,
            g.alias,
            g.relevance,
            g.category,
            g.tags,
            g.digest_enabled,
            g.digest_cadence,
            g.archived_at,
            coalesce(s.message_count, 0) as message_count,
            coalesce(s.participants, 0) as participants,
            s.last_activity_at
       from groups g
       left join (
         select chat_id,
                count(*)::int as message_count,
                count(distinct sender_phone)::int as participants,
                max(message_created_at) as last_activity_at
           from whatsapp_messages
          where whatsapp_owner = $1 and chat_type = 'group' and chat_id is not null
          group by chat_id
       ) s on s.chat_id = g.chat_id
      where g.tenant_id = $2
      ${filter}
      order by s.message_count desc nulls last, g.name
      limit $3`,
    [OWNER, t, limit],
  );
  res.json({ groups: rows });
});

// Update group management fields. Only provided fields are changed.
router.patch("/groups/:chatId", async (req: AuthedRequest, res) => {
  const t = req.auth!.tenantId;
  const { chatId } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const sets: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (typeof body.relevance === "string") {
    if (!RELEVANCES.has(body.relevance)) return res.status(400).json({ error: "bad_relevance" });
    set("relevance", body.relevance);
  }
  if ("category" in body) set("category", body.category ?? null);
  if ("alias" in body) set("alias", body.alias ?? null);
  if (Array.isArray(body.tags)) set("tags", body.tags);
  if (typeof body.digestEnabled === "boolean") set("digest_enabled", body.digestEnabled);
  if (typeof body.digestCadence === "string") {
    if (!CADENCES.has(body.digestCadence)) return res.status(400).json({ error: "bad_cadence" });
    set("digest_cadence", body.digestCadence);
  }

  if (sets.length === 0) return res.status(400).json({ error: "no_fields" });
  params.push(t, chatId);
  const result = await pool.query(
    `update groups set ${sets.join(", ")}
      where tenant_id = $${params.length - 1} and chat_id = $${params.length}`,
    params,
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

// Archive / unarchive a group (reversible; data untouched).
router.post("/groups/:chatId/archive", async (req: AuthedRequest, res) => {
  const t = req.auth!.tenantId;
  const result = await pool.query(
    `update groups set archived_at = now() where tenant_id = $1 and chat_id = $2`,
    [t, req.params.chatId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

router.post("/groups/:chatId/unarchive", async (req: AuthedRequest, res) => {
  const t = req.auth!.tenantId;
  const result = await pool.query(
    `update groups set archived_at = null where tenant_id = $1 and chat_id = $2`,
    [t, req.params.chatId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

// Group digest: stored AI digest if present, plus live recent excerpts.
router.get("/groups/:chatId/digest", async (req: AuthedRequest, res) => {
  const t = req.auth!.tenantId;
  const { chatId } = req.params;
  const digest = await pool.query(
    `select * from group_digests
      where tenant_id = $1 and chat_id = $2
      order by created_at desc limit 1`,
    [t, chatId],
  );
  const excerpts = await pool.query(
    `select message_id, sender_name, message_created_at,
            coalesce(nullif(message,''), caption, transcription) as text
       from whatsapp_messages
      where whatsapp_owner = $1 and chat_id = $2 and chat_type = 'group'
        and coalesce(nullif(message,''), caption, transcription) is not null
      order by message_created_at desc limit 20`,
    [OWNER, chatId],
  );
  res.json({
    digest: digest.rows[0] ?? null,
    recentExcerpts: excerpts.rows,
  });
});

export default router;
