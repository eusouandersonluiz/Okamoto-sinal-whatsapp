## Context

`group_participants.name` vem de `DisplayName` do `/group/info`, quase sempre
vazio (2592/2593 nulos). O nome real do usuário é o **pushname**, que aparece nas
mensagens como `sender_name`, com o `@lid` do remetente em `metadata.raw.sender`.
Join `lid → participante` resolve 1204 nomes hoje.

## Goals / Non-Goals

**Goals:** preencher `group_participants.name` a partir do pushname mais recente
por `lid`; rodar no import e como backfill idempotente; não tocar a tabela
read-only `whatsapp_messages`.

**Non-Goals:** inventar nome de quem nunca enviou mensagem (fica nulo);
resolver telefone de `@lid` (privacidade); alterar o schema-fonte.

## Decisions

**1. Fonte do nome = pushname da mensagem mais recente por lid.**
`distinct on (metadata->'raw'->>'sender') ... order by ... message_created_at desc`
pega o pushname mais atual. Só atualiza onde `name is null` (não sobrescreve um
DisplayName real que exista). Idempotente.

**2. Backfill em SQL puro (`resolve-names.ts`).**
```sql
update group_participants gp
   set name = sub.pushname, updated_at = now()
  from (
    select distinct on (w.metadata->'raw'->>'sender')
           w.metadata->'raw'->>'sender' as lid,
           w.sender_name as pushname
      from whatsapp_messages w
     where w.chat_type = 'group' and w.sender_name is not null
       and w.metadata->'raw'->>'sender' like '%@lid'
     order by w.metadata->'raw'->>'sender', w.message_created_at desc
  ) sub
 where gp.lid = sub.lid and gp.name is null;
```
Escopado por tenant no update (`gp.tenant_id = MVP_TENANT_ID`).

**3. Rodar no fim do import.** Após percorrer os grupos, o `import-uazapi` executa
o mesmo update, para novos participantes ganharem nome sem passo manual.

## Risks / Trade-offs

- **Pushname desatualizado** → usa o mais recente; aceitável (é o nome que a pessoa
  exibe). Mitigação: re-rodar atualiza.
- **lid ausente em mensagens antigas** (formato diferente) → o `like '%@lid'` filtra;
  quem não casa fica sem nome (sem dano).
- **Não sobrescreve DisplayName real** → `where name is null` preserva o 1 caso real.

## Migration Plan

1. `resolve-names.ts` + registro em `package.json`.
2. `import-uazapi` chama a resolução no fim (função compartilhada ou query inline).
3. Rodar `resolve-names` no DB atual → conferir contagem de nomes.
4. Confirmar no app vivo: participantes de um grupo ativo mostram nome.
