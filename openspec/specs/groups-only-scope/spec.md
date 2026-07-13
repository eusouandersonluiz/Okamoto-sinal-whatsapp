# groups-only-scope

## Purpose

O produto apresenta apenas análise e gerenciamento de grupos; as capabilities
não-grupo são removidas e as superfícies de análise (dashboard, digests, pautas,
mídia) passam a ser escopadas por grupo.

## Requirements

### Requirement: Produto apresenta apenas grupos

O produto SHALL expor apenas superfícies de grupo. A navegação e as rotas de API
MUST cobrir somente análise e gerenciamento de grupos; páginas, rotas, jobs e
schemas das áreas não-grupo (Privado, Menções, Contatos, Salvos, Conectores/Google
sync) MUST ser removidos.

#### Scenario: Navegação só de grupos

- **WHEN** o app web é aberto
- **THEN** a navegação mostra apenas destinos de grupo (dashboard de grupos, grupos, pautas, mídia) — sem Privado, Menções, Contatos, Salvos ou Conectores

#### Scenario: Rotas não-grupo ausentes

- **WHEN** as rotas da API são inspecionadas
- **THEN** não existem `contacts`, `mentions`, `entities`, `saved`, `tasks` nem `google` (OAuth de Contatos)

#### Scenario: Build íntegro após remoção

- **WHEN** `bun install` e o typecheck/build rodam após remover as áreas não-grupo
- **THEN** nada referencia os módulos, rotas, jobs ou schemas removidos e tudo compila

### Requirement: Superfícies de análise escopadas por grupo

O sistema SHALL escopar as superfícies de análise a grupos: um dashboard de grupos
como landing, digests por grupo, pautas (topics que cruzam grupos) e mídia
filtrada a grupos.

#### Scenario: Dashboard de grupos é a landing

- **WHEN** o usuário entra no app
- **THEN** vê um painel com KPIs de grupos (grupos monitorados, mensagens no período, grupos em alta, pautas quentes)

#### Scenario: Mídia só de grupos

- **WHEN** a tela de Mídia é aberta
- **THEN** só lista mídia proveniente de mensagens de grupos

### Requirement: Pipeline sem jobs não-grupo

O pipeline de refresh SHALL rodar apenas os jobs relevantes a grupos. Os jobs de
contatos e de menções MUST ser removidos da orquestração sem quebrá-la.

#### Scenario: refresh-all não roda jobs removidos

- **WHEN** `refresh-all` executa
- **THEN** roda apenas classificação/enriquecimento, pautas e digests de grupo; não invoca `backfill-contacts` nem `build-mentions`
