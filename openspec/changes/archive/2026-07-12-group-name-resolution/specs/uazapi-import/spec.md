## ADDED Requirements

### Requirement: Resolução de nomes de participantes por pushname

O sistema SHALL preencher o nome dos participantes (`group_participants.name`) a
partir do **pushname** das mensagens (`sender_name`), quando o nome estiver nulo,
juntando pelo `@lid` do remetente (`metadata.raw.sender`). MUST usar o pushname
mais recente por `lid`, MUST NOT sobrescrever um nome já existente, e MUST ser
idempotente. A tabela read-only `whatsapp_messages` NÃO é alterada.

#### Scenario: Nome resolvido do pushname

- **WHEN** um participante está sem nome e seu `lid` enviou mensagens com `sender_name`
- **THEN** seu `name` recebe o pushname mais recente daquele `lid`

#### Scenario: Não sobrescreve nome existente

- **WHEN** um participante já tem nome
- **THEN** a resolução não altera esse nome

#### Scenario: Sem pushname permanece nulo

- **WHEN** um participante nunca enviou mensagem (ou seu grupo não tem histórico)
- **THEN** o nome permanece nulo (o uazapi não expõe o nome dele)

#### Scenario: Resolução roda no import e como backfill

- **WHEN** o import termina, ou `resolve-names` roda manualmente
- **THEN** os nomes resolvíveis são preenchidos, de forma idempotente
