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

- [ ] 4.1 API: remover rotas `contacts`, `mentions`, `entities`, `saved`, `tasks`, `google`; limpar `routes/index.ts`
- [ ] 4.2 Schema: remover `crm`, `mentions`, `saved`, `tasks`, `google` (oauth); limpar `schema/index.ts`
- [ ] 4.3 Scripts: remover `backfill-contacts`, `build-mentions`; ajustar `refresh-all` e o pipeline (`refresh_runs.jobs`)
- [ ] 4.4 Front: remover páginas `privado`, `contatos`, `mencoes`, `salvos`, `conectores` + itens de nav
- [ ] 4.5 Regenerar client/orval (`api-spec`) e garantir que nada referencia endpoints removidos
- [ ] 4.6 Decisão do usuário: dropar tabelas órfãs (migration separada) ou deixar inertes
- [ ] 4.7 Typecheck/build verdes após remoção

## 5. Front — dashboard + gerenciamento

- [ ] 5.1 Reescrever `overview` como Dashboard de grupos (KPIs, grupos em alta, pautas quentes)
- [ ] 5.2 Página de Grupos: lista com filtros (categoria/tag/arquivados) + UI de gerenciamento (relevância, apelido, tags, digest, arquivar)
- [ ] 5.3 Manter Pautas (topics cross-grupo) e Mídia (por grupo) no nav
- [ ] 5.4 Ajustar router e `AppShell` para o nav só-grupos

## 6. Verificação final

- [ ] 6.1 `bun install` limpo; typecheck verde em todos os pacotes; `bun test` verde
- [ ] 6.2 `docker build` ok
- [ ] 6.3 e2e local: import (roster + todos os grupos) → refresh (amostra) → dashboard de grupos + gerenciamento funcionando
- [ ] 6.4 `grep` não encontra referências às áreas removidas em código ativo
- [ ] 6.5 Docs (README/ARQUITETURA) refletem o produto só-grupos
