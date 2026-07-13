## 1. Progresso + resumo

- [ ] 1.1 `client.ts`: `countGroups()` (POST /chat/find limit:1 wa_isGroup:true → `pagination.totalRecords`)
- [ ] 1.2 `import-uazapi`: `runImport` recebe `groupsTotal` e loga `grupo i/total` + mensagens por grupo
- [ ] 1.3 `runImport` retorna `emptyGroups`; `main` imprime resumo final (grupos/total, mensagens, grupos sem msg)
- [ ] 1.4 Teste do resumo/contadores sob `bun test`

## 2. Resumibilidade

- [ ] 2.1 `import-uazapi`: dep `isGroupDone?(chatId)`; com `IMPORT_RESUME=1`, pular grupo já importado (participant_count + mensagens no DB)
- [ ] 2.2 `main`: wiring de `isGroupDone` (query rápida no DB) sob `IMPORT_RESUME`
- [ ] 2.3 Teste: resume pula grupos feitos; sem resume percorre todos

## 3. Verificação

- [ ] 3.1 `scripts/src/verify-import.ts`: relatório (grupos DB vs totalRecords, grupos com 0 msgs, sem participant_count, totais) + registro em `package.json`
- [ ] 3.2 `verify-import` roda read-only e imprime as lacunas

## 4. Executar o import completo

- [ ] 4.1 Piloto com progresso (ex.: `IMPORT_CHAT_LIMIT=10`) — confirmar `i/total` e resumo
- [ ] 4.2 Full: `import-uazapi` sem limites (todos os grupos + mensagens + participantes) contra Supabase local
- [ ] 4.3 `verify-import`: grupos no DB ≈ 349; poucos/zero grupos vazios; participantes populados

## 5. Verificação de código

- [ ] 5.1 typecheck verde em todos os pacotes; `bun test` verde
- [ ] 5.2 `docker build` ok
