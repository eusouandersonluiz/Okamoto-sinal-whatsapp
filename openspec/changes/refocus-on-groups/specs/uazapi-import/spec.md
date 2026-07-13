## MODIFIED Requirements

### Requirement: Importação parametrizável e incremental

O sistema SHALL importar **apenas chats de grupo** (`@g.us`), percorrendo **todos**
os grupos por padrão (sem limite de chats). DMs não são importadas. Limites
opcionais permanecem para pilotagem barata: número máximo de grupos
(`IMPORT_CHAT_LIMIT`), número máximo de mensagens por grupo (`IMPORT_MSG_LIMIT`) e
data mínima ISO (`IMPORT_SINCE`). A importação MUST ser incremental (dedup por
`message_id`).

#### Scenario: Só grupos são importados

- **WHEN** a importação percorre os chats
- **THEN** somente chats `@g.us` são buscados; chats de DM (`@s.whatsapp.net`) são ignorados

#### Scenario: Todos os grupos por padrão

- **WHEN** a importação roda sem `IMPORT_CHAT_LIMIT`
- **THEN** percorre todos os grupos disponíveis, não apenas uma amostra

#### Scenario: Piloto limita grupos e mensagens

- **WHEN** `IMPORT_CHAT_LIMIT` e `IMPORT_MSG_LIMIT` estão definidos
- **THEN** a importação percorre no máximo esse número de grupos e, por grupo, no máximo esse número de mensagens

#### Scenario: Corte por data mínima

- **WHEN** `IMPORT_SINCE` está definido e uma mensagem é mais antiga que o limite
- **THEN** a paginação daquele grupo para ao alcançar mensagens anteriores à data

## ADDED Requirements

### Requirement: Roster completo de grupos

O sistema SHALL puxar o roster completo de grupos do uazapi — inclusive grupos sem
mensagem recente — e fazer upsert dos metadados em `groups` (nome, nº de
participantes). O acoplamento com o endpoint de grupos do uazapi MUST viver no
client (`listGroups`/`normalizeGroup`), como o restante do adapter.

#### Scenario: Grupos silenciosos aparecem no roster

- **WHEN** o import busca o roster e um grupo não tem mensagens recentes
- **THEN** o grupo ainda é registrado em `groups` (com nome e nº de participantes), disponível para gerenciamento

#### Scenario: Upsert idempotente do roster

- **WHEN** o roster é importado uma segunda vez
- **THEN** os grupos existentes têm seus metadados atualizados sem duplicação (chave `tenant_id` + `chat_id`)

#### Scenario: Acoplamento isolado no client

- **WHEN** o formato do endpoint de grupos do uazapi muda
- **THEN** apenas `listGroups`/`normalizeGroup` em `client.ts` precisam de ajuste
