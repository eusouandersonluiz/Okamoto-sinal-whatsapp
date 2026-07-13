## ADDED Requirements

### Requirement: Participantes e contagem por grupo

O sistema SHALL buscar os participantes e a contagem de cada grupo via
`POST /group/info` do uazapi e persisti-los: os membros em `group_participants`
(`lid`, `phone`, `name`, `is_admin`) e a contagem em `groups.participant_count`. O
acoplamento com o endpoint MUST viver no client (`getGroupInfo`/
`normalizeGroupInfo`), como o resto do adapter. A busca MUST respeitar o limite de
piloto (`IMPORT_CHAT_LIMIT`) e a resiliência por grupo (um grupo que falha é logado
e pulado).

#### Scenario: Upsert de participantes e contagem

- **WHEN** o import processa um grupo
- **THEN** os participantes retornados por `/group/info` são upsertados em `group_participants` e `groups.participant_count` recebe `ParticipantCount`

#### Scenario: Idempotente por LID

- **WHEN** o import roda de novo
- **THEN** os participantes existentes são atualizados sem duplicar (chave `tenant_id` + `chat_id` + `lid`)

#### Scenario: Participante sem telefone

- **WHEN** um participante não traz `PhoneNumber`
- **THEN** ele é gravado com `phone` nulo (mantendo `lid` e `name`), não descartado

#### Scenario: Falha em um grupo não aborta o import

- **WHEN** `/group/info` falha para um grupo
- **THEN** o erro é logado, esse grupo é pulado e os demais seguem
