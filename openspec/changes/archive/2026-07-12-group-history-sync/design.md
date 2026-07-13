## Context

`POST /message/history-sync` (confirmado na openapi do uazapi) solicita ao WhatsApp
histórico antigo de um chat, para trás a partir de `messageid` (âncora), `count`
por chamada. Entrega é **assíncrona** (o WhatsApp empurra; as mensagens aparecem
depois no `/message/find`). Base: whatsmeow `BuildHistorySyncRequest`.

## Goals / Non-Goals

**Goals:** puxar mensagens anteriores à janela do pareamento, recuando por grupo
até esgotar; reimportar; medir o ganho.
**Non-Goals:** garantir a 1ª mensagem absoluta (o WhatsApp limita o que devolve);
recuperar grupos que o WhatsApp não backfilla.

## Decisions

**1. Recuo iterativo por grupo.** Para cada grupo com mensagens: âncora = msg mais
antiga conhecida; `history-sync(anchor, count)`; espera (poll) o oldest recuar;
nova âncora; repete até o oldest parar de recuar (`maxRounds` de teto). Grupos sem
mensagem não têm âncora → pulados (o WhatsApp não backfilla sem referência).

**2. Assíncrono com espera limitada.** Após cada disparo, poll do oldest por até
`SYNC_WAIT_MS`; se não recuou, considera esgotado para aquele grupo.

**3. Reimport separado.** `sync-history` só popula o store do uazapi; `import-uazapi`
(idempotente) persiste no DB. Mantém responsabilidades isoladas.

## Risks / Trade-offs

- **Pode não devolver nada** (WhatsApp não retém / device recente) → o script
  detecta "não recuou" e para; sem dano. É o teto da plataforma.
- **Duração** → 118 grupos × rodadas × espera async; `SYNC_CHAT_LIMIT`/`maxRounds`
  para pilotar; resiliência por grupo.

## Migration Plan

1. `requestHistorySync` no client. 2. `sync-history.ts` (recuo iterativo). 3. Rodar
piloto (1 grupo) e medir recuo. 4. Rodar amplo. 5. `import-uazapi` + `verify-import`.
