## Why

O repo nasceu no Replit com pnpm/Node e a marca "Sinal". A operação agora é
própria (deploy em Docker/VPS) e a marca passa a ser **Radar Stark**. Manter
amarras do Replit, o gerenciador pnpm com overrides frágeis por plataforma (que
já geraram o landmine `*-darwin-arm64`) e o nome antigo custa manutenção e
confunde novos contribuidores. Este change migra a toolchain para **Bun**, remove
todo vestígio de Replit, define o deploy em contêiner e renomeia o sistema.

## What Changes

- **Toolchain → Bun** (mantendo Vite no front):
  - Gerenciador de pacotes: pnpm → `bun install`; workspaces do pnpm → workspaces
    do Bun (`workspaces` no `package.json` raiz). O `catalog` do pnpm é inlinado
    (Bun não tem catalog).
  - Runtime dos scripts: `tsx ./src/*.ts` → `bun ./src/*.ts`; API Express roda sob
    `bun` em vez de Node.
  - Test runner: vitest → `bun test` (reescrita das APIs de mock `vi.*`).
  - `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc` e o `preinstall` que exige
    pnpm são removidos/substituídos. Os `overrides` de plataforma somem — o Bun
    resolve os binários nativos por plataforma automaticamente.
- **Remoção total do Replit** — **BREAKING** (muda como se roda/deploya):
  - Apaga `.replit`, `.replitignore`, `replit.nix`, `replit.md`, `scripts/post-merge.sh`.
  - Remove deps `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`,
    `@replit/vite-plugin-runtime-error-modal` e seu uso nos 3 `vite.config.ts`.
  - Remove `stripe-replit-sync` e refs a Replit em docs, `auth.ts` e nos slides
    (`Replit.tsx`, `OpenSource.tsx`, manifesto).
- **Deploy em Docker/VPS** — substitui o `deploymentTarget=autoscale` do Replit:
  - `Dockerfile` multi-stage (base `oven/bun`): build (bun install + `vite build`
    do front) → runtime (bun servindo a API + assets estáticos).
  - `docker-compose.yml` para paridade local e deploy no VPS.
- **Rebrand Sinal → Radar Stark**:
  - Apps `sinal-web` → `radar-web`, `sinal-deck` → `radar-deck` (diretório, nome de
    pacote, referências de workspace). Scope interno `@workspace/*` permanece
    (privado, não publicado — fora de escopo renomear).
  - Todas as strings de produto "Sinal" → "Radar Stark" (README, docs, títulos,
    UI, slides). ~38 arquivos.

## Capabilities

### New Capabilities
- `bun-toolchain`: o repositório usa Bun como gerenciador de pacotes, runtime e
  test runner, com workspaces Bun; sem pnpm/tsx/vitest e sem overrides de
  plataforma.
- `container-deploy`: a aplicação builda e roda em contêiner (Docker) para deploy
  em VPS, sem nenhuma dependência ou artefato do Replit.
- `radar-branding`: o produto se apresenta como "Radar Stark" em nome de app,
  documentação e UI.

### Modified Capabilities
<!-- Nenhuma capability comportamental existente muda. As specs existentes
     (uazapi-import) continuam válidas; muda só a forma de rodar (bun em vez de
     pnpm/tsx). Ver design.md para o impacto nos comandos documentados. -->

## Impact

- **Config raiz:** `package.json` (workspaces, scripts, sem preinstall pnpm),
  remoção de `pnpm-workspace.yaml`/`pnpm-lock.yaml`/`.npmrc`, novo `bunfig.toml`,
  novo `bun.lock`.
- **Pacotes:** os 11 `package.json` (scripts `tsx`→`bun`, `vitest`→`bun test`,
  versões inlinadas do catalog); os 3 `vite.config.ts` (remover plugins Replit);
  2 `vitest.config.ts` removidos.
- **Deploy:** novos `Dockerfile` e `docker-compose.yml`; remoção dos arquivos
  Replit.
- **Rename:** diretórios `artifacts/sinal-web`→`radar-web`,
  `artifacts/sinal-deck`→`radar-deck`; ~38 arquivos com a string "Sinal".
- **Docs:** `README.md`, `docs/INSTALACAO.md`, `docs/ARQUITETURA.md`,
  `docs/SUPABASE.md`, `docs/INSTALACAO-LOCAL-UAZAPI.md`, `CONTRIBUTING.md`.
- **Riscos a verificar:** `pg`+Drizzle sob Bun; `bun test` cobrindo os testes que
  usam `vi.stubGlobal(fetch)`; build do Vite (Tailwind v4 + lightningcss) dentro
  do contêiner.
- **Resolve** a pendência `6.3` da change `add-uazapi-import` (o landmine
  `*-darwin-arm64` deixa de existir sem os overrides do pnpm).
