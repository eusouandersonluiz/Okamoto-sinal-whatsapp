## 1. Client + script

- [x] 1.1 `client.requestHistorySync(chatId, messageid, count)` → POST /message/history-sync
- [x] 1.2 `scripts/src/sync-history.ts`: recuo iterativo por grupo (âncora do DB, poll async, maxRounds, SYNC_CHAT_LIMIT) + registro em package.json
- [x] 1.3 typecheck + bun test verdes

## 2. Executar

- [x] 2.1 Piloto: sync-history em 1 grupo; medir se o oldest recua
- [x] 2.2 Executado (piloto + amplo): WhatsApp NÃO devolveu histórico anterior — 0 rodadas com ganho. Limite server-side (device pareado ~7d)
- [x] 2.3 Sem ganho a reimportar (WhatsApp não entregou); mecanismo pronto p/ quando a origem tiver mais (re-pair/async)
