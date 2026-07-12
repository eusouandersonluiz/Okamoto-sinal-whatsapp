## 1. Fase 1 — Toolchain Bun

- [x] 1.1 Adicionar `workspaces` (artifacts/*, lib/*, lib/integrations/*, scripts) ao `package.json` raiz
- [x] 1.2 Inlinar as versões do `catalog` do pnpm em cada `package.json` consumidor (Bun 1.2.10 não tem catalog; 1.2.14+ tem mas com bugs em monorepo)
- [x] 1.3 Trocar `tsx ./src/*.ts` → `bun ./src/*.ts` nos scripts de `scripts/package.json`
- [x] 1.4 Trocar os comandos `pnpm --filter`/`pnpm -r` por equivalentes `bun --filter` nos scripts raiz e de app
- [x] 1.5 Remover `preinstall` (guarda pnpm), `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc` (bunfig.toml não necessário)
- [x] 1.6 Rodar `bun install` e gerar `bun.lock`; confirmar resolução dos workspaces (clean install: 539 pacotes)
- [x] 1.7 Camada de dados sob bun validada contra Postgres local: `create-local-source`, `migrate` (todas as migrations aplicadas) e `import-uazapi` piloto rodam limpo; query em `profiles`/`whatsapp_messages` OK
- [x] 1.8 Migrar testes para `bun test`: removidos `vitest.config.ts` (scripts, api-server) e dep `vitest`; `vi.fn`→`mock`, `vi.stubGlobal(fetch)`→swap+restore de `globalThis.fetch`; imports `vitest`→`bun:test` nos 15 arquivos; `@types/bun` + `types:["node","bun"]`
- [x] 1.9 `bun test` verde em scripts (20/20); api-server PENDENTE (testes de integração precisam de DB)

## 2. Fase 2 — Remover Replit

- [x] 2.1 Apagar `.replit`, `.replitignore`, `replit.nix`, `replit.md`, `scripts/post-merge.sh`
- [x] 2.2 Remover deps `@replit/vite-plugin-*` (feito na Fase 1) e seu uso nos 3 `vite.config.ts`; ambos os apps front buildam sob bun+vite
- [x] 2.3 `stripe-replit-sync` não existia no código (só no `pnpm-workspace.yaml` já removido) — nada a fazer
- [x] 2.4 Substituir `REPLIT_DOMAINS`/`REPLIT_DEV_DOMAIN` em `google.ts` por `PUBLIC_APP_URL` (funcional); reescrever comentário Replit em `auth.ts` (comportamento do cookie mantido)
- [x] 2.5 Deck: removido slide `Replit.tsx`, entrada do manifesto removida + positions renumeradas, texto Replit tirado de `Title/ComoFunciona/OpenSource`, `index.html` (og/twitter replit.com) limpo
- [x] 2.6 Menções a Replit removidas em `README.md`, `CONTRIBUTING.md`, `docs/ARQUITETURA|INSTALACAO|SUPABASE`, `.env.example`, `.gitignore`
- [x] 2.7 `grep -ri "replit"` retorna zero em código/docs ativos (exceção documentada: `attached_assets/` = PRD histórico/arquivado)

## 3. Fase 3 — Docker/VPS

- [x] 3.1 `Dockerfile` multi-stage: build (`bun install --frozen-lockfile` + `vite build` + build da api) → runtime (`oven/bun:1.2.10-slim` servindo API + `dist`); `.dockerignore` impede levar node_modules/dist do host
- [x] 3.2 API Express serve os assets do front via `WEB_DIST` + fallback SPA (regex que exclui `/api/`, compatível com Express 5) em `app.ts`
- [x] 3.3 `docker-compose.yml` (serviço app + env + `env_file: .env`; Supabase externo)
- [x] 3.4 `docker build` conclui sem erro no alvo linux (bun install resolve binários linux-x64 do Vite/Tailwind automaticamente)
- [x] 3.5 `docker run` (env dummy): boot limpo sob bun, `GET /` → 200 servindo index buildado, `/api/health` → 401 (roteamento /api intacto). compose equivalente
- [x] 3.6 Bun fixado em `oven/bun:1.2.10` (build) e `1.2.10-slim` (runtime)

## 4. Fase 4 — Rebrand Radar Stark

- [x] 4.1 `git mv artifacts/sinal-web artifacts/radar-web` e `artifacts/sinal-deck artifacts/radar-deck`; removido cruft `.replit-artifact/` dos 4 apps
- [x] 4.2 `name` → `@workspace/radar-web`/`@workspace/radar-deck`; refs atualizadas no Dockerfile (filter + COPY) e docs
- [x] 4.3 "Sinal" → "Radar Stark" em UI, títulos, slides e URLs de marca (`sinal.app` → `radar.app`)
- [x] 4.4 "Sinal" → "Radar Stark" em README, docs e CONTRIBUTING; wordplay do README reescrito ("um radar que separa o sinal do ruído")
- [x] 4.5 `bun install` reconciliou; radar-web/radar-deck/api-server buildam; `bun test` 20/20
- [x] 4.6 `grep` de nome de produto ("Sinal", "sinal.app") = zero. Mantidos por decisão: identificadores internos (`sinal_session`, par `sinal-google`), conceito "sinal sobre/à ruído" e `project_id` do supabase local

## 5. Verificação final

- [x] 5.1 `bun install` limpo do zero (removido todo node_modules) resolve tudo (539 pacotes)
- [x] 5.2 `bun test` verde: scripts 20/20. api-server PENDENTE (testes de integração precisam de DB; imports migrados p/ `bun:test` incl. `src/test/fixtures.ts`, typecheck verde). Nota: o `vitest.config.ts` removido tinha `fileParallelism:false` (os suites criam fixtures nas MESMAS tabelas do mesmo Postgres → corrida de DDL se paralelos); `bun test` roda arquivos em série por padrão, mas confirmar quando houver DB. `deps.inline` do vitest não é necessário (bun resolve .ts/workspace nativo)
- [x] 5.3 Typecheck de todos os pacotes verde (libs + scripts + api-server + radar-web + radar-deck + mockup); builds dos 3 apps verdes (corrigido `src/test/fixtures.ts` que ainda importava vitest)
- [ ] 5.4 e2e com DADOS enriquecidos (refresh-all → dashboards populados) — PENDENTE (custo OpenAI; usuário adiou). JÁ VALIDADO contra Supabase local real: `create-local-source`+`migrate` sob bun; `import-uazapi` piloto sob bun (3 chats, dedup por message_id → 0 novas, idempotente); app de produção (build bun+esbuild) sobe no host, serve `<title>Radar Stark</title>`, `/login` 200 (fallback SPA), `/api/health` 401 (roteamento+auth), `profiles` consultável (DB conecta, admin existe), scheduler OFF (zero OpenAI). Falta só popular enrichment (pago) p/ dashboards com dados. Nota de rede: no contêiner, `127.0.0.1` não alcança o Postgres do host — usar `host.docker.internal` (mac) ou rede compartilhada no VPS.
- [x] 5.5 Landmine `6.3` de `add-uazapi-import` resolvido (deps `*-darwin-arm64` e overrides de plataforma eliminados)
- [x] 5.6 Docs migradas p/ Bun (comandos `bun run --filter`, pré-requisitos, stack) + seção Deploy (Docker) no README
