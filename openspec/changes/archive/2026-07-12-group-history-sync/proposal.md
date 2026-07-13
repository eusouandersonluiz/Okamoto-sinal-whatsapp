## Why

A instância uazapi só tinha ~7 dias de mensagens (janela do pareamento), deixando
"todas as mensagens desde a primeira" inalcançável pelo `/message/find` sozinho.
Investigando a API real (openapi-bundled) descobri o endpoint
**`POST /message/history-sync`**: solicita ao WhatsApp um **sync sob demanda de
mensagens antigas** de um chat, para trás a partir de uma mensagem âncora. É o
mecanismo (whatsmeow `BuildHistorySyncRequest`) para puxar histórico além da
janela inicial. Este change integra isso: dispara history-sync recuando por grupo
até esgotar, depois reimporta.

## What Changes

- **Client uazapi** — `requestHistorySync(chatId, messageid, count)` →
  `POST /message/history-sync` (`{number, mode:"history", messageid, count}`).
- **Script `sync-history`** — para cada grupo, pega a mensagem mais antiga
  conhecida (âncora), dispara history-sync recuando (`count` por chamada), em
  rodadas: dispara → espera o push assíncrono do WhatsApp → detecta se a âncora
  ficou mais antiga → repete até não recuar mais (esgotou) ou atingir um teto de
  rodadas. Resiliente por grupo, rate-limit amigável.
- **Reimport** — após o sync, `import-uazapi` (já idempotente/resumível) traz as
  mensagens antigas que chegaram; `verify-import` reporta o ganho.

## Capabilities

### Modified Capabilities
- `uazapi-import`: passa a solicitar histórico sob demanda (`/message/history-sync`)
  para recuperar mensagens anteriores à janela do pareamento, aproximando "desde a
  primeira mensagem" do que o WhatsApp devolver.

## Impact

- **Scripts:** `sync-history.ts` (novo) + `requestHistorySync` no client + registro.
- **Rede/tempo:** history sync é **assíncrono** (o WhatsApp empurra depois) e
  **limitado pelo que os servidores do WhatsApp retêm** para este device — pode
  não chegar até a 1ª mensagem histórica de grupos antigos; o quanto vier é o
  máximo que a plataforma concede.
- **Dados:** só adiciona mensagens (dedup por `message_id`); nada é apagado.
