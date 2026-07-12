## Context

O Sinal consome uma tabela read-only `whatsapp_messages`. No deploy em nuvem essa
tabela é populada por um pipeline externo; localmente ela não existe. Sem uma
forma de carregar histórico real, é impossível exercitar os jobs de IA e o
dashboard localmente. A instância uazapi já expõe o histórico do número
conectado via HTTP. Este design descreve como puxar esse histórico para um mirror
local sem quebrar o contrato read-only do upstream.

Restrições do repo: monorepo pnpm, Node 24, TypeScript 5.9, `tsx` para scripts,
`pg` via `@workspace/db`, vitest. `whatsapp_messages` NUNCA pode entrar nas
migrations canônicas — a chave universal de junção/dedup é `message_id`.

## Goals / Non-Goals

**Goals:**

- Preencher `whatsapp_messages` local a partir do uazapi, de forma idempotente e
  reexecutável (incremental por dedup de `message_id`).
- Isolar todo o acoplamento com o uazapi atrás de um adapter, para que uma
  mudança de versão do provedor toque apenas um arquivo.
- Testar a lógica de normalização e mapeamento de forma pura (sem rede, sem DB).
- Preservar o contrato read-only do upstream: o bootstrap da tabela é local-only.

**Non-Goals:**

- Integração ao vivo com o WhatsApp ou envio de mensagens (o Sinal só lê).
- Alterar o schema canônico ou as migrations.
- Transcrição/enriquecimento de mídia (fica a cargo dos jobs de IA existentes).
- Sincronização contínua/streaming — a importação é sob demanda.

## Decisions

**1. Bootstrap local separado das migrations (`create-local-source`).**
A tabela-fonte é externa e read-only em produção; criá-la via migration
canônica violaria esse contrato e arriscaria escrever nela em nuvem. Alternativa
considerada: uma migration condicional por ambiente — rejeitada por acoplar a
lógica de ambiente às migrations e por ser fácil de aplicar por engano.

**2. Adapter uazapi isolado com tipos normalizados próprios.**
Todo o formato de wire (`messageid`, `content.text`, `fileURL`, `@lid`, etc.)
vive em `client.ts`; o resto do código depende só de `UazMessage`/`UazChat`.
Alternativa: passar o JSON bruto adiante — rejeitada por espalhar o acoplamento e
tornar o mapper impuro/instável.

**3. Mapper puro, separado do transporte.**
`mapMessage` é uma função pura testável sem rede nem DB. Isola as regras de
negócio (privado vs grupo, direção, extração de telefone) das preocupações de I/O.

**4. Upsert em lote com `on conflict (message_id) do nothing`.**
Dá idempotência e incrementalidade de graça: reexecutar traz só o que falta.
Alternativa: `upsert` com `do update` — rejeitada porque a tabela-fonte é o
registro imutável do que aconteceu; não se reescreve histórico.

**5. Resiliência por chat + retry de transporte.**
Um chat problemático (JID inválido, timeout) é logado e pulado; erros 429/5xx têm
backoff. Alternativa: abortar tudo no primeiro erro — rejeitada por inviabilizar
importações grandes.

**6. Telefone só de `@s.whatsapp.net`, com strip de sufixo de dispositivo.**
Remetentes de grupo usam `@lid` (linked-id, não é telefone) e JIDs de grupo usam
`@g.us`. Tratar qualquer um como telefone corromperia o CRM. Sufixo `:NN` de
dispositivo é removido antes de extrair dígitos.

## Risks / Trade-offs

- **Shape do uazapi muda entre versões** → mitigado concentrando o acoplamento em
  `client.ts` (`normalizeMessage`/`normalizeChat`) e cobrindo com fixture. Só um
  arquivo muda se a instância mudar.
- **Mídia histórica com `fileURL` vazio** → o normalizador cai para `content.URL`
  quando `fileURL` está vazio (já corrigido em commit desta branch), evitando
  perder `media_url` de mensagens antigas.
- **`chat_id` para DM = telefone do parceiro** → depende de o JID do chat ser
  `@s.whatsapp.net`. Chats sem telefone resolvível caem como esperado; o mapper
  não inventa telefone.
- **Custo/tempo de importações grandes** → mitigado por `IMPORT_CHAT_LIMIT`,
  `IMPORT_MSG_LIMIT` e `IMPORT_SINCE` para pilotar barato antes do volume total.
- **Dependências de plataforma pinadas** (`*-darwin-arm64` no `package.json` raiz,
  não commitadas) → risco de quebrar o install em Linux/Replit; fora do escopo
  desta capability, mas registrado para não ser esquecido.

## Migration Plan

Local-only, sem rollback em produção:
1. `supabase start` (Docker) e `.env` local carregado.
2. `create-local-source` cria o mirror; `migrate` cria as tabelas do app.
3. `import-uazapi` com limites (piloto) e depois sem limites (volume total).
4. Reexecutar `import-uazapi` a qualquer momento é seguro (dedup por `message_id`).

Rollback: dropar a tabela local `whatsapp_messages` e reexecutar o bootstrap. Não
há efeito em nuvem — o upstream permanece intocado.

## Open Questions

- Vale wire de `IMPORT_SINCE` também no nível de `runImport` (hoje o corte por
  data é aplicado no client via `listMessages({ since })`)? Comportamento atual
  atende, mas a interface do orquestrador poderia expor `since` explicitamente.
- Captura de `reacted_to_message_id` a partir do payload real do uazapi ainda é
  nula na normalização; confirmar se o provedor expõe esse vínculo.
