# Fluxo do Supabase

Este documento explica como o Sinal se conecta ao Supabase, como a tabela de
origem read-only funciona, o modelo multi-tenant + RLS, e a estrutura de todas as
tabelas próprias do projeto.

## Conexão

O Sinal usa o PostgreSQL do Supabase via Drizzle ORM sobre um pool `pg`. A lógica
de conexão vive em `lib/db/src/index.ts`.

- **String de conexão.** O pool lê `SUPABASE_DB_URL` (com `DATABASE_URL` como
  fallback). Use a URL do **transaction pooler** do Supabase (porta `6543`), não
  a conexão direta — o pooler é o caminho recomendado para apps serverless e de
  curta duração.
- **SSL.** Quando a string aponta para um host `supabase.co`/`supabase.com`, o
  pool habilita SSL com `rejectUnauthorized: false`. Isso é necessário porque o
  certificado do pooler nem sempre encadeia até uma CA pública padrão.
- **Pool.** `max: 10` conexões. O servidor conecta como o **owner do pooler**, que
  **ignora o RLS** — por isso o código da aplicação precisa dar escopo às queries
  manualmente (veja abaixo).

> Dica de operação: nas consultas ad hoc ao banco de produção, use
> `psql "$SUPABASE_DB_URL"`. O sandbox de execução de código atinge um banco
> diferente (o banco do Replit), **não** o Supabase.

## A tabela de origem: `whatsapp_messages`

`whatsapp_messages` é a **fonte de dados read-only**. É externa ao app:

