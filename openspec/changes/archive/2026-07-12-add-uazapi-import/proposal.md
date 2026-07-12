## Why

O Sinal lê uma tabela read-only `whatsapp_messages` que, no deploy em nuvem, é
preenchida por um pipeline externo. Para rodar o Sinal localmente (Supabase em
Docker) não existe esse pipeline: a tabela nasce vazia e não há como carregar o
histórico real do WhatsApp. Este change captura a capability que preenche esse
mirror local puxando o histórico de uma instância uazapi, de forma idempotente e
reexecutável, sem violar o contrato read-only do upstream.

> Nota: a capability já foi implementada e commitada nesta branch
> (`feat/uazapi-import`). Este proposal documenta retroativamente o comportamento
> como spec OpenSpec para servir de fonte de verdade.

## What Changes

- Novo bootstrap local `create-local-source` que cria a tabela `whatsapp_messages`
  e um índice único em `message_id`, **fora** das migrations canônicas (que nunca
  tocam a tabela-fonte).
- Novo adapter uazapi isolado (`client`) que autentica por header `token`, pagina
  `/chat/find` e `/message/find`, aplica retry em 429/5xx e normaliza o JSON bruto
  do provedor em tipos próprios (`UazMessage`, `UazChat`).
- Novo mapper puro que traduz `UazMessage` → linha de `whatsapp_messages`
  (privado vs grupo, inbound vs outbound, mídia, reply, reação).
- Novo orquestrador `import-uazapi` que percorre chats e mensagens, faz upsert em
  lote com `on conflict (message_id) do nothing` e isola falha por chat (um chat
  que quebra não aborta os demais).
- Importação incremental por reexecução: mensagens já presentes são ignoradas via
  dedup por `message_id`.

## Capabilities

### New Capabilities
- `uazapi-import`: importação sob demanda do histórico de WhatsApp de uma
  instância uazapi para o mirror local `whatsapp_messages`, com normalização
  isolada do provedor, upsert idempotente e resiliência por chat.

### Modified Capabilities
<!-- Nenhuma. A capability não altera requisitos de specs existentes; o Sinal
     continua lendo whatsapp_messages sem mudança de contrato. -->

## Impact

- **Código:** `scripts/src/create-local-source.ts`, `scripts/src/uazapi/*`
  (`types.ts`, `mapper.ts`, `client.ts`, fixtures), `scripts/src/import-uazapi.ts`
  e testes vitest correspondentes; scripts registrados em `scripts/package.json`.
- **Dados:** cria/preenche `whatsapp_messages` apenas no ambiente local. A
  tabela-fonte em nuvem permanece read-only e intocada.
- **Config:** novas variáveis `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`, e ajustes opcionais
  `IMPORT_CHAT_LIMIT`, `IMPORT_MSG_LIMIT`, `IMPORT_SINCE`.
- **Docs:** `docs/INSTALACAO-LOCAL-UAZAPI.md`.
- **Restrição dura:** `whatsapp_messages` NUNCA entra em `lib/db/migrations/*`.
