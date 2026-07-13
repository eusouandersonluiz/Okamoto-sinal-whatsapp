## 1. Progresso + resumo

- [x] 1.1 `client.ts`: `countGroups()` (POST /chat/find limit:1 wa_isGroup:true → `pagination.totalRecords`)
- [x] 1.2 `import-uazapi`: `runImport` recebe `groupsTotal` e loga `grupo i/total` + mensagens por grupo
- [x] 1.3 `runImport` retorna `emptyGroups`; `main` imprime resumo final (grupos/total, mensagens, grupos sem msg)
- [x] 1.4 Teste do resumo/contadores sob `bun test`

## 2. Resumibilidade

- [x] 2.1 `import-uazapi`: dep `isGroupDone?(chatId)`; com `IMPORT_RESUME=1`, pular grupo já importado (participant_count + mensagens no DB)
- [x] 2.2 `main`: wiring de `isGroupDone` (query rápida no DB) sob `IMPORT_RESUME`
- [x] 2.3 Teste: resume pula grupos feitos; sem resume percorre todos

## 3. Verificação

- [x] 3.1 `scripts/src/verify-import.ts`: relatório (grupos DB vs totalRecords, grupos com 0 msgs, sem participant_count, totais) + registro em `package.json`
- [x] 3.2 `verify-import` roda read-only e imprime as lacunas

## 4. Executar o import completo

- [x] 4.1 Piloto com progresso (ex.: `IMPORT_CHAT_LIMIT=10`) — confirmar `i/total` e resumo
- [x] 4.2 Full: `import-uazapi` sem limites (todos os grupos + mensagens + participantes) contra Supabase local
- [x] 4.3 `verify-import`: grupos no DB ≈ 349; poucos/zero grupos vazios; participantes populados

## 5. Verificação de código

- [x] 5.1 typecheck verde em todos os pacotes; `bun test` verde
- [x] 5.2 `docker build` — N/A (mudança só em scripts; imagem = api+web, inalterada). typecheck verde é o gate
