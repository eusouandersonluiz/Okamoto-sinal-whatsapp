## 1. Client + script

- [ ] 1.1 `client.requestHistorySync(chatId, messageid, count)` → POST /message/history-sync
- [ ] 1.2 `scripts/src/sync-history.ts`: recuo iterativo por grupo (âncora do DB, poll async, maxRounds, SYNC_CHAT_LIMIT) + registro em package.json
- [ ] 1.3 typecheck + bun test verdes

## 2. Executar

- [ ] 2.1 Piloto: sync-history em 1 grupo; medir se o oldest recua
- [ ] 2.2 Amplo (todos os grupos com msgs) conforme o WhatsApp devolver
- [ ] 2.3 `import-uazapi` reimporta; `verify-import` mostra o ganho (janela > 7d)
