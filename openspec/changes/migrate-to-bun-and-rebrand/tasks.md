## 1. Fase 1 — Toolchain Bun

- [x] 1.1 Adicionar `workspaces` (artifacts/*, lib/*, lib/integrations/*, scripts) ao `package.json` raiz
- [x] 1.2 Inlinar as versões do `catalog` do pnpm em cada `package.json` consumidor (Bun 1.2.10 não tem catalog; 1.2.14+ tem mas com bugs em monorepo)
- [x] 1.3 Trocar `tsx ./src/*.ts` → `bun ./src/*.ts` nos scripts de `scripts/package.json`
- [x] 1.4 Trocar os comandos `pnpm --filter`/`pnpm -r` por equivalentes `bun --filter` nos scripts raiz e de app
- [x] 1.5 Remover `preinstall` (guarda pnpm), `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc` (bunfig.toml não necessário)
- [x] 1.6 Rodar `bun install` e gerar `bun.lock`; confirmar resolução dos workspaces (clean install: 539 pacotes)
- [ ] 1.7 Smoke da camada de dados sob bun: `bun run migrate` e `bun run db-stats` contra Postgres local — PENDENTE (precisa DB vivo; import de pg/drizzle/@workspace/db sob bun já validado)
- [x] 1.8 Migrar testes para `bun test`: removidos `vitest.config.ts` (scripts, api-server) e dep `vitest`; `vi.fn`→`mock`, `vi.stubGlobal(fetch)`→swap+restore de `globalThis.fetch`; imports `vitest`→`bun:test` nos 15 arquivos; `@types/bun` + `types:["node","bun"]`
- [x] 1.9 `bun test` verde em scripts (20/20); api-server PENDENTE (testes de integração precisam de DB)

## 2. Fase 2 — Remover Replit

- [ ] 2.1 Apagar `.replit`, `.replitignore`, `replit.nix`, `replit.md`, `scripts/post-merge.sh`
- [ ] 2.2 Remover deps `@replit/vite-plugin-cartographer`, `-dev-banner`, `-runtime-error-modal` dos `package.json` e seu uso nos 3 `vite.config.ts`
- [ ] 2.3 Remover `stripe-replit-sync` e confirmar que nada de cobrança depende dele
- [ ] 2.4 Remover refs a Replit em `artifacts/api-server/src/lib/auth.ts` e demais códigos
- [ ] 2.5 Ajustar o deck: remover slide `Replit.tsx`, atualizar `OpenSource.tsx`/`Title.tsx`/`ComoFunciona.tsx` e `slides-manifest.json` sem quebrar a navegação
- [ ] 2.6 Limpar menções a Replit em `README.md`, `CONTRIBUTING.md` e `docs/*`
- [ ] 2.7 `grep -ri "replit"` (excl. node_modules, .git, openspec/changes/archive) retorna zero

## 3. Fase 3 — Docker/VPS

- [ ] 3.1 Escrever `Dockerfile` multi-stage: build (`bun install --frozen-lockfile` + `vite build` do front) → runtime (`oven/bun` slim servindo API + `dist`)
- [ ] 3.2 Definir a API Express para servir os assets estáticos do front buildado
- [ ] 3.3 Escrever `docker-compose.yml` (serviço app + variáveis de ambiente; Supabase externo/local via `.env`)
- [ ] 3.4 `docker build` conclui sem erro (inclui binários nativos linux-x64 do Vite/Tailwind)
- [ ] 3.5 `docker compose up` sobe o contêiner; API responde e front carrega na porta publicada
- [ ] 3.6 Fixar versão mínima do Bun no `Dockerfile`/`engines`

## 4. Fase 4 — Rebrand Radar Stark

- [ ] 4.1 `git mv artifacts/sinal-web artifacts/radar-web` e `artifacts/sinal-deck artifacts/radar-deck`
- [ ] 4.2 Atualizar `name` (`@workspace/radar-web`, `@workspace/radar-deck`) e todas as referências de workspace/scripts a esses pacotes
- [ ] 4.3 Substituir a string de produto "Sinal" → "Radar Stark" em UI, títulos e slides
- [ ] 4.4 Substituir "Sinal" → "Radar Stark" em README, docs e CONTRIBUTING
- [ ] 4.5 `bun install` + build/typecheck íntegros após o rename
- [ ] 4.6 `grep -r "Sinal\|sinal"` (excl. node_modules, .git, arquivados) sem ocorrência de nome de produto

## 5. Verificação final

- [ ] 5.1 `bun install` limpo do zero (apagar node_modules) resolve tudo
- [ ] 5.2 `bun test` verde em todo o workspace
- [ ] 5.3 Typecheck/build de todos os pacotes verde
- [ ] 5.4 `docker compose up` end-to-end: importar (piloto uazapi) → `refresh-all` amostra → abrir web e conferir dashboards
- [ ] 5.5 Fechar a pendência `6.3` da change `add-uazapi-import` (landmine resolvido)
- [ ] 5.6 Atualizar `docs/INSTALACAO*.md` com os comandos Bun/Docker
