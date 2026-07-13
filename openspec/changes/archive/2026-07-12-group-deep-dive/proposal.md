## Why

O refoco em grupos entregou lista + gerenciamento, mas falta o mergulho: **quem
participa** de cada grupo (hoje a "contagem de pessoas" é derivada do remetente e
dá ~0, porque em grupo o remetente é `@lid`, não telefone) e **abrir todas as
mensagens de um grupo numa linha do tempo** (quem enviou, quando, o quê). Este
change traz os participantes reais e a timeline por grupo.

## What Changes

- **Participantes reais por grupo** — o import passa a buscar `POST /group/info`
  do uazapi por grupo, que traz `ParticipantCount` e a lista `Participants`
  (telefone, nome de exibição, admin). Persistidos em uma nova tabela
  `group_participants`; a contagem real vai para `groups.participant_count`.
- **Timeline do grupo** — nova API paginada `GET /groups/:chatId/messages` que
  lê `whatsapp_messages` do grupo em ordem cronológica (remetente, horário,
  texto/mídia, direção), com paginação para grupos com muitas mensagens.
- **Página de detalhe do grupo** (front) — abre um grupo e mostra a timeline
  completa (carregamento incremental) + a lista de participantes.
- **Todos os grupos do número + todas as mensagens** — reforça o import
  já-só-grupos para rodar sem limites (roster completo + todas as mensagens de
  cada grupo). O roster já cobre "todos os grupos dos quais o número participa".

## Capabilities

### New Capabilities
- `group-detail`: abrir um grupo específico e ver a linha do tempo completa das
  mensagens (remetente, horário, conteúdo, paginada) e a lista de participantes.

### Modified Capabilities
- `uazapi-import`: além do roster, busca os **participantes e a contagem** de cada
  grupo via `POST /group/info` e os persiste (`group_participants` +
  `groups.participant_count`).

## Impact

- **DB:** nova tabela `group_participants` (`tenant_id`, `chat_id`, `phone`,
  `lid`, `name`, `is_admin`) + coluna `groups.participant_count` — nova migration
  aditiva.
- **Import (`scripts`):** `client` ganha `getGroupInfo(jid)` /
  `listGroupParticipants` (acoplamento uazapi isolado); orquestrador faz upsert de
  participantes + contagem por grupo (limitável no piloto).
- **API (`api-server`):** `GET /groups/:chatId/messages` (timeline paginada) e
  `GET /groups/:chatId/participants`.
- **Front (`radar-web`):** rota `/grupos/:chatId` com timeline (load-more) +
  participantes; entrada a partir da lista de grupos.
- **Corrige** a "contagem de pessoas enganosa" (0) apontada na review do refocus.
- **Fora de escopo:** enviar mensagens ou agir no grupo (segue read-only).
