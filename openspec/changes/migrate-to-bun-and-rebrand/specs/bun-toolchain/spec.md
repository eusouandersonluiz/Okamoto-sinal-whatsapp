## ADDED Requirements

### Requirement: Bun como gerenciador de pacotes e workspaces

O repositório SHALL usar Bun para instalar dependências e resolver os workspaces,
sem pnpm. O `package.json` raiz MUST declarar `workspaces` cobrindo `artifacts/*`,
`lib/*`, `lib/integrations/*` e `scripts`. Arquivos e config exclusivos do pnpm
(`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, `preinstall` que exige pnpm)
MUST ser removidos.

#### Scenario: Install limpo com Bun

- **WHEN** `bun install` roda em um checkout limpo
- **THEN** todas as dependências e workspaces são resolvidos, gerando `bun.lock`, sem invocar pnpm

#### Scenario: Filtro por pacote funciona

- **WHEN** um comando roda com `bun --filter <pacote>`
- **THEN** apenas o pacote-alvo do workspace executa

#### Scenario: Sem overrides de plataforma

- **WHEN** o install ocorre em qualquer arquitetura suportada (ex.: darwin-arm64, linux-x64)
- **THEN** os binários nativos corretos são resolvidos automaticamente, sem overrides manuais de plataforma

### Requirement: Bun como runtime de scripts e API

O sistema SHALL executar os scripts de dados/IA e o servidor de API sob `bun`, sem
`tsx` nem Node como runtime. Todo script em `scripts/package.json` MUST invocar
`bun ./src/<nome>.ts`.

#### Scenario: Script roda sob bun

- **WHEN** `bun run <script>` é executado (ex.: `migrate`, `import-uazapi`)
- **THEN** o arquivo `.ts` roda diretamente sob bun, sem transpilação por tsx

#### Scenario: Camada de dados segue funcionando

- **WHEN** um script que usa `pg`/Drizzle roda sob bun (ex.: `migrate`, `db-stats`)
- **THEN** a conexão com o Postgres e as queries executam sem erro

### Requirement: Testes sob bun test

O sistema SHALL rodar sua suíte de testes com `bun test`, sem vitest. Os arquivos
`vitest.config.ts` MUST ser removidos e as APIs de mock específicas do vitest
(`vi.*`) MUST ser substituídas por injeção de dependência ou pela API de mock do
Bun.

#### Scenario: Suíte passa sob bun test

- **WHEN** `bun test` roda no pacote de scripts e na api-server
- **THEN** todos os testes passam sem dependência do vitest

#### Scenario: Teste de rede sem stub global frágil

- **WHEN** um teste exercita o client HTTP (uazapi)
- **THEN** o `fetch` é injetado/mockado de forma determinística, sem depender de `vi.stubGlobal`
