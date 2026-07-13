## 1. Backfill de nomes

- [ ] 1.1 `scripts/src/resolve-names.ts`: update de `group_participants.name` a partir do pushname mais recente por `lid` (join `metadata.raw.sender`), só onde nulo, escopado por tenant + registro em `package.json`
- [ ] 1.2 Rodar `resolve-names` no DB atual; confirmar aumento de nomes (~1204 resolvidos)

## 2. Resolução no import

- [ ] 2.1 `import-uazapi`: rodar a mesma resolução ao final (função compartilhada/inline); log de quantos nomes resolvidos
- [ ] 2.2 Teste da montagem do SQL/idempotência (unidade) sob `bun test` onde aplicável

## 3. Verificação

- [ ] 3.1 typecheck verde; `bun test` verde
- [ ] 3.2 e2e no app vivo: `/groups/:id/participants` de um grupo ativo mostra nomes (não só telefone)
- [ ] 3.3 `verify-import`: reportar participantes com/sem nome
