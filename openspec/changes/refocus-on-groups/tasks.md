## 1. DB — gestão de grupos

- [x] 1.1 Migration `0010_group_management.sql`: `relevance`/`category`/`tags`/`alias`/`digest_enabled`/`digest_cadence`/`archived_at` (aditiva, idempotente)
- [x] 1.2 Schema Drizzle `groups.ts` atualizado com as 7 colunas (+ import `boolean`)
- [x] 1.3 Backfill `support_groups` → `relevance='ignored'` embutido na migration (no-op enquanto `groups` vazia; descontinuar uso de `support_groups` no código fica p/ Fase 4)
- [x] 1.4 `migrate` aplicou `0010` limpo; 12 colunas em `groups` confirmadas; typecheck libs verde

## 2. Import — roster + todos os grupos

- [x] 2.1 `client.ts`: `listGroups()` (POST /chat/find wa_isGroup:true) + `normalizeGroup()` + fixture `group.json`; `UazGroup` em types
- [x] 2.2 Teste de `normalizeGroup` (fixture + contagem opcional) sob `bun test`
- [x] 2.3 `import-uazapi`: `buildGroupUpsert` + upsert do roster em `groups` (roster antes das mensagens → grupos silenciosos entram)
- [x] 2.4 `import-uazapi`: itera só grupos (via `listGroups`), sem `IMPORT_CHAT_LIMIT` por padrão; DMs não importadas
- [x] 2.5 Testes do orquestrador reescritos (roster, grupo silencioso, dedup, falha isolada) — `bun test` 25/25
- [x] 2.6 Piloto local: 5 grupos → `groups` populada (relevance=monitored, digest_cadence=weekly defaults); dedup por message_id (0 novas)

## 3. API — gerenciamento + rescopo

- [x] 3.1 `groups` route reescrito: GET (tabela groups + stats live, filtros active/archived/all) + PATCH (relevância/categoria/tags/apelido/digest_enabled/digest_cadence) + archive/unarchive; digest mantido. typecheck api-server verde
- [ ] 3.2 Rescopar `metrics` para KPIs de grupos (dashboard); excluir `ignored`/arquivados — PENDENTE (folda na Fase 5 / dashboard)
- [ ] 3.3 Rescopar `media` para mídia de grupos — PENDENTE
- [ ] 3.4 Geração de digests respeita `digest_enabled`/`digest_cadence` — PENDENTE (mudança no job de digest)
- [ ] 3.5 Atualizar testes de `groups.test.ts` p/ os novos endpoints — PENDENTE (integração, precisa DB)

## 4. Remoção das áreas não-grupo

- [x] 4.1 API: removidas rotas contacts/mentions/entities/saved/tasks/google (+ lib/google.ts); `routes/index.ts` limpo
- [x] 4.2 Schema: removidos crm/mentions/saved/tasks/google; `schema/index.ts` limpo
- [x] 4.3 Scripts: removidos backfill-contacts/build-mentions; pipeline JOBS = classify + pautas; scripts/package.json ajustado
- [x] 4.4 Front: removidas páginas privado/contatos/mencoes/salvos/conectores + EntityManagerDialog; App.tsx router e AppShell nav só-grupos
- [x] 4.5 N/A — front usa `@/lib/api.ts` hand-written (sem orval); api.ts atualizado (hooks de grupo). Dead hooks de features removidas ficam p/ cleanup
- [x] 4.6 DROP escolhido pelo usuário: migration 0011 dropa contacts/mentions/tasks/saved_items/google_oauth_*; verificado no DB local
- [x] 4.7 Typecheck (libs+api-server+scripts+radar-web) e builds (web+api) verdes; bun test 25/25

## 5. Front — dashboard + gerenciamento

- [x] 5.1 `overview` reescrito = Dashboard de grupos (KPIs: monitorados/mensagens/pautas; grupos mais ativos; pautas quentes via useGroupTopics)
- [x] 5.2 `grupos` reescrito: lista com filtros (ativos/arquivados/todos) + UI de gestão (relevância, apelido, categoria, tags, digest on/off + cadência, arquivar)
- [x] 5.3 Mídia mantida no nav; Pautas dobradas no Dashboard (sem nav próprio — decisão de simplicidade)
- [x] 5.4 Router (App.tsx) e nav (AppShell) só-grupos: Dashboard / Grupos / Mídia

## 6. Verificação final

- [ ] 6.1 `bun install` limpo; typecheck verde em todos os pacotes; `bun test` verde
- [ ] 6.2 `docker build` ok
- [ ] 6.3 e2e local: import (roster + todos os grupos) → refresh (amostra) → dashboard de grupos + gerenciamento funcionando
- [ ] 6.4 `grep` não encontra referências às áreas removidas em código ativo
- [ ] 6.5 Docs (README/ARQUITETURA) refletem o produto só-grupos
