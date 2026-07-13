## Why

O usuário quer "ver o nome dos usuários". Hoje **2592 de 2593** participantes estão
**sem nome**: o `/group/info` do uazapi devolve `DisplayName` vazio (o WhatsApp só
expõe o nome salvo do contato, que quase nunca existe para membros de grupo). Mas
as **mensagens carregam o pushname** (o nome que o próprio usuário definiu, ex.:
"Ana Paula Polato") em `sender_name`, e o `@lid` do remetente em
`metadata.raw.sender`. Dá para **resolver o nome** juntando `lid` da mensagem →
participante. Diagnóstico: **1204** dos 2592 nulos são resolvíveis assim (os
demais estão em grupos sem mensagem / nunca enviaram — limite do que o uazapi
retém).

## What Changes

- **Backfill de nomes** — preencher `group_participants.name` a partir do pushname
  (`sender_name`) da mensagem mais recente daquele `lid`, quando o nome estiver
  nulo. Script `resolve-names` (idempotente, read sobre `whatsapp_messages`,
  update em `group_participants`).
- **Resolução no import** — ao final do import, rodar a mesma resolução, para que
  participantes recém-importados ganhem nome sem passo manual.
- **Join via `metadata.raw.sender`** — o `@lid` do remetente já vem no payload
  bruto que o mapper guarda em `metadata.raw.sender`; o backfill junta por ele.
  Sem alterar a tabela read-only `whatsapp_messages`.

## Capabilities

### Modified Capabilities
- `uazapi-import`: resolve o nome dos participantes a partir do pushname das
  mensagens (backfill + passo no import) e persiste o `sender_lid` da mensagem.

## Impact

- **DB:** coluna `whatsapp_messages.sender_lid`? — **NÃO** (a tabela-fonte é
  read-only e nunca migrada). Em vez disso o mapper grava o lid em
  `metadata.raw.sender` (já vem no raw) e o join usa `metadata->'raw'->>'sender'`.
  Sem migration.
- **Scripts:** novo `resolve-names.ts` (backfill) + registro; `import-uazapi`
  chama a resolução no fim.
- **Dados:** só atualiza `group_participants.name` onde nulo; nada é apagado.
- **Limite:** participantes que nunca enviaram mensagem (ou em grupos sem
  histórico sincronizado) permanecem sem nome — o uazapi não expõe o nome deles.
