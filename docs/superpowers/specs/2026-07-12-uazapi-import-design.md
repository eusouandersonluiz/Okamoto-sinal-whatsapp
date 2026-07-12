# Design — Importação uazapi → Sinal local

**Data:** 2026-07-12
**Status:** aprovado (aguardando revisão do spec)
**Autor:** Anderson Luiz (via Claude Code)

## 1. Objetivo

Rodar o Sinal localmente (Supabase via Docker) e importar o histórico de
mensagens do WhatsApp através do **uazapi** para o mirror local
`whatsapp_messages`, de forma **repetível e incremental**: cada execução puxa
apenas o que ainda não foi importado. Escopo de conteúdo: **todos os chats**
(privados + grupos), o máximo de histórico que a instância expuser.

O importador é a implementação concreta do passo "traga seus próprios dados",
que o README do projeto já prevê — não é streaming ao vivo, nem envio de
mensagens.

## 2. Contexto e restrições

- **Ingestão sob demanda, não ao vivo.** Sem webhook, sem streaming. O usuário
  roda o importador quando quiser atualizar.
- **Banco + login locais via Supabase Docker** (`supabase start`): Postgres +
  Auth (GoTrue) + Studio offline. O login por senha
  (`supabase.auth.signInWithPassword`) e o `bootstrap-auth` (admin API)
  funcionam contra o GoTrue local sem reescrita.
- **`whatsapp_messages` não existe localmente.** No deploy cloud original ela é
  uma tabela externa read-only; as migrations canônicas nunca a criam por
  contrato. Localmente precisamos criá-la nós mesmos, **fora** de
  `lib/db/migrations/`, para não violar esse contrato e manter merges limpos com
  o upstream open-source.
- **Conexão local já suportada pelo pool.** `lib/db/src/index.ts:16-20` só ativa
  SSL para hosts `supabase.co|com`; o Supabase local (`127.0.0.1:54322`) conecta
  sem SSL automaticamente. Nenhuma mudança necessária no pool.
- **`whatsapp_messages` já está modelada no Drizzle** (`lib/db/src/schema/whatsapp.ts`),
  com todas as colunas. O `CREATE TABLE` do mirror local é derivado desse shape.
- **A página Mídia depende de `metadata->>'raw_type'`** (`routes/media.ts`
  filtra `metadata->>'raw_type' is not null` e mapeia por `TYPE_RAW`). O mapper
  precisa preencher `metadata.raw_type` para que a tela de Mídia funcione.
- **Profundidade de histórico é limitada** ao que o dispositivo conectado
  sincronizou (WhatsApp multi-device). Fora do nosso controle.

## 3. Arquitetura / fluxo de dados

```
uazapi (instância + token, número já conectado)
  → scripts/src/import-uazapi.ts        orquestra: pagina chats → mensagens
      ├─ scripts/src/uazapi/client.ts   HTTP, auth por token, paginação, retry
      └─ scripts/src/uazapi/mapper.ts   evento uazapi → linha whatsapp_messages (puro)
  → upsert em lote:  insert ... on conflict (message_id) do nothing
  → whatsapp_messages                   mirror local (bootstrap local-only)
  → [pipeline já existente] refresh-all → tabelas do app → API Express → dashboard React
```

Abordagem escolhida: **A — script `tsx` + adapter isolado**. Casa com o padrão
atual (`migrate`, backfills já são scripts `tsx`), superfície mínima, isola o
uazapi num adapter (trocar endpoint = 1 arquivo). Pode evoluir para um botão na
UI (abordagem B) numa fase futura sem retrabalho do núcleo.

## 4. Componentes (unidades isoladas)

### 4.1 `scripts/src/uazapi/client.ts`
Único módulo que conhece a API do uazapi.
- **Config (env):** `UAZAPI_BASE_URL`, `UAZAPI_TOKEN` (e `UAZAPI_INSTANCE` se a
  conta exigir). Falha rápido se faltarem.
- **Interface:**
  - `listChats(): AsyncIterable<UazChat>` — pagina todos os chats.
  - `listMessages(chatId, cursor?): AsyncIterable<UazRawMessage>` — pagina
    mensagens de um chat.
- **Responsabilidades:** montar requests autenticados, paginação, retry com
  backoff exponencial em 429/5xx, respeitar rate-limit.
- **Depende de:** `fetch` + env. Nada do resto do app.
- **Nota:** nomes exatos de endpoints e campos do payload serão fixados na
  implementação, contra a instância real do usuário (ver §9).

### 4.2 `scripts/src/uazapi/mapper.ts`
Função pura, sem I/O, totalmente testável.
- **Interface:** `mapMessage(raw: UazRawMessage, owner: string): WhatsappRow | null`
  (retorna `null` quando não há `message_id` deduplicável).
- **Mapeamento para as colunas de `whatsapp_messages`:**
  | Coluna | Origem |
  | --- | --- |
  | `whatsapp_owner` | `owner` (env `WHATSAPP_OWNER`) |
  | `chat_type` | jid termina em `@g.us` → `group`, senão `private` |
  | `chat_id` | DM: telefone do parceiro; grupo: jid do grupo |
  | `chat_name` | nome do chat/contato |
  | `sender_phone` / `sender_name` | autor da mensagem |
  | `direction` | `fromMe` → `outbound`, senão `inbound` |
  | `message_type` | tipo normalizado (text/image/audio/…) |
  | `message` / `caption` | conteúdo textual / legenda |
  | `media_url` / `media_mime_type` | mídia (se houver) |
  | `reply_to_message_id` | mensagem citada |
  | `forwarded` / `reaction` / `reacted_to_message_id` | threading/reações |
  | `message_id` | id da mensagem uazapi (**chave de junção única**) |
  | `message_created_at` | timestamp da mensagem (timestamptz) |
  | `transcription` | `null` por ora (extensão futura) |
  | `metadata` (jsonb) | payload cru **+ `raw_type`** (necessário para a tela Mídia) |

