## Why

O Radar Stark começou como um cockpit de 6 áreas (Visão Geral, Privado, Grupos,
Menções, Contatos, Salvos). O uso real converge para **grupos**: é onde está o
sinal coletivo (pautas, digests, atividade). Manter as outras áreas dilui o
produto, aumenta a superfície de manutenção e a conta de IA. Este change refoca o
produto **inteiramente em grupos** — análise e gerenciamento — e garante que a
importação puxe **todos** os grupos.

## What Changes

- **Remoção das áreas não-grupo** — **BREAKING**:
  - Front: apaga as páginas `privado`, `contatos`, `mencoes`, `salvos`,
    `conectores` (e a `overview` mista, reescrita como painel de grupos).
  - API: remove rotas `contacts`, `mentions`, `entities`, `saved`, `tasks`,
    `google` (OAuth/sync de Contatos do Google).
  - Schema: remove `crm`, `mentions`, `saved`, `tasks`, `google` (oauth).
  - Jobs: remove `backfill-contacts`, `build-mentions`.
- **Produto refocado em grupos**:
  - **Dashboard de grupos** (novo landing, no lugar da Overview): KPIs de grupos,
    grupos em alta, atividade.
  - **Grupos**: análise por grupo (volume, digests) + gerenciamento (ver abaixo).
  - **Pautas** (topics cross-grupo) mantidas — são análise de grupo.
  - **Mídia** reescopada apenas para grupos.
- **Gerenciamento de grupos** (novo):
  - Marcar cada grupo como **monitorado** vs **ruído/ignorado** (evolui
    `support_groups`).
  - **Categoria/tags** + **apelido** (nome de exibição editável).
  - **Cadência de digest** por grupo (ligar/desligar + diário/semanal).
  - **Arquivar** grupos inativos (somem da lista sem apagar dados).
- **Importação de todos os grupos**:
  - Puxa o **roster completo** de grupos do uazapi (nome, nº de participantes),
    inclusive grupos sem mensagem recente.
  - Importa mensagens de **todos** os grupos (sem `IMPORT_CHAT_LIMIT`), filtrando
    para chats `@g.us`. DMs deixam de ser importadas.

## Capabilities

### New Capabilities
- `groups-only-scope`: o produto apresenta apenas análise e gerenciamento de
  grupos; as capabilities não-grupo são removidas e as superfícies de análise
  (dashboard, digests, pautas, mídia) passam a ser escopadas por grupo.
- `group-management`: gerenciar grupos — relevância (monitorado/ignorado),
  categoria/tags, apelido, cadência de digest e arquivamento.

### Modified Capabilities
- `uazapi-import`: passa a importar **todos** os grupos (roster de metadados +
  mensagens, sem limite de chats) e a restringir a importação a grupos (`@g.us`),
  deixando de trazer DMs.

## Impact

- **Front (`radar-web`):** remove 5 páginas + itens de nav; reescreve `overview`
  como painel de grupos; adiciona UI de gerenciamento na página de grupos.
- **API (`api-server`):** remove 6 grupos de rotas; adiciona endpoints de
  gerenciamento de grupos; rescopa `metrics`/`media` para grupos.
- **DB (`lib/db`):** remove 5 schemas; estende `groups` (relevância, categoria,
  tags, apelido, digest_enabled, digest_cadence, archived) — via nova migration
  (as canônicas existentes não são reescritas).
- **Scripts:** remove jobs de contatos/menções; ajusta `import-uazapi` (roster +
  todos os grupos); `refresh-all` deixa de rodar os jobs removidos.
- **Docs:** README/ARQUITETURA refletem o produto só-grupos.
- **Fora de escopo:** o histórico já importado (`whatsapp_messages`) não é apagado;
  DMs existentes permanecem na tabela-fonte, apenas deixam de ser analisadas.
