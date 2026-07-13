## Context

Radar Stark hoje tem 8 superfícies (Overview, Privado, Grupos, Mídia, Menções,
Contatos, Salvos, Conectores) sobre `whatsapp_messages` + tabelas de app
(enrichment, topics, mentions, crm, saved, tasks, groups). O uso converge para
grupos. Este design refoca tudo em grupos, remove o resto e amplia a importação
para o roster completo de grupos.

Restrições do repo: monorepo Bun; `whatsapp_messages` é read-only e nunca entra
nas migrations canônicas; a tabela `groups` já existe (PK `tenant_id`+`chat_id`:
`name`, `message_count`, `last_activity_at`) e `support_groups` marca grupos como
"suporte/ruído".

## Goals / Non-Goals

**Goals:**

- Produto só-grupos: análise (dashboard, digests, pautas, mídia por grupo) +
  gerenciamento (relevância, categoria/tags, apelido, cadência de digest,
  arquivar).
- Importar **todos** os grupos: roster (metadados) + mensagens, sem limite.
- Remover com segurança as capabilities não-grupo (front, API, schema, jobs).

**Non-Goals:**

- Apagar dados históricos já importados (DMs em `whatsapp_messages` ficam; só
  deixam de ser analisadas).
- Reescrever as migrations canônicas existentes (mudanças de `groups` vêm em nova
  migration aditiva).
- Enviar mensagens ou agir nos grupos (o produto continua read-only + humano age).

## Decisions

**1. Estado de gerenciamento estendendo `groups` (migration aditiva).**
Adiciona a `groups`: `relevance` (`monitored` | `ignored`, default `monitored`),
`category` (text), `tags` (text[]), `alias` (text), `digest_enabled` (bool),
`digest_cadence` (`daily` | `weekly`), `archived_at` (timestamptz null). Os dados
de `support_groups` migram para `relevance = 'ignored'`; `support_groups` é
descontinuada. Alternativa (tabela de gestão separada) — rejeitada: 1:1 com
grupo, coluna é mais simples e consultável.

**2. Roster de grupos no import (uazapi).**
Confirmado contra a instância viva (2026-07-12): `listGroups()` usa
`POST /chat/find` com `wa_isGroup:true` (paginado; a instância tem **349 grupos**),
normalizando `wa_chatid` → jid e `wa_name`/`name` → nome. `/chat/find` **não**
traz contagem de participantes, então `participantsCount` é **opcional** (null por
padrão; obter via `/group/info` por grupo seria 1 call por grupo — fica como
follow-up, não bloqueia). O orquestrador faz **upsert do roster** em `groups`
(inclusive grupos sem mensagem) antes/independente das mensagens. Alternativa
(derivar grupos só das mensagens) — rejeitada: perde grupos silenciosos, que
precisam aparecer no gerenciamento.

**3. Importação restrita a grupos, sem limite de chats.**
`import-uazapi` passa a iterar só chats `@g.us`, sem `IMPORT_CHAT_LIMIT` como
padrão (ainda disponível para piloto). DMs deixam de ser buscadas. O mapper já
lida com grupo; a mudança é no orquestrador/roster.

**4. Overview → Dashboard de grupos.**
A landing vira KPIs de grupos (nº de grupos monitorados, mensagens no período,
grupos em alta, pautas quentes). Reaproveita `metrics` rescopado a grupos.

**5. Remoção limpa e ordenada.**
Remover na ordem front → API → schema → jobs, mantendo build/typecheck verdes a
cada passo. `refresh-all` e o schema `index.ts` são atualizados para não
referenciar os módulos removidos. Migrations antigas de tabelas removidas
**permanecem** no histórico (não se reescreve migration aplicada); uma nova
migration dropa as tabelas órfãs (`crm`, `mentions`, `saved`, `tasks`,
`google_oauth_*`) — opcional, com cautela.

## Risks / Trade-offs

- **Endpoint de roster do uazapi** → confirmar contra a instância real (nome do
  endpoint, campo de participantes). Mitigação: isolar em `client.ts`
  (`listGroups`/`normalizeGroup`) + fixture; ajustar só ali se a versão diferir.
- **Drop de tabelas com dados** → dropar `crm`/`mentions`/etc. perde dados. Mitigação:
  a migration de drop é separada e opcional; por padrão as tabelas ficam órfãs
  (inertes) e o código para de usá-las. Decidir o drop com o usuário.
- **`refresh-all` / pipeline** → remover jobs sem quebrar a orquestração
  (`lib/db/src/pipeline.ts`, `refresh_runs.jobs`). Mitigação: atualizar a lista de
  jobs e os testes.
- **Rotas removidas ainda referenciadas** → o client React (`lib/api-*`) e o
  `api-spec`/orval podem referenciar endpoints removidos. Mitigação: regenerar o
  client + typecheck como gate.
- **Migrar `support_groups`** → backfill `relevance='ignored'` a partir dele antes
  de descontinuar.

## Migration Plan

Fases, repo verde ao fim de cada:
1. **DB** — migration aditiva em `groups` (colunas de gestão) + backfill de
   `support_groups`.
2. **Import** — `listGroups`/roster no client + orquestrador só-grupos, sem limite.
3. **API** — endpoints de gerenciamento de grupos; rescopar `metrics`/`media`.
4. **Remoção** — apagar páginas/rotas/schemas/jobs não-grupo; atualizar nav,
   router, `refresh-all`, `schema/index.ts`, client/orval.
5. **Front** — dashboard de grupos + UI de gerenciamento na página de grupos.

Rollback: branch isolada; reverter = descartar a branch. Dados históricos
intactos.

## Open Questions

- Dropar de fato as tabelas órfãs (`crm`, `mentions`, `saved`, `tasks`,
  `google_oauth_*`) ou deixá-las inertes? (Assumido: deixar inertes; drop é
  migration separada, sob confirmação.)
- Endpoint exato de roster de grupos no uazapi (a confirmar na instância).
- Manter `search` (rescopado a mensagens de grupo) ou remover? (Assumido: manter,
  rescopado.)
- "Pautas" e "Mídia" ganham navegação própria ou viram abas dentro de Grupos?
