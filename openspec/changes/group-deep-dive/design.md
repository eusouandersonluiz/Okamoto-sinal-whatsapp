## Context

Pós-refoco, o Radar Stark lista e gerencia grupos, mas não mostra QUEM está em cada
grupo nem deixa navegar TODAS as mensagens. A contagem "N pessoas" era derivada de
`count(distinct sender_phone)` sobre `whatsapp_messages`, que dá ~0 em grupos
porque o remetente de grupo é `@lid` (linked-id), não telefone. Os membros reais
só existem no uazapi, via `POST /group/info`.

Confirmado contra a instância viva (2026-07-12): `POST /group/info` com
`{groupjid}` retorna `ParticipantCount` (int) e `Participants[]` — cada item com
`PhoneNumber`, `DisplayName`, `LID`, `JID`, `IsAdmin`/`IsSuperAdmin`.

## Goals / Non-Goals

**Goals:**

- Participantes reais por grupo (telefone quando disponível, nome, admin) +
  contagem correta.
- Abrir um grupo e ver a **timeline completa** das mensagens (remetente, horário,
  conteúdo), paginada.
- Reaproveitar o import já-só-grupos: roster (todos os grupos do número) + todas as
  mensagens de cada grupo.

**Non-Goals:**

- Enviar mensagens / agir no grupo (segue read-only).
- Resolver `@lid → telefone` no histórico de mensagens (o timeline usa
  `sender_name`; o telefone real vem do roster de participantes, não das mensagens).
- Sincronização em tempo real de entradas/saídas de membros (snapshot no import).

## Decisions

**1. Participantes via `POST /group/info`, persistidos em `group_participants`.**
Nova tabela `group_participants (tenant_id, chat_id, lid, phone, name, is_admin)`
com unique `(tenant_id, chat_id, lid)` (o `LID` é o id estável; `phone` pode ser
null por privacidade). A contagem real vai para a nova coluna
`groups.participant_count`. Alternativa (derivar de mensagens) — rejeitada: dá 0
por causa do `@lid`.

**2. Busca no import, por grupo, limitável.**
O orquestrador chama `getGroupInfo(jid)` por grupo e faz upsert dos participantes
+ contagem. São ~349 chamadas no full; respeitam `IMPORT_CHAT_LIMIT` (piloto) e o
retry já existente do client. A UI pode disparar um refresh on-demand depois
(follow-up). Alternativa (só on-demand ao abrir o grupo) — adiada; ter os dados
pré-carregados simplifica a lista/contagem.

**3. Timeline paginada por cursor.**
`GET /groups/:chatId/messages?before=<ISO>&limit=50` lê `whatsapp_messages`
(read-only) filtrado por owner + `chat_id` + `chat_type='group'`, ordenado por
`message_created_at desc`, retornando também `nextBefore` (o timestamp do último
item) para "carregar mais antigas". Campos: `message_id`, `sender_name`,
`direction`, `message_created_at`, texto (`message`/`caption`/`transcription`),
`media_url`/`media_mime_type`, `reply_to_message_id`, `reaction`. O front renderiza
em ordem cronológica com load-more.

**4. Página de detalhe do grupo no front.**
Rota `/grupos/:chatId`: cabeçalho (nome/apelido + contagem) → abas ou seções
**Timeline** (load-more) e **Participantes** (nome, telefone, admin). Entrada a
partir de um clique no card da lista de grupos.

## Risks / Trade-offs

- **~349 chamadas `/group/info` no full import** → mitigado por `IMPORT_CHAT_LIMIT`
  (piloto) + retry/backoff do client; erro em um grupo é logado e pulado (resiliência
  por grupo já existente).
- **Participantes sem telefone** (privacidade / só `@lid`) → `phone` fica null;
  exibe nome + "sem telefone". Chave por `LID`.
- **Timelines grandes** (centenas/milhares de msgs) → paginação por cursor
  obrigatória; sem `select *` sem limite.
- **Membros mudam ao longo do tempo** → o roster de participantes é um snapshot do
  momento do import; documentar que não é histórico de entradas/saídas.
- **Acoplamento uazapi** → `getGroupInfo`/`normalizeGroupInfo` ficam no `client`,
  como o resto do adapter.

## Migration Plan

1. **DB** — migration aditiva: `group_participants` + `groups.participant_count`.
2. **Import** — `client.getGroupInfo` + upsert de participantes/contagem no
   orquestrador (limitável). Piloto local.
3. **API** — `GET /groups/:chatId/messages` (timeline paginada) + `GET
   /groups/:chatId/participants`.
4. **Front** — rota `/grupos/:chatId` (timeline + participantes) + link no card.

Rollback: branch isolada; dados históricos intactos.

## Open Questions

- Buscar participantes de todos os 349 no primeiro import (mais lento) ou só dos
  grupos monitorados? (Assumido: todos, capado por `IMPORT_CHAT_LIMIT`.)
- Timeline: incluir mídia inline (thumb/áudio) ou só rótulo "[imagem]/[áudio]" com
  link? (Assumido: rótulo + link do `media_url`; player fica follow-up.)
