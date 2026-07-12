# uazapi-import

## Purpose

Importação sob demanda do histórico de WhatsApp de uma instância uazapi para o
mirror local `whatsapp_messages`, com normalização isolada do provedor, upsert
idempotente por `message_id` e resiliência por chat. Existe para permitir rodar o
Radar Stark localmente (Supabase em Docker) sem violar o contrato read-only da
tabela-fonte usada em produção.

## Requirements

### Requirement: Bootstrap local do mirror whatsapp_messages

O sistema SHALL prover um bootstrap local-only que cria a tabela
`whatsapp_messages` com todas as colunas do schema de referência e um índice
único em `message_id`, sem jamais adicionar essa tabela às migrations canônicas.
A operação MUST ser idempotente.

#### Scenario: Primeira execução cria a tabela e o índice

- **WHEN** o bootstrap `create-local-source` roda contra um banco local sem a tabela
- **THEN** `whatsapp_messages` é criada com as 24 colunas de referência e o índice único `whatsapp_messages_message_id_uniq` sobre `(message_id)`

#### Scenario: Reexecução é idempotente

- **WHEN** o bootstrap roda uma segunda vez com a tabela já existente
- **THEN** nenhum erro ocorre e a estrutura permanece inalterada (uso de `create table if not exists` / `create unique index if not exists`)

#### Scenario: Tabela-fonte nunca entra nas migrations canônicas

- **WHEN** as migrations canônicas de `lib/db/migrations/*` são aplicadas
- **THEN** nenhuma delas cria, altera ou referencia `whatsapp_messages` (o contrato read-only do upstream é preservado)

### Requirement: Isolamento do provedor uazapi

O sistema SHALL confinar todo acoplamento com o formato de wire do uazapi a um
adapter (`client`), expondo ao restante do código apenas tipos normalizados
próprios (`UazMessage`, `UazChat`). O transporte MUST autenticar por header
`token`, paginar `/chat/find` e `/message/find`, e aplicar retry em respostas
429 e 5xx.

#### Scenario: Normalização traduz o JSON bruto em tipos próprios

- **WHEN** o client recebe um objeto bruto de mensagem do uazapi
- **THEN** ele retorna um `UazMessage` com `messageId`, `chatId`, `fromMe`, `text`, `mediaUrl`, `timestampMs` e `raw` preenchidos a partir dos campos do provedor

#### Scenario: Paginação segue enquanto houver mais páginas

- **WHEN** `listMessages` recebe uma página com `hasMore: true`
- **THEN** o client requisita a próxima página usando `nextOffset` e para quando `hasMore` for falso ou a página vier vazia

#### Scenario: Retry em erro transitório

- **WHEN** uma chamada retorna status 429 ou >= 500 e ainda há tentativas
- **THEN** o client aguarda com backoff e repete, falhando apenas após esgotar as tentativas

### Requirement: Extração de telefone a partir do JID

O sistema SHALL derivar telefone somente de JIDs `@s.whatsapp.net`, removendo
sufixo de dispositivo (`:NN`) antes de extrair os dígitos. JIDs de grupo
(`@g.us`) e de linked-id (`@lid`) MUST NOT ser tratados como telefone.

#### Scenario: JID de usuário vira telefone

- **WHEN** o JID é `5511999999999:17@s.whatsapp.net`
- **THEN** o telefone normalizado é `5511999999999`

#### Scenario: Sender @lid não é telefone

- **WHEN** o `sender` é `111111111111111@lid` (remetente de grupo)
- **THEN** o telefone normalizado é nulo

### Requirement: Mapeamento para o shape de whatsapp_messages

O sistema SHALL mapear cada `UazMessage` para uma linha de `whatsapp_messages`,
distinguindo chat privado de grupo, direção inbound/outbound, e preservando
mídia, reply e reação. Mensagens sem `message_id` MUST ser descartadas.

#### Scenario: DM inbound usa chat_id igual ao telefone do parceiro

- **WHEN** a mensagem vem de um chat `@s.whatsapp.net` com `fromMe: false`
- **THEN** a linha tem `chat_type = "private"`, `chat_id` igual ao telefone do parceiro e `direction = "inbound"`

#### Scenario: Mensagem enviada é outbound

- **WHEN** a mensagem tem `fromMe: true`
- **THEN** a linha tem `direction = "outbound"`

#### Scenario: Grupo usa chat_type group e id do grupo

- **WHEN** o `chatId` termina em `@g.us`
- **THEN** a linha tem `chat_type = "group"` e `chat_id` igual ao id local do grupo

#### Scenario: Mídia preenche url, mime e raw_type

- **WHEN** a mensagem carrega mídia (`mediaUrl`/`mediaMimeType`)
- **THEN** `media_url` e `media_mime_type` são preenchidos e `metadata.raw_type` guarda o tipo original (usado pela tela Mídia)

#### Scenario: Reply e reação são preservados

- **WHEN** a mensagem tem `replyToMessageId`, `reaction` ou `reactedToMessageId`
- **THEN** os campos correspondentes da linha são preenchidos

#### Scenario: Mensagem sem message_id é descartada

- **WHEN** a mensagem normalizada tem `messageId` vazio
- **THEN** o mapper retorna nulo e a linha não é inserida

### Requirement: Upsert idempotente por message_id

O sistema SHALL inserir as linhas em lote com `on conflict (message_id) do
nothing`, de modo que reexecutar a importação traga apenas mensagens ainda não
presentes.

#### Scenario: Inserção em lote parametrizada

- **WHEN** o import monta um insert para N linhas
- **THEN** o SQL usa placeholders parametrizados e termina com `on conflict (message_id) do nothing`

#### Scenario: Reimportação não duplica

- **WHEN** a importação roda de novo sobre mensagens já presentes
- **THEN** nenhuma linha duplicada é criada (dedup por `message_id`)

### Requirement: Resiliência por chat

O sistema SHALL isolar falhas no nível do chat: um chat cuja listagem de
mensagens lança erro MUST ser registrado em log e pulado, sem abortar os demais.

#### Scenario: Chat que falha não aborta a importação

- **WHEN** `listMessages` lança erro para um chat
- **THEN** o erro é logado, esse chat é pulado e os chats seguintes continuam sendo importados

### Requirement: Importação parametrizável e incremental

O sistema SHALL aceitar limites opcionais para pilotagem barata: número máximo de
chats (`IMPORT_CHAT_LIMIT`), número máximo de mensagens por chat
(`IMPORT_MSG_LIMIT`) e data mínima ISO (`IMPORT_SINCE`). Sem limites, a
importação MUST percorrer todo o histórico disponível.

#### Scenario: Piloto limita chats e mensagens

- **WHEN** `IMPORT_CHAT_LIMIT` e `IMPORT_MSG_LIMIT` estão definidos
- **THEN** a importação percorre no máximo esse número de chats e, por chat, no máximo esse número de mensagens

#### Scenario: Corte por data mínima

- **WHEN** `IMPORT_SINCE` está definido e uma mensagem é mais antiga que o limite
- **THEN** a paginação daquele chat para ao alcançar mensagens anteriores à data
