# container-deploy

## Purpose

A aplicação builda e roda em contêiner (Docker) para deploy em VPS, sem nenhuma
dependência ou artefato do Replit.

## Requirements

### Requirement: Ausência total de Replit

O repositório SHALL não conter nenhum artefato, dependência ou referência ao
Replit. Isso MUST incluir a remoção de `.replit`, `.replitignore`, `replit.nix`,
`replit.md`, `scripts/post-merge.sh`, das dependências `@replit/vite-plugin-*` e
`stripe-replit-sync`, e de menções a Replit em código, docs e slides.

#### Scenario: Nenhum arquivo Replit no repo

- **WHEN** o repositório é inspecionado
- **THEN** não existem `.replit`, `.replitignore`, `replit.nix` nem `replit.md`

#### Scenario: Nenhuma dependência Replit

- **WHEN** os `package.json` são inspecionados
- **THEN** nenhum pacote `@replit/*` nem `stripe-replit-sync` aparece

#### Scenario: Vite configs sem plugins Replit

- **WHEN** os `vite.config.ts` dos apps front são carregados
- **THEN** eles não importam nem usam `@replit/vite-plugin-cartographer`, `-dev-banner` ou `-runtime-error-modal`

#### Scenario: Sem menção residual a Replit

- **WHEN** o código-fonte, docs e slides ativos são varridos por "Replit"
- **THEN** não há ocorrências (exceto histórico git e arquivados)

### Requirement: Build e execução em contêiner

O sistema SHALL buildar e rodar em um contêiner Docker adequado a deploy em VPS,
usando Bun. MUST existir um `Dockerfile` multi-stage que builda o front (Vite) e
serve a API + assets estáticos, e um `docker-compose.yml` para execução local/VPS.

#### Scenario: Imagem builda

- **WHEN** `docker build` roda sobre o `Dockerfile`
- **THEN** a imagem é construída com `bun install` e `vite build` concluídos, sem erro

#### Scenario: Contêiner serve a aplicação

- **WHEN** o contêiner sobe via `docker compose up` com as variáveis de ambiente necessárias
- **THEN** a API responde e os assets do front são servidos na porta publicada

#### Scenario: Sem deploy autoscale do Replit

- **WHEN** a configuração de deploy é inspecionada
- **THEN** o alvo é o contêiner Docker/VPS, sem qualquer `deploymentTarget` do Replit
