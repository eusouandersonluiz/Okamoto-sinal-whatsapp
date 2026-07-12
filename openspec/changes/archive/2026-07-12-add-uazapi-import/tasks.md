<!-- Captura retroativa: a capability já foi implementada e commitada na branch
     feat/uazapi-import. Tarefas marcadas como concluídas com o commit de origem. -->

## 1. Bootstrap do mirror local

- [x] 1.1 Criar `scripts/src/create-local-source.ts` (tabela + índice único, local-only) — commit 3c7c4fe
- [x] 1.2 Registrar script `create-local-source` em `scripts/package.json` — commit 3c7c4fe
- [x] 1.3 Verificar idempotência e as 24 colunas contra Supabase local

## 2. Tipos + mapper puro

- [x] 2.1 Definir `UazMessage`/`UazChat` em `scripts/src/uazapi/types.ts` — commit 41461d6
- [x] 2.2 Escrever testes do mapper (`mapper.test.ts`) antes da implementação (TDD) — commit 41461d6
- [x] 2.3 Implementar `mapMessage` + `WHATSAPP_COLUMNS` em `mapper.ts` — commit 41461d6
- [x] 2.4 Configurar vitest no pacote scripts (`vitest.config.ts`) — commit 41461d6

## 3. Client uazapi (transporte + normalização)

- [x] 3.1 Salvar fixtures sintéticas (`fixtures/message.json`, `chat.json`) sem PII real — commit d8141ce
- [x] 3.2 Escrever testes de normalização/paginação (`client.test.ts`) — commit d8141ce
- [x] 3.3 Implementar `normalizeMessage`/`normalizeChat` + `UazapiClient` (auth, paginação, retry) — commit d8141ce
- [x] 3.4 Cobrir extração de telefone do jid e scrub de número real — commit 102aefa
- [x] 3.5 Hardening: paginação resiliente + retry de rede — commit 5c0c883
- [x] 3.6 Fix: `media_url` cai para `content.URL` quando `fileURL` vazio (mídia histórica) — commit e53c4ed

## 4. Orquestrador import-uazapi

- [x] 4.1 Escrever testes de `buildInsert` e `runImport` (deps injetadas) — commit ceacc2c
- [x] 4.2 Implementar `buildInsert` (upsert `on conflict message_id do nothing`) e `runImport` (resiliência por chat) — commit ceacc2c
- [x] 4.3 Registrar script `import-uazapi` em `scripts/package.json` — commit ceacc2c
- [x] 4.4 Fix: separar erro de fetch/insert e contar linhas realmente inseridas — commit db78d49

## 5. Env + documentação local

- [x] 5.1 Adicionar variáveis `UAZAPI_*` e limites ao `.env.example` — commit e85738d
- [x] 5.2 Escrever `docs/INSTALACAO-LOCAL-UAZAPI.md` (guia ponta a ponta) — commit e85738d

## 6. Verificação final (pendente)

- [x] 6.1 Fluxo manual contra dados reais rodado (Supabase local): `create-local-source` → `migrate` → `import-uazapi` piloto → `whatsapp_messages` = 3224 linhas (chat_type=group); import idempotente (0 novas na reexecução)
- [ ] 6.2 Rodar `refresh-all` (amostra) e confirmar dados em Visão Geral, Privado, Grupos e Mídia — PENDENTE (custo OpenAI, adiado)
- [x] 6.3 Landmine `*-darwin-arm64` resolvido pela migração para Bun (deps e overrides de plataforma eliminados; `bun install` resolve binários por plataforma). Ver change arquivada `migrate-to-bun-and-rebrand`
