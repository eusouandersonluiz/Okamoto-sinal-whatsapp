# Arquitetura

O Radar Stark é um monorepo Bun (workspaces). Os dados fluem em uma direção: uma tabela
de origem read-only é enriquecida por jobs de IA em tabelas próprias do app, que
uma API Express serve a um frontend React.

## Fluxo de dados

```
┌─────────────────────┐
│  whatsapp_messages  │   Supabase, READ-ONLY, fonte externa
│  (escopo por        │   ~85k+ linhas; nunca escrita por este app
│   whatsapp_owner)   │
└──────────┬──────────┘
           │ leitura (filtrada por WHATSAPP_OWNER, junção por message_id)
           ▼
┌─────────────────────┐
│  Jobs de IA         │   scripts/* + lib/ai
│  classify · cluster │   classificação, clustering de tópicos, detecção
│  mentions · contacts│   de menções, análise de contato
└──────────┬──────────┘
           │ escrita
           ▼
┌─────────────────────┐
│  tabelas do app     │   enrichment, topics, mentions, crm, tasks,
│  (tenant_id + RLS)  │   saved, tenancy/auth, google — criadas por migrations
└──────────┬──────────┘
           │ leitura (escopo por tenant_id E owner)
           ▼
┌─────────────────────┐
│   Servidor API      │   artifacts/api-server (Express 5)
│   rotas /api/*      │   auth por cookie de sessão
└──────────┬──────────┘
           │ HTTP (/api, mesma origem)
           ▼
┌─────────────────────┐
│   Frontend Web      │   artifacts/radar-web (React + Vite)
│   hooks React Query │   todo número abre as mensagens de origem
└─────────────────────┘
```

Em desenvolvimento, o servidor Vite faz proxy de `/api` para o servidor de API
(configurável via `API_PROXY_TARGET`); em produção (contêiner) o servidor de API
serve o front buildado. De qualquer forma, o navegador vê uma única origem, e a API dá escopo a
toda leitura por `tenant_id` e owner.

## Estrutura do monorepo

### `lib/*` — bibliotecas compartilhadas

- **`@workspace/db`** — schema do Drizzle ORM, o pool de conexão pg e as
  migrations SQL.
  - Fonte da verdade do schema: `lib/db/src/schema/*` — `whatsapp` (espelho
    read-only), `enrichment`, `topics`, `mentions`, `groups`, `crm`, `tasks`,
    `saved`, `tenancy`, `google`, `refresh`.
  - Migrations: `lib/db/migrations/*.sql`, aplicadas em ordem lexical pelo script
    `migrate`.
  - O pool lê `SUPABASE_DB_URL` (ou `DATABASE_URL`).
  - Orquestração do pipeline de refresh: `lib/db/src/pipeline.ts` +
    `lib/db/src/refresh.ts` (lock de "apenas uma execução", início, execução,
    finalização).
- **`@workspace/ai`** — lógica de IA em `lib/ai/src/*`:
  - `classify.ts` — classifica mensagens em lote por categoria/sentimento e
    detecta perguntas/necessidade de resposta. A seleção de provedor (OpenAI vs
    OpenRouter) vive aqui.
  - `cluster.ts` — agrupa tópicos brutos em temas canônicos (*pautas*).
  - `mentions.ts` — identifica e classifica menções de entidades monitoradas.
  - `contact-analysis.ts` — gera um resumo de relacionamento por contato.
  - `taxonomy.ts` — constantes compartilhadas (categorias, sentimentos,
    blacklists de ruído).
- **`@workspace/api-zod`** — schemas Zod compartilhados na fronteira da API.
- **`@workspace/api-spec`** — spec da API + config de codegen (Orval).
- **`@workspace/api-client-react`** — pacote de cliente React Query.

### `artifacts/*` — apps publicáveis

