## Why

O usuário observou que "não puxou todos os grupos nem todas as mensagens".
Diagnóstico: o import só rodou em **piloto** (`IMPORT_CHAT_LIMIT`=3–5) — a tabela
`groups` tem **5** de **349** grupos disponíveis, e as **3224** mensagens em
`whatsapp_messages` são resquício de um import antigo (pré-migração), não um pull
completo. O importador é **capaz** (o roster pagina até 349; `/message/find` tem
`hasMore`/`nextOffset` para paginar todo o histórico), mas: (a) nunca foi
executado sem limites, e (b) falta observabilidade e verificação para confiar que
"tudo" veio, além de resiliência para um pull grande (349 grupos × milhares de
mensagens × 349 chamadas `/group/info`).

## What Changes

- **Progresso no import** — logar `grupo i/total` usando o `totalRecords` do roster,
  e o total de mensagens por grupo, para acompanhar um pull longo.
- **Resumo de completude** — ao final, reportar: grupos processados / total,
  mensagens inseridas, e **grupos que ficaram sem mensagem** (para investigar).
- **Comando de verificação** — `verify-import`: compara o que está no DB com o
  disponível no uazapi (grupos no `groups` vs `totalRecords`; grupos com 0
  mensagens; participantes sem contagem) e imprime um relatório.
- **Import resumível** — pular grupos já totalmente importados nesta rodada (ou
  retomar de um offset de roster), para que um pull de 349 grupos que falhe no
  meio não recomece do zero.
- **Executar o import completo** — rodar sem `IMPORT_CHAT_LIMIT`/`IMPORT_MSG_LIMIT`
  contra o Supabase local, puxando todos os grupos + mensagens + participantes.

## Capabilities

### Modified Capabilities
- `uazapi-import`: ganha progresso, resumo de completude, verificação
  (`verify-import`) e resumibilidade, para um pull **completo e confiável** de
  todos os grupos e mensagens.

## Impact

- **Scripts:** `import-uazapi` (progresso + resumo + resumibilidade); novo
  `verify-import.ts` + entrada em `scripts/package.json`.
- **Execução:** um import completo é uma operação longa (349 grupos, paginação de
  mensagens, 349 `/group/info`) — o retry/backoff e a resiliência por grupo já
  existentes cobrem falhas pontuais; a resumibilidade cobre falhas maiores.
- **Dados:** `whatsapp_messages` (dedup por `message_id`), `groups`,
  `group_participants` são preenchidos até a completude; nada é apagado.
- **Limitação externa:** o uazapi só entrega o histórico que a instância tem em
  cache/servidor — "todas as mensagens" é limitado ao que o provedor retém, não a
  toda a história do WhatsApp. A verificação reporta o que veio vs o que o uazapi
  expõe.
