# group-management

## Purpose

Gerenciar grupos — relevância (monitorado/ignorado), categoria/tags, apelido,
cadência de digest e arquivamento — com o estado persistido na tabela `groups`.

## Requirements

### Requirement: Relevância do grupo (monitorado vs ignorado)

O sistema SHALL permitir marcar cada grupo como **monitorado** ou **ignorado**.
Grupos ignorados MUST ser excluídos das análises e KPIs por padrão. O estado é
persistido em `groups` (coluna `relevance`, default `monitored`), migrando os
grupos hoje em `support_groups` para `ignored`.

#### Scenario: Ignorar remove das análises

- **WHEN** um grupo é marcado como `ignored`
- **THEN** ele deixa de contar nos KPIs e digests por padrão, mas seus dados permanecem

#### Scenario: Default monitorado

- **WHEN** um grupo novo é registrado pelo import
- **THEN** entra como `monitored`

#### Scenario: Migração do support_groups

- **WHEN** a migration de gestão roda
- **THEN** todo grupo listado em `support_groups` fica com `relevance = 'ignored'`

### Requirement: Categoria, tags e apelido

O sistema SHALL permitir categorizar cada grupo, aplicar tags livres e definir um
apelido (nome de exibição) que sobrepõe o nome vindo do WhatsApp.

#### Scenario: Apelido sobrepõe o nome

- **WHEN** um grupo tem `alias` definido
- **THEN** a UI exibe o `alias` no lugar do `name` original

#### Scenario: Filtrar por categoria/tag

- **WHEN** o usuário filtra a lista de grupos por uma categoria ou tag
- **THEN** só os grupos com aquela categoria/tag aparecem

### Requirement: Cadência de digest por grupo

O sistema SHALL permitir, por grupo, ligar/desligar o digest e escolher a
periodicidade (`daily` ou `weekly`). A geração de digests MUST respeitar essa
configuração.

#### Scenario: Digest desligado não gera

- **WHEN** um grupo tem `digest_enabled = false`
- **THEN** nenhum digest é gerado para ele

#### Scenario: Periodicidade respeitada

- **WHEN** um grupo tem `digest_cadence = 'weekly'`
- **THEN** seus digests cobrem janelas semanais

### Requirement: Arquivar grupo

O sistema SHALL permitir arquivar um grupo inativo, removendo-o das listas
padrão sem apagar seus dados. Arquivar MUST ser reversível.

#### Scenario: Arquivado some da lista padrão

- **WHEN** um grupo é arquivado (`archived_at` preenchido)
- **THEN** ele não aparece na lista padrão de grupos, mas continua acessível via filtro "arquivados"

#### Scenario: Desarquivar restaura

- **WHEN** um grupo arquivado é desarquivado
- **THEN** volta a aparecer na lista padrão com os dados intactos