- **Nunca escrita, nunca migrada.** As migrations do Sinal não a criam nem a
  alteram. Você a cria e popula no seu projeto Supabase (veja a estrutura na
  [seção "Fonte de dados" do README](../README.md#fonte-de-dados)).
- **Sem foreign keys, sem índices adicionados pelo app.** A chave de junção para
  todo o enriquecimento é `message_id` (texto único).
- **Sempre com escopo de owner.** Toda leitura filtra
  `whatsapp_owner = WHATSAPP_OWNER`. A tabela não tem coluna `tenant_id`; a
  segurança de tenant nas leituras dela é garantida por um gate de router no
  servidor (não por junção por query).
- **Chaveamento de DMs.** Em conversas privadas, a chave da conversa é `chat_id`
  (o telefone do parceiro). `contact_phone` é vazio em DMs; `chat_name` é o nome
  do contato.

O espelho tipado (apenas para consultas convenientes via Drizzle) está em
`lib/db/src/schema/whatsapp.ts`. Os analytics pesados usam SQL bruto.

## Multi-tenant + RLS

O Sinal é multi-tenant desde o dia um:

- Toda tabela **própria do app** tem uma coluna `tenant_id` e RLS habilitado.
- O id de tenant do MVP é `00000000-0000-0000-0000-000000000001`.
- O servidor conecta como o owner do pooler, que **ignora o RLS**. Portanto o
  código da aplicação **sempre** precisa dar escopo às queries por `tenant_id`
  **e** owner. O helper central é `artifacts/api-server/src/lib/scope.ts`.

A RLS é uma camada de defesa em profundidade (caso o app passe a conectar com uma
role limitada); o escopo explícito no código é a garantia principal hoje.

## Tabelas do projeto

Todas as tabelas a seguir são criadas pelas migrations em `lib/db/migrations/*`
(aplicadas em ordem pelo script `migrate`). Os schemas fonte estão em
`lib/db/src/schema/*`. Salvo indicação, toda tabela tem `tenant_id` (uuid) e
timestamps.

### Tenancy & auth (`tenancy.ts`)

- **`tenants`** — `id`, `name`, `created_at`. Cada cliente/instância é um tenant.
- **`profiles`** — `id` (= id do usuário no Supabase Auth), `tenant_id`, `email`.
  Liga um usuário autenticado ao seu tenant.

### CRM (`crm.ts`)

- **`contacts`** — perfil do contato: `display_name`, `email`, `description`,
  `primary_phone`, `google_resource_name`, `dominant_category`,
  `last_interaction_at`, `ai_analysis` (+ `ai_analysis_at`,
  `ai_analysis_msg_count`), `source` (padrão `dm`). `msg_count` é cacheado e
  atualizado pelo job `backfill-contacts`.
- **`contact_identifiers`** — telefones que pertencem a um contato:
  `contact_id`, `phone`, `source`.
- **`labels`** — etiquetas do CRM: `name`, `color`.
- **`contact_labels`** — junção N:N entre `contacts` e `labels` (PK composta).

### Enriquecimento (`enrichment.ts`)

- **`message_enrichment`** — resultado de IA por mensagem (PK `message_id`):
  `chat_type`, `category`, `sentiment`, `topics[]`, `is_question`,
  `requires_reply`, `summary`, `model_used`, `processed_at`.
- **`media_assets`** — extração de texto de mídia (PK `message_id`): `kind`,
  `extracted_text`, `status` (padrão `pending`), `model_used`.
- **`invite_triage`** — estado de triagem de convites/oportunidades, uma linha por
  contato (chaveado por `chat_id`): `status` (padrão `aberto`), `contact_id`,
  `source_message_id`, `direction`, `name`.

### Grupos (`groups.ts`)

- **`groups`** — um registro por grupo (PK composta `tenant_id` + `chat_id`):
  `name`, `message_count`, `last_activity_at`.
- **`support_groups`** — lista gerenciada pelo usuário de grupos tratados como
  "suporte/ruído" e ocultos por padrão na página de Menções: `chat_id`, `name`.
- **`group_digests`** — resumos por grupo e período: `chat_id`, `period_start`,
  `period_end`, `summary`, `top_excerpts` (jsonb).

### Tópicos (`topics.ts`)

- **`topics`** — temas canônicos (*pautas*): `label`, `scope`, `period_start`,
  `period_end`, `person_count`, `message_count`, `trend`, `summary`.
- **`topic_messages`** — junção tópico → mensagem (`topic_id`, `message_id`).
- **`topic_groups`** — distribuição de um tópico por grupo (`topic_id`,
  `chat_id`, `message_count`).

### Menções (`mentions.ts`)

- **`monitored_entities`** — entidades monitoradas: `name`, `type`, `aliases[]`.
  Os aliases **são** as palavras-chave de detecção de menções.
- **`mentions`** — ocorrências detectadas: `message_id`, `entity_id`,
  `mention_type`, `sentiment`. Acumulam (insert-only-new).

### Tasks (`tasks.ts`)

- **`tasks`** — itens de acompanhamento do CRM: `contact_id` (set null ao apagar
  o contato), `title`, `note`, `direction`, `source_message_id`, `due_at`,
  `done` (padrão `false`), `done_at`.

### Salvos (`saved.ts`)

- **`saved_items`** — conteúdo marcado: `kind`, `source_type`, `source_id`,
  `text`.

### Google OAuth (`google.ts`)

- **`google_oauth_tokens`** — tokens OAuth por tenant (único por `tenant_id`)
  para a sincronização de Contatos (People API): `google_sub`, `email`,
  `access_token`, `refresh_token`, `token_type`, `scope`, `expiry`.
- **`google_oauth_states`** — registros de state OAuth de curta duração (CSRF +
  resolução de tenant) para o fluxo funcionar em uma aba first-party sem depender
  do cookie de sessão do iframe: PK `state`, `tenant_id`, `user_id`, `email`,
  `expires_at`.

### Refresh (`refresh.ts`)

- **`refresh_runs`** — uma linha por execução do pipeline de refresh incremental:
  `status`, `trigger`, `started_at`, `finished_at`, `jobs` (jsonb), `error`. Usada
  pela orquestração em `lib/db/src/pipeline.ts` (lock de concorrência, execução,
  finalização).
