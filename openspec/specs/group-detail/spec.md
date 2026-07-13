# group-detail

## Purpose

Abrir um grupo específico e ver a linha do tempo completa das mensagens
(remetente, horário, conteúdo, paginada) e a lista de participantes.

## Requirements

### Requirement: Timeline de mensagens do grupo

O sistema SHALL permitir abrir um grupo e navegar TODAS as suas mensagens em ordem
cronológica, com remetente, horário e conteúdo. A leitura MUST ser paginada por
cursor (para grupos com muitas mensagens) e ler apenas de `whatsapp_messages`
(read-only), escopada por owner + `chat_id` + `chat_type = 'group'`.

#### Scenario: Abrir a timeline de um grupo

- **WHEN** o usuário abre um grupo
- **THEN** vê as mensagens em ordem cronológica, cada uma com remetente (nome), horário, e o texto/legenda (ou rótulo de mídia)

#### Scenario: Carregar mensagens mais antigas

- **WHEN** o usuário pede "carregar mais" no topo da timeline
- **THEN** a próxima página de mensagens mais antigas é buscada via cursor (`before`), sem recarregar as já exibidas

#### Scenario: Timeline escopada e read-only

- **WHEN** a timeline é montada
- **THEN** só traz mensagens daquele `chat_id` de grupo do owner e nunca escreve em `whatsapp_messages`

### Requirement: Lista de participantes do grupo

O sistema SHALL exibir os participantes de um grupo — nome de exibição, telefone
(quando disponível) e se é admin — a partir dos dados persistidos pelo import
(`group_participants`).

#### Scenario: Ver quem participa

- **WHEN** o usuário abre a aba/lista de participantes de um grupo
- **THEN** vê os membros com nome e, quando houver, telefone; admins são identificados

#### Scenario: Participante sem telefone

- **WHEN** um participante não expõe telefone (só `@lid`)
- **THEN** ele ainda aparece pelo nome, marcado como "sem telefone", em vez de ser omitido

### Requirement: Contagem real de participantes

O sistema SHALL usar a contagem real de participantes (de `groups.participant_count`,
vinda do uazapi) em vez de derivá-la dos remetentes das mensagens.

#### Scenario: Contagem não é mais zero

- **WHEN** a lista de grupos e o detalhe exibem a contagem de participantes
- **THEN** mostram o número real de membros do grupo, não um valor derivado de `sender_phone` (que é ~0 por causa do `@lid`)
