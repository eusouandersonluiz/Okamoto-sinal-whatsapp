import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { OWNER } from "../lib/scope";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

// Search across groups and topics (pautas). Powers the Cmd+K palette. `people`
// is always empty since the refocus on groups (the CRM was removed); the field
// is kept so the client response shape stays stable.
router.get("/search", async (req: AuthedRequest, res) => {
  const t = req.auth!.tenantId;
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json({ people: [], groups: [], topics: [] });
    return;
  }
  const like = `%${q}%`;

  const [groups, topics] = await Promise.all([
    // Groups derived live from whatsapp_messages.
    pool.query(
      `select chat_id, max(chat_name) as name, count(*)::int as message_count
         from whatsapp_messages
        where whatsapp_owner = $1 and chat_type = 'group' and chat_id is not null
          and chat_name ilike $2
        group by chat_id
        order by message_count desc
        limit 6`,
      [OWNER, like],
    ),
    // Named topics (pautas).
    pool.query(
      `select id, label, scope, message_count
         from topics
        where tenant_id = $1 and label ilike $2
        order by message_count desc nulls last
        limit 6`,
      [t, like],
    ),
  ]);

  res.json({
    people: [],
    groups: groups.rows,
    topics: topics.rows,
  });
});

export default router;