- **`@workspace/api-server`** — servidor Express 5.
  - Rotas: `artifacts/api-server/src/routes/*` — `auth`, `metrics`,
    `metrics-private`, `contacts`, `topics`, `groups`, `mentions`, `entities`,
    `tasks`, `saved`, `search`, `media`, `google`, `health`, `refresh`.
  - Endpoints principais:
    - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — sessão.
    - `GET /api/metrics/overview` — KPIs do dashboard; `GET /api/metrics/private/*`
      e `GET /api/metrics/groups/*` — analytics de DMs e grupos.
    - `GET/PATCH /api/contacts`, `GET /api/contacts/:id/messages`,
      `POST /api/contacts/:id/analysis` — CRM e análise de contato.
    - `GET /api/topics`, `GET /api/mentions`, `GET/POST /api/entities` — descoberta.
    - `GET/POST/PATCH /api/tasks`, `GET/POST /api/saved` — tasks e salvos.
    - `GET /api/groups`, `GET /api/groups/:chatId/digest` — grupos e digests.
    - `GET /api/media/*`, `GET /api/search` — mídia e busca global.
    - `GET /api/google/callback`, `POST /api/google/import` — Google Contacts.
    - `GET /api/healthz`, `POST /api/refresh` — saúde e disparo do pipeline.
  - Helper de escopo owner/tenant: `src/lib/scope.ts` — toda query é escopada por
    `tenant_id` **e** owner.
  - Outras libs: `src/lib/supabase.ts` (cliente admin do Auth), `src/lib/auth.ts`
    (sessão), `src/lib/google.ts` (OAuth), `src/lib/scheduler.ts` (auto-refresh
    a cada 6h), `src/lib/logger.ts`.
  - As rotas são **escritas à mão**, mantidas em sincronia com o cliente do
    frontend de propósito (não é codegen OpenAPI).
- **`@workspace/radar-web`** — frontend React + Vite + Tailwind v4 + shadcn/ui.
  - Páginas: `src/pages/*` — `overview`, `privado`, `grupos`, `mencoes`,
    `contatos`, `salvos`, `midia`, `conectores`, `login`, `not-found`.
  - Cliente de API tipado + hooks React Query, escritos à mão: `src/lib/api.ts`
    (fala com `/api`).
  - Shell do app + gate de auth: `src/App.tsx`.
- **`@workspace/radar-deck`** — apresentação do projeto (slides).
- **`mockup-sandbox`** — referências estáticas de design, fora do app em execução.

### `scripts/*` — jobs de dados & IA (`@workspace/scripts`)

`migrate`, `bootstrap-auth`, `db-stats`, `classify-sample`, `backfill-contacts`,
`backfill-text-full`, `build-topics`, `build-mentions`, `refresh-all`. Todos
rodam com `tsx`. Veja [INSTALACAO.md](INSTALACAO.md#5-jobs-de-ia--dados).

O `refresh-all` roda o pipeline incremental inteiro na ordem (classificar novos →
contatos → tópicos → menções) e é resiliente (um job que falha não aborta os
demais). É pensado para ser o comando de um Scheduled Deployment (cron).

## Decisões-chave de design

- **`whatsapp_messages` é READ-ONLY.** Sem escritas, sem foreign keys para ela,
  sem índices nela. A chave de junção é `message_id` (texto único). Toda leitura
  filtra `whatsapp_owner = WHATSAPP_OWNER`. É uma tabela externa — as migrations
  não a criam nem alteram.
- **Multi-tenant desde o dia um.** Toda tabela do app tem `tenant_id` e RLS; o id
  de tenant do MVP é `00000000-0000-0000-0000-000000000001`. O servidor conecta
  como o owner do pooler (que ignora o RLS), então o código da aplicação sempre
  precisa dar escopo por `tenant_id` **e** owner.
- **Rotas e cliente de frontend escritos à mão.** Mantidos em sincronia
  deliberadamente em vez de gerados, para o contrato continuar legível.
- **Chats privados (DMs) são chaveados por `chat_id`** (o telefone do parceiro),
  não por `contact_phone` (que é vazio em DMs). `chat_name` é o nome do contato.
- **Jobs de IA são em escala de amostra e resumíveis.** Cada lote dá commit, então
  jobs longos sobrevivem a timeouts do shell. Menções acumulam (insert-only-new);
  tópicos são reconstruídos por escopo.

## Convenções

- TypeScript em todos os pacotes; imports do subpath `zod/v4`.
- Após editar `lib/*`, rode `bun run typecheck:libs` antes das checagens de tipo
  das leaf packages (declarações desatualizadas causam erros fantasmas).
- A UI é em português do Brasil e sem emojis — apenas ícones `lucide-react`.
