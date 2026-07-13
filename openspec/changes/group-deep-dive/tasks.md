## 1. DB — participantes

- [ ] 1.1 Migration aditiva: tabela `group_participants` (`tenant_id`, `chat_id`, `lid`, `phone`, `name`, `is_admin`, unique `(tenant_id, chat_id, lid)`) + coluna `groups.participant_count`
- [ ] 1.2 Schema Drizzle: `groupParticipantsTable` + `participantCount` em `groupsTable`
- [ ] 1.3 `migrate` aplica limpo (idempotente); colunas/índice confirmados

## 2. Import — /group/info

- [ ] 2.1 `client.ts`: `getGroupInfo(jid)` (POST /group/info) + `normalizeGroupInfo` → `{ participantCount, participants: [{lid, phone, name, isAdmin}] }` + fixture `group-info.json`
- [ ] 2.2 Teste de `normalizeGroupInfo` (fixture) sob `bun test`
- [ ] 2.3 `import-uazapi`: `buildParticipantUpsert` + upsert de participantes e `participant_count` por grupo (respeita IMPORT_CHAT_LIMIT + resiliência por grupo)
- [ ] 2.4 Teste do orquestrador (upsert de participantes) sob `bun test`
- [ ] 2.5 Piloto local: participantes + contagem populados em `group_participants`/`groups`

## 3. API — timeline + participantes

- [ ] 3.1 `GET /groups/:chatId/messages?before&limit`: timeline paginada por cursor (whatsapp_messages, cronológica, campos de remetente/horário/conteúdo/mídia)
- [ ] 3.2 `GET /groups/:chatId/participants`: lista de `group_participants`
- [ ] 3.3 `GET /groups` e detalhe usam `groups.participant_count` (não mais derivado)
- [ ] 3.4 Testes de rota sob `bun test` (quando houver DB)

## 4. Front — detalhe do grupo

- [ ] 4.1 Hooks no `api.ts`: `useGroupMessages` (paginado/`useInfiniteQuery` ou load-more) + `useGroupParticipants`
- [ ] 4.2 Rota `/grupos/:chatId` (detalhe): timeline com "carregar mais" + lista de participantes
- [ ] 4.3 Link do card de grupo → detalhe; contagem real de participantes na lista
- [ ] 4.4 Router (App.tsx) + navegação

## 5. Verificação

- [ ] 5.1 typecheck verde em todos os pacotes; `bun test` verde
- [ ] 5.2 `docker build` ok
- [ ] 5.3 e2e local: import (participantes) → login → `GET /groups/:id/messages` e `/participants` retornam dados; contagem real
- [ ] 5.4 Front: abrir um grupo, ver timeline (load-more) + participantes
