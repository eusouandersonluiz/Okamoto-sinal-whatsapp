## Context

Monorepo com 11 pacotes (`@workspace/*`): libs (`db`, `ai`, `api-*`), apps
(`api-server` Express, `sinal-web` React/Vite, `sinal-deck`, `mockup-sandbox`) e
`scripts` (jobs `tsx`). Hoje: pnpm workspaces + catalog + overrides de plataforma,
Node 24 + tsx, vitest, e deploy Replit (`.replit` autoscale). Marca "Sinal".

A migração é de **infra/tooling/marca**, não de comportamento de produto: o Sinal
continua lendo `whatsapp_messages` e enriquecendo com IA. O objetivo é trocar a
fundação (Bun, Docker, Radar Stark) sem regressão funcional.

## Goals / Non-Goals

**Goals:**

- `bun install` reproduz o ambiente (sem pnpm), com workspaces e `--filter`.
- Scripts e API rodam sob `bun`; testes sob `bun test`.
- Zero referência a Replit (arquivos, deps, docs, código, slides).
- App builda e roda em contêiner Docker, pronto pra VPS.
- Produto renomeado para "Radar Stark" (apps + strings), sem quebrar imports.
- Landmine `*-darwin-arm64` eliminado (sem overrides de plataforma).

**Non-Goals:**

- Reescrever a camada de dados: `pg` + Drizzle permanecem (não trocar por
  `Bun.sql`).
- Trocar o Vite pelo bundler do Bun no front (fica pra depois, se algum dia).
- Renomear o scope interno `@workspace/*` (privado; renomear seria churn sem
  ganho).
- Provisionar o VPS/CD (este change entrega o contêiner; o pipeline de deploy é
  outro trabalho).

## Decisions

**1. Bun como gerenciador + runtime + test, Vite mantido no front.**
Bun roda `.ts` nativamente (aposenta `tsx`), instala rápido e resolve binários
nativos por plataforma sem overrides. O front React+Tailwind v4 continua no Vite
porque o bundler do Bun não é drop-in para esse stack. Alternativa (Bun tudo) —
rejeitada por risco alto e ganho marginal agora.

**2. `catalog` do pnpm inlinado.** Bun não tem catalog. As versões
centralizadas em `pnpm-workspace.yaml:catalog` (react, vite, tailwind, drizzle,
etc.) passam a valores explícitos em cada `package.json` consumidor. Trade-off:
perde a centralização; mitiga-se documentando as versões-chave no CONTRIBUTING.

**3. `bun test` no lugar do vitest.** Os testes usam `describe/it/expect` (compatível)
mas também `vi.fn`/`vi.stubGlobal(fetch)` (`client.test.ts`). Reescrever para a API
do Bun (`mock`, `spyOn`, ou injeção de `fetch` via parâmetro). Os `vitest.config.ts`
(scripts, api-server) são removidos. Alternativa (manter vitest sob bun) —
rejeitada: meio-caminho, mantém a dep que queremos remover.

**4. Dockerfile multi-stage, um contêiner.** Stage build: `bun install
--frozen-lockfile` + `vite build` dos apps front → `dist`. Stage runtime: imagem
`oven/bun` slim, copia `dist` + código da API, `bun` serve a API Express que
publica os assets estáticos. Um processo, uma porta. Alternativa (nginx separado
p/ estáticos) — rejeitada por complexidade; pode virar follow-up se o tráfego
pedir. `docker-compose.yml` dá paridade local (app + variáveis; Supabase segue
externo/local conforme `.env`).

**5. Rename por fases mecânicas.** (a) `git mv` dos diretórios de app; (b) trocar
`name` e refs de workspace; (c) substituir a string de produto "Sinal" → "Radar
Stark" em docs/UI/slides. Import paths não mudam (scope `@workspace/*` fica). Fazer
por fase reduz risco de quebrar build no meio.

**6. Remoção do Replit inclui o slide.** `sinal-deck` tem slides `Replit.tsx` e
`OpenSource.tsx` que citam Replit e o `slides-manifest.json`. Remover o slide
Replit e ajustar o manifesto + a narrativa "open source" para refletir a nova
origem (Stark), sem quebrar a navegação do deck.

## Risks / Trade-offs

- **`pg`/Drizzle sob Bun** → Bun tem compat Node ampla; `pg` costuma funcionar, mas
  precisa smoke-test real (`bun run migrate`, `bun run db-stats`) antes de confiar.
  Mitigação: validar cedo, na Fase 1.
- **`bun test` + `vi.stubGlobal(fetch)`** → a semântica de mock muda; risco de teste
  passar/falhar diferente. Mitigação: preferir injeção de `fetch` (o `UazapiClient`
  já isola `fetch`) a stub global.
- **Build Vite no contêiner (Tailwind v4/lightningcss/oxide)** → precisa dos binários
  nativos linux-x64 na imagem; com `bun install` (sem overrides) eles vêm
  automaticamente. Mitigação: build roda dentro do Docker no CI/VPS-alvo.
- **Deploy autoscale → contêiner único** → perde autoscale gerenciado do Replit;
  aceitável no VPS. Mitigação: dimensionar o VPS; escala horizontal é follow-up.
- **Rename incompleto** → strings "Sinal" esquecidas. Mitigação: `grep` final por
  `Sinal|sinal` como critério de aceite (ignorando histórico/arquivados).

## Migration Plan

Fases, cada uma com o repo verde ao fim:
1. **Bun toolchain** — workspaces + inline catalog, scripts `bun`, remove
   pnpm/.npmrc/preinstall; `bun install`, `bun test`, smoke `bun run migrate`.
2. **Remover Replit** — apaga arquivos + deps + refs; ajusta os 3 `vite.config.ts`
   e os slides; docs limpas de Replit.
3. **Docker/VPS** — `Dockerfile` + `docker-compose.yml`; `docker build` + subir
   local e conferir API+web.
4. **Rebrand** — `git mv` dos apps, renomeia pacotes/refs, troca strings; `grep`
   final zero para "Sinal".

Rollback: a branch é isolada (`feat/...`); reverter é descartar a branch. Nada em
produção muda até o merge + deploy no VPS.

## Open Questions

- Confirmar scope: manter `@workspace/*` ou adotar `@radar/*`? (Assumido: manter.)
- O deck (`radar-deck`) deve continuar existindo ou é material legado do Replit?
- `stripe-replit-sync` era usado de fato? Confirmar que remover não quebra
  cobrança (aparenta ser só integração Replit).
- Versão mínima do Bun a fixar em `engines`/`Dockerfile`.
