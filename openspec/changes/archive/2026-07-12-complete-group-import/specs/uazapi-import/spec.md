## ADDED Requirements

### Requirement: Import completo com progresso e resumo

O import SHALL, quando rodado sem limites, puxar TODOS os grupos do roster e todas
as mensagens que o uazapi expõe por grupo. Durante a execução MUST reportar
progresso (`grupo i/total`, com `total` vindo do `totalRecords` do roster) e, ao
final, um resumo de completude: grupos processados/total, mensagens inseridas e
número de grupos que ficaram sem mensagem.

#### Scenario: Progresso mostra o denominador

- **WHEN** o import completo roda
- **THEN** cada grupo é logado como `i/total` (total = grupos disponíveis no uazapi), não apenas um índice solto

#### Scenario: Resumo final de completude

- **WHEN** o import termina
- **THEN** imprime grupos processados/total, total de mensagens inseridas e quantos grupos ficaram sem mensagem

#### Scenario: Sem limites puxa tudo

- **WHEN** o import roda sem `IMPORT_CHAT_LIMIT` e sem `IMPORT_MSG_LIMIT`
- **THEN** percorre todos os grupos do roster e pagina cada grupo até `hasMore` ser falso

### Requirement: Verificação de completude do import

O sistema SHALL prover um comando `verify-import` (read-only) que compara o estado
do banco com o disponível no uazapi e reporta lacunas.

#### Scenario: Relatório de completude

- **WHEN** `verify-import` roda
- **THEN** imprime grupos no `groups` vs `totalRecords` do uazapi, grupos com 0 mensagens, grupos sem `participant_count` e os totais de mensagens/participantes

#### Scenario: Aponta o que falta

- **WHEN** há menos grupos no DB do que o uazapi expõe
- **THEN** o relatório sinaliza a diferença (import incompleto), em vez de aparentar completude

### Requirement: Import resumível

O import SHALL suportar retomada: com `IMPORT_RESUME=1`, um grupo já importado
(com `participant_count` e mensagens no DB) MUST ser pulado, para que um pull
grande interrompido não recomece do zero.

#### Scenario: Retomar pula grupos já feitos

- **WHEN** o import roda com `IMPORT_RESUME=1` após uma interrupção
- **THEN** grupos já importados são pulados e o pull continua pelos que faltam

#### Scenario: Sem resume reprocessa (incremental)

- **WHEN** o import roda sem `IMPORT_RESUME`
- **THEN** todos os grupos são percorridos e mensagens novas entram por dedup (`on conflict do nothing`)
