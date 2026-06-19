# Sinal

WhatsApp Intelligence + CRM dashboard that turns ~85k of Bruno's WhatsApp messages (stored in Supabase) into an actionable cockpit: what needs a reply, what's trending across groups, who's mentioning him, and a contact CRM — all in Brazilian Portuguese.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (Express, port from `PORT`)
- `pnpm --filter @workspace/sinal-web run dev` — frontend (React + Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build/typecheck composite libs (run after editing `lib/*`)
- Data/AI jobs (run from repo root):
  - `pnpm --filter @workspace/scripts run db-stats` — data health snapshot
  - `pnpm --filter @workspace/scripts run classify-sample` — text classification (env: `SAMPLE_SIZE`, `BATCH_SIZE`)
  - `pnpm --filter @workspace/scripts run backfill-contacts` — populate CRM from private chats
  - `pnpm --filter @workspace/scripts run build-topics` — cluster enriched topics into named pautas
  - `pnpm --filter @workspace/scripts run build-mentions` — detect + classify entity mentions (env: `MENTION_SAMPLE`)
  - `pnpm --filter @workspace/scripts run refresh-all` — runs the whole incremental pipeline in order (classify new → contacts → topics → mentions) so every tab is current. Intended as the run command of a Scheduled Deployment (cron); resilient (one failing job doesn't abort the rest).
- Required env/secrets: `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `SESSION_SECRET`, `WHATSAPP_OWNER`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (hand-written routes, cookie session)
- DB: Supabase PostgreSQL + Drizzle ORM (schema mirror in `lib/db`)
- AI: OpenAI direct (`lib/ai`) — classification, topic clustering, mention classification
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + React Query + wouter + recharts

## Where things live

- Source-of-truth schema: `lib/db/src/schema/*` (enrichment, topics, mentions, groups, crm, auth)
- AI logic: `lib/ai/src/*` (classify, cluster, mentions, taxonomy)
- REST routes: `artifacts/api-server/src/routes/*` (metrics, contacts, topics, groups, mentions, entities, tasks, saved, auth)
- Owner/tenant scoping helper: `artifacts/api-server/src/lib/scope.ts`
- Frontend API client + React Query hooks (hand-written): `artifacts/sinal-web/src/lib/api.ts`
- Frontend pages: `artifacts/sinal-web/src/pages/*`; shell + auth gate in `src/App.tsx`
- Data/AI jobs: `scripts/src/*`
- PRD + visual reference: `attached_assets/PRD_*.md`, `attached_assets/mockup_*.html`

## Architecture decisions

- **`whatsapp_messages` is READ-ONLY.** No writes, no FKs to it, no indexes on it. Join key is `message_id` (text, unique). Every read of it MUST filter `whatsapp_owner = WHATSAPP_OWNER`.
- **Multi-tenant from day 1.** Every new table has `tenant_id` + RLS; MVP tenant id `00000000-0000-0000-0000-000000000001`. The server connects as the pooler owner (bypasses RLS), so app code must always scope by `tenant_id` AND owner.
- **Routes + frontend API client are hand-written** (not OpenAPI codegen) — kept consistent on purpose.
- **Private (DM) chats are keyed by `chat_id`** (the partner's phone), NOT `contact_phone` (empty for DMs). `chat_name` = contact name.
- **AI jobs are sample-scale and resumable.** Each batch autocommits; the long jobs can exceed the shell timeout but data persists. Mentions accumulate (insert-only-new); topics rebuild per scope.

## Product

Six areas: Visão Geral (overview KPIs + unanswered + trending), Privado (categories, invites, private topics, time spent), Grupos (cross-group pautas + group digests via drawers), Menções (who's talking about monitored entities, with real excerpts), Contatos (CRM with editable profiles + history), Salvos & Tasks. Principle: "nenhum número é beco sem saída" — every number drills into the source messages.

## User preferences

- Communicate with the user in Brazilian Portuguese (UI is entirely in pt-BR).
- No emojis in the UI — use lucide-react icons.

## Gotchas

- Do NOT run the full ~85k text backfill (~$80–130) without explicit user cost approval. Run samples first.
- After editing `lib/*`, run `pnpm run typecheck:libs` before leaf typechecks (stale declarations cause phantom errors).
- Use `zod/v4` subpath imports.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