### 4.3 `scripts/src/import-uazapi.ts`
Orquestrador executável (`tsx`).
- Percorre `listChats()` → para cada chat, `listMessages()` → `mapMessage()` →
  acumula e faz **upsert em lote** (`on conflict (message_id) do nothing`).
- **Idempotente:** re-execução insere apenas mensagens novas.
- **Env de ajuste (teste barato):** `IMPORT_CHAT_LIMIT`, `IMPORT_MSG_LIMIT`,
  `IMPORT_SINCE` (data mínima opcional).
- **Log de progresso:** chats varridos, mensagens vistas, inseridas, puladas.
- Registrado em `scripts/package.json` como `import-uazapi`.

### 4.4 `scripts/src/create-local-source.ts`
Bootstrap **local-only** (não é migration canônica).
- Cria `whatsapp_messages` no Postgres local, derivada do shape de
  `lib/db/src/schema/whatsapp.ts`.
- Cria `create unique index if not exists on whatsapp_messages (message_id)` para
  habilitar o upsert idempotente.
- Idempotente (`create table if not exists`). Registrado como
  `create-local-source`.
- **Fora de `lib/db/migrations/`** — preserva o contrato read-only do upstream.

## 5. Fluxo de execução (rodar local, ponta a ponta)

1. `supabase start` (Docker) — anota `API URL`, `service_role key`, DB URL locais.
2. `.env` local:
   - `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - `SUPABASE_URL=http://127.0.0.1:54321`
   - `SUPABASE_SERVICE_KEY=<service_role key local>`
   - `SESSION_SECRET=<aleatório>` · `WHATSAPP_OWNER=<seu número>` · `OPENAI_API_KEY=<...>`
   - `UAZAPI_BASE_URL=<...>` · `UAZAPI_TOKEN=<...>`
3. `pnpm --filter @workspace/scripts run create-local-source` — cria o mirror.
4. `pnpm --filter @workspace/scripts run migrate` — tabelas do app.
5. `pnpm --filter @workspace/scripts run bootstrap-auth` — login admin (GoTrue local).
6. `pnpm --filter @workspace/scripts run import-uazapi` — popula `whatsapp_messages`.
   - **Piloto primeiro:** `IMPORT_CHAT_LIMIT`/`IMPORT_MSG_LIMIT` pequenos.
7. `pnpm --filter @workspace/scripts run refresh-all` — jobs de IA.
   - ⚠️ **Custo OpenAI.** Rodar amostra (`SAMPLE_SIZE`/`BATCH_SIZE`) antes do volume total.
8. `api-server` + `sinal-web` — abrir `http://localhost:5173`.

## 6. Idempotência e incremental

- Chave de deduplicação: `message_id` único no mirror local.
- Estratégia: `insert ... on conflict (message_id) do nothing`. Re-run varre e
  pula existentes — simples e correto.
- **Otimização futura (YAGNI agora):** tabela de cursor por chat para evitar
  re-varredura completa. Só se a re-varredura ficar lenta na prática.

## 7. Tratamento de erro

- **Client:** retry com backoff exponencial em 429/5xx; erro persistente em um
  chat é logado e o importador **segue para o próximo** (resiliente, no espírito
  do `refresh-all`).
- **Upsert:** transacional por lote — um job longo sobrevive a timeouts do shell,
  dados persistem incrementalmente.
- **Linha sem `message_id`:** descartada (não deduplicável) e logada com contagem.

## 8. Testes

- `scripts/src/uazapi/mapper.test.ts` (vitest, puro, sem rede): DM inbound, DM
  outbound, mensagem de grupo, mídia (verifica `metadata.raw_type`), reply,
  reação, e caso sem `message_id` (→ `null`).
- `client`: teste leve com fixture de resposta HTTP (sem chamar a API real) —
  cobre paginação e o parsing do envelope.

## 9. Riscos e questões abertas

- **Endpoints exatos do uazapi.** A doc pública é uma SPA (não legível via
  fetch). O shape real (nomes de endpoints, campos de mensagem/chat, formato de
  paginação) será fixado na implementação a partir de UMA resposta real da
  instância do usuário — pedir um `curl` de exemplo ou o link da doc da conta.
  Todo o acoplamento fica em `client.ts` + os tipos que o `mapper` consome.
- **Profundidade de histórico** limitada ao que o dispositivo sincronizou
  (WhatsApp multi-device). Não controlável; expectativa alinhada com o usuário.
- **`media_url`** pode expirar ou exigir token do uazapi para abrir. A tela Mídia
  usa a URL direto. Verificar no piloto; rehospedagem de mídia é extensão futura.

## 10. Fora de escopo (YAGNI)

- Webhook / ingestão ao vivo (streaming).
- Envio/resposta de mensagens pelo WhatsApp.
- Transcrição de áudio (deixar `transcription` = `null`).
- Botão "importar" no dashboard (abordagem B — fase futura).
- Download/rehospedagem de mídia.
- Mapeamento per-tenant do owner (segue MVP single-tenant).
