## ADDED Requirements

### Requirement: Produto se apresenta como Radar Stark

O sistema SHALL usar o nome "Radar Stark" como marca do produto em documentação e
interface, substituindo "Sinal". As strings de produto voltadas ao usuário MUST
refletir o novo nome em README, docs, títulos de página, UI e slides do deck.

#### Scenario: Documentação renomeada

- **WHEN** README e docs são lidos
- **THEN** o produto é chamado "Radar Stark", sem "Sinal" como nome de produto

#### Scenario: UI renomeada

- **WHEN** o app web é aberto
- **THEN** título, cabeçalhos e textos de marca exibem "Radar Stark"

### Requirement: Pacotes de app renomeados sem quebrar o build

O sistema SHALL renomear os apps `sinal-web` → `radar-web` e `sinal-deck` →
`radar-deck` (diretório e nome de pacote), mantendo o build e as referências de
workspace íntegros. O scope interno `@workspace/*` MAY permanecer inalterado.

#### Scenario: Diretórios e pacotes renomeados

- **WHEN** o workspace é inspecionado
- **THEN** existem `artifacts/radar-web` e `artifacts/radar-deck` com `name` atualizado, e não existem mais `sinal-web`/`sinal-deck`

#### Scenario: Build íntegro após rename

- **WHEN** `bun install` e o build/typecheck rodam após o rename
- **THEN** todos os pacotes resolvem e o build conclui sem referência quebrada aos nomes antigos
