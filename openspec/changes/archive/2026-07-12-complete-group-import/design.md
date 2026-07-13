## Context

O import só-grupos (roster + mensagens + participantes) funciona, mas só rodou em
piloto. Confirmado contra a instância: 349 grupos disponíveis; `/message/find`
pagina via `hasMore`/`nextOffset` (sem total). Um pull completo é longo (349
grupos, paginação de mensagens, 349 `/group/info`), então precisa de progresso,
verificação e resiliência a interrupções — não de novas capacidades de busca.

## Goals / Non-Goals

**Goals:**

- Puxar **todos os 349 grupos** + todas as mensagens que o uazapi expõe +
  participantes, de forma observável e verificável.
- Deixar claro (progresso + resumo + verificação) que o pull chegou à completude.
- Sobreviver a interrupções sem recomeçar do zero (resumível).

**Non-Goals:**

- Reescrever a busca (roster/mensagens/participantes já paginam corretamente).
- Recuperar histórico que o uazapi **não retém** (a completude é relativa ao que o
  provedor expõe).
- Streaming/tempo real (o import segue sob demanda).

## Decisions

**1. Progresso a partir do total do roster.**
`client.countGroups()` faz um `/chat/find` `limit:1 wa_isGroup:true` e lê
`pagination.totalRecords`. O orquestrador recebe esse total e loga `grupo i/total`
+ mensagens por grupo. Alternativa (contar conforme itera) — não dá o denominador
antecipado.

**2. Resumo de completude + `verify-import`.**
`runImport` passa a retornar também `emptyGroups` (grupos sem mensagem nesta
rodada) e loga um resumo final. Um script novo `verify-import` (read-only) compara
o DB com o uazapi: grupos no `groups` vs `totalRecords`, grupos com 0 mensagens,
grupos sem `participant_count`, e total de mensagens/participantes — imprimindo um
relatório de completude.

**3. Resumibilidade por heurística "grupo já feito".**
Com `IMPORT_RESUME=1`, o orquestrador pula um grupo que já tem `participant_count`
definido **e** mensagens em `whatsapp_messages` — assume-o já importado. Evita
repaginar mensagens (custo de rede) num re-run após falha. Alternativa (tabela de
checkpoint de offset) — mais robusta mas mais peso; a heurística cobre o caso
comum (retomar um pull grande). Documentar que não detecta mensagens novas em
grupos já marcados como feitos (para isso, rodar sem `IMPORT_RESUME`).

**4. Manter dedup + resiliência por grupo.**
`on conflict (message_id) do nothing` e o skip-por-grupo-em-erro já existentes
garantem idempotência e que um grupo problemático não aborta o pull.

## Risks / Trade-offs

- **Duração / rate limit** → 349 grupos × (paginação + `/group/info`). O
  retry/backoff do client cobre 429/5xx; a resumibilidade cobre falha maior.
  Mitigação: `IMPORT_SKIP_PARTICIPANTS=1` para um pull inicial mais rápido só de
  mensagens, depois um segundo pull para participantes.
- **Heurística de resume** → um grupo "feito" com mensagens novas não é
  reprocessado sob `IMPORT_RESUME`. Mitigação: documentar; re-run sem resume para
  incremental completo.
- **Completude é relativa ao uazapi** → não há como puxar o que o provedor não
  retém. `verify-import` reporta o observável, não promete a história inteira.

## Migration Plan

1. `client.countGroups()` + progresso/resumo no `runImport`.
2. Resumibilidade (`IMPORT_RESUME`).
3. Script `verify-import` + registro em `package.json`.
4. Rodar piloto (com progresso) → rodar full (sem limites) → `verify-import`.

Rollback: mudanças em scripts; dados só crescem (dedup). Sem efeito em produção.

## Open Questions

- Fazer o full em uma passada (mensagens + participantes juntos) ou duas
  (mensagens primeiro, participantes depois) para acelerar? (Assumido: uma passada,
  com `IMPORT_SKIP_PARTICIPANTS` disponível se precisar dividir.)
