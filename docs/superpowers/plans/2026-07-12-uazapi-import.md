# Importação uazapi → Sinal local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar histórico do WhatsApp via uazapi para um mirror local `whatsapp_messages`, de forma idempotente e incremental, com o Sinal rodando sobre Supabase local (Docker).

**Architecture:** Um script `tsx` sob demanda (`import-uazapi`) percorre chats e mensagens via um adapter isolado do uazapi (`client`), normaliza cada mensagem para o shape de `whatsapp_messages` (`mapper`, puro) e faz upsert em lote com `on conflict (message_id) do nothing`. A tabela-fonte é criada localmente por um bootstrap separado das migrations canônicas, preservando o contrato read-only do upstream.

**Tech Stack:** Node 24, TypeScript 5.9, pnpm workspaces, `tsx`, `pg` (via `@workspace/db`), Drizzle (schema de referência), vitest.

## Global Constraints

- Gerenciador: **pnpm** (o `preinstall` recusa npm/yarn). Node **24**, TypeScript **5.9**.
- Imports de Zod usam o subpath **`zod/v4`** (não há Zod neste plano, mas mantenha a convenção se adicionar).
- **NUNCA** adicionar `whatsapp_messages` a `lib/db/migrations/*` — a tabela-fonte é criada apenas pelo bootstrap local `create-local-source.ts`.
- Chave de junção/deduplicação universal: **`message_id`** (texto único).
- Scripts de dados vivem em `scripts/src/*` e são registrados em `scripts/package.json` como `tsx ./src/<nome>.ts`.
- UI/produto é pt-BR sem emojis (não se aplica a este plano — sem UI).
- Após editar `lib/*`, rodar `pnpm run typecheck:libs` antes dos typechecks das leaf packages. (Este plano não edita `lib/*`.)

---

## File Structure

- `scripts/src/create-local-source.ts` — bootstrap local-only: cria `whatsapp_messages` + índice único em `message_id`.
- `scripts/src/uazapi/types.ts` — tipos normalizados `UazMessage`, `UazChat` (fronteira que isola o uazapi).
- `scripts/src/uazapi/mapper.ts` — `mapMessage(UazMessage, owner) → WhatsappInsertRow | null` (puro) + `WHATSAPP_COLUMNS`.
- `scripts/src/uazapi/mapper.test.ts` — testes puros do mapper.
- `scripts/src/uazapi/client.ts` — transporte HTTP autenticado, paginação, retry + `normalizeMessage`/`normalizeChat`.
- `scripts/src/uazapi/fixtures/message.json`, `chat.json` — amostras de resposta do uazapi (substituídas por captura real).
- `scripts/src/uazapi/client.test.ts` — testes de normalização/paginação com fixture.
- `scripts/src/import-uazapi.ts` — orquestrador executável + núcleo testável `runImport` + `buildInsert`.
- `scripts/src/import-uazapi.test.ts` — teste do `buildInsert` e do `runImport` (deps injetadas).
- `scripts/vitest.config.ts` — config vitest do pacote scripts.
- `scripts/package.json` — novos scripts `create-local-source`, `import-uazapi`, `test`; devDeps de teste.
- `.env.example` — variáveis `UAZAPI_*` e nota do Supabase local.
- `docs/INSTALACAO-LOCAL-UAZAPI.md` — passo a passo local + uazapi.

---

## Task 1: Bootstrap do mirror local `whatsapp_messages`

**Files:**
- Create: `scripts/src/create-local-source.ts`
- Modify: `scripts/package.json` (adicionar script `create-local-source`)

**Interfaces:**
- Consumes: `pool` de `@workspace/db`.
- Produces: tabela `whatsapp_messages` local com todas as colunas de `lib/db/src/schema/whatsapp.ts` e `unique index whatsapp_messages_message_id_uniq (message_id)`; coluna `id bigint generated always as identity primary key`.

- [ ] **Step 1: Escrever o script**

Create `scripts/src/create-local-source.ts`:

```ts
import { pool } from "@workspace/db";

// LOCAL-ONLY. In the cloud deployment `whatsapp_messages` is an external,
// read-only table and the canonical migrations never touch it. Locally it does
// not exist, so this bootstrap creates a mirror matching lib/db/src/schema/
// whatsapp.ts, plus a unique index on message_id to enable idempotent upserts.
// Do NOT move this into lib/db/migrations/.
const DDL = `
create table if not exists whatsapp_messages (
  id bigint generated always as identity primary key,
  whatsapp_owner text,
  chat_type text,
  chat_id text,
  chat_name text,
  contact_phone text,
  sender_phone text,
  sender_name text,
  recipient_phone text,
  direction text,
  message_type text,
  message text,
  caption text,
  media_url text,
  media_mime_type text,
  transcription text,
  message_id text,
  reply_to_message_id text,
  forwarded boolean,
  reaction text,
  reacted_to_message_id text,
  status text,
  message_created_at timestamptz,
  metadata jsonb
);
create unique index if not exists whatsapp_messages_message_id_uniq
  on whatsapp_messages (message_id);
`;

async function main(): Promise<void> {
  await pool.query(DDL);
  const { rows } = await pool.query<{ count: string }>(
    "select count(*)::text as count from whatsapp_messages",
  );
  console.log(`whatsapp_messages ready (rows: ${rows[0]?.count ?? "0"})`);
  await pool.end();
}

void main();
```

- [ ] **Step 2: Registrar o script em `scripts/package.json`**

Add to `"scripts"` (após `"migrate"`):

```json
"create-local-source": "tsx ./src/create-local-source.ts",
```

- [ ] **Step 3: Rodar com Supabase local no ar e verificar (é o teste desta task)**

Pré-condição: `supabase start` rodando e `.env` local carregado (`set -a && source .env && set +a`) com `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

Run:
```bash
pnpm --filter @workspace/scripts run create-local-source
pnpm --filter @workspace/scripts run create-local-source   # segunda vez = idempotente
```
Expected: ambas terminam com `whatsapp_messages ready (rows: 0)`, sem erro.

Verificar colunas e índice:
```bash
psql "$SUPABASE_DB_URL" -c "select column_name from information_schema.columns where table_name='whatsapp_messages' order by 1;"
psql "$SUPABASE_DB_URL" -c "\d whatsapp_messages"
```
Expected: 24 colunas (incluindo `metadata jsonb`, `message_created_at timestamptz`) e `whatsapp_messages_message_id_uniq` como UNIQUE em `(message_id)`.

- [ ] **Step 4: Commit**

```bash
git add scripts/src/create-local-source.ts scripts/package.json
git commit -m "feat(scripts): bootstrap local do mirror whatsapp_messages"
```

---

## Task 2: Tipos normalizados + mapper (puro) + vitest no pacote scripts

**Files:**
- Create: `scripts/src/uazapi/types.ts`
- Create: `scripts/src/uazapi/mapper.ts`
- Create: `scripts/src/uazapi/mapper.test.ts`
- Create: `scripts/vitest.config.ts`
- Modify: `scripts/package.json` (devDeps `vitest`; script `test`)

**Interfaces:**
- Consumes: nada externo.
- Produces:
  - `interface UazMessage`, `interface UazChat` (em `types.ts`).
  - `const WHATSAPP_COLUMNS: string[]` — ordem canônica das colunas de insert.
  - `type WhatsappInsertRow = Record<(typeof WHATSAPP_COLUMNS)[number], unknown>` conceitual; concretamente um objeto com as chaves de `WHATSAPP_COLUMNS`.
  - `function mapMessage(m: UazMessage, owner: string): WhatsappInsertRow | null`.

- [ ] **Step 1: Definir os tipos normalizados**

Create `scripts/src/uazapi/types.ts`:

```ts
// Normalized shapes OWNED by this repo. The uazapi client is responsible for
// translating the provider's raw JSON into these; everything downstream depends
// only on these, never on uazapi's wire format.
export interface UazMessage {
  messageId: string; // unique id; rows without it are dropped
  chatId: string; // raw jid, e.g. "5511...@s.whatsapp.net" or "...@g.us"
  chatName: string | null;
  fromMe: boolean;
  senderPhone: string | null; // digits only
  senderName: string | null;
  text: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  replyToMessageId: string | null;
  forwarded: boolean;
  reaction: string | null;
  reactedToMessageId: string | null;
  timestampMs: number; // epoch milliseconds
  rawType: string; // original message type string (feeds metadata.raw_type)
  raw: unknown; // original payload, stored in metadata
}

export interface UazChat {
  chatId: string; // raw jid
  name: string | null;
}
```

- [ ] **Step 2: Escrever os testes do mapper (falhando)**

Create `scripts/src/uazapi/mapper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapMessage } from "./mapper";
import type { UazMessage } from "./types";

const base: UazMessage = {
  messageId: "MID1",
  chatId: "5511999999999@s.whatsapp.net",
  chatName: "Fulano",
  fromMe: false,
  senderPhone: "5511999999999",
  senderName: "Fulano",
  text: "oi",
  caption: null,
  mediaUrl: null,
  mediaMimeType: null,
  replyToMessageId: null,
  forwarded: false,
  reaction: null,
  reactedToMessageId: null,
  timestampMs: 1_720_000_000_000,
  rawType: "conversation",
  raw: { any: "thing" },
};

describe("mapMessage", () => {
  it("mapeia DM inbound com chat_id = telefone do parceiro", () => {
    const row = mapMessage(base, "5511000000000")!;
    expect(row.whatsapp_owner).toBe("5511000000000");
    expect(row.chat_type).toBe("private");
    expect(row.chat_id).toBe("5511999999999");
    expect(row.direction).toBe("inbound");
    expect(row.message).toBe("oi");
    expect(row.message_id).toBe("MID1");
    expect(row.message_created_at).toBe("2024-07-03T10:13:20.000Z");
    expect((row.metadata as { raw_type: string }).raw_type).toBe("conversation");
  });

  it("mapeia DM outbound (fromMe) como outbound", () => {
    const row = mapMessage({ ...base, fromMe: true }, "5511000000000")!;
    expect(row.direction).toBe("outbound");
  });

  it("mapeia grupo: chat_type group e chat_id = id do grupo", () => {
    const row = mapMessage(
      { ...base, chatId: "120363000000000000@g.us", chatName: "Meu Grupo" },
      "5511000000000",
    )!;
    expect(row.chat_type).toBe("group");
    expect(row.chat_id).toBe("120363000000000000");
    expect(row.chat_name).toBe("Meu Grupo");
  });

  it("mídia preenche media_url/mime e raw_type para a tela Mídia", () => {
    const row = mapMessage(
      { ...base, rawType: "imageMessage", mediaUrl: "https://x/y.jpg", mediaMimeType: "image/jpeg", caption: "foto" },
      "5511000000000",
    )!;
    expect(row.media_url).toBe("https://x/y.jpg");
    expect(row.media_mime_type).toBe("image/jpeg");
    expect(row.caption).toBe("foto");
    expect((row.metadata as { raw_type: string }).raw_type).toBe("imageMessage");
  });

  it("preserva reply e reação", () => {
    const row = mapMessage(
      { ...base, replyToMessageId: "MID0", reaction: "👍", reactedToMessageId: "MIDx", forwarded: true },
      "5511000000000",
    )!;
    expect(row.reply_to_message_id).toBe("MID0");
    expect(row.reaction).toBe("👍");
    expect(row.reacted_to_message_id).toBe("MIDx");
    expect(row.forwarded).toBe(true);
  });

  it("retorna null quando falta message_id", () => {
    expect(mapMessage({ ...base, messageId: "" }, "5511000000000")).toBeNull();
  });
});
```

- [ ] **Step 3: Adicionar vitest ao pacote scripts e config**

Create `scripts/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: [/@workspace\//] } },
  },
});
```

Modify `scripts/package.json`: add `"test": "vitest run"` to `"scripts"`, and to `"devDependencies"`:

```json
"vitest": "^4.1.8"
```

Run: `pnpm install`
Expected: instala vitest no workspace sem erros.

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @workspace/scripts exec vitest run src/uazapi/mapper.test.ts`
Expected: FAIL — `Cannot find module './mapper'` (ainda não existe).

- [ ] **Step 5: Implementar o mapper**

Create `scripts/src/uazapi/mapper.ts`:

```ts
import type { UazMessage } from "./types";

// Column order used by both the mapper output and the batch INSERT builder.
export const WHATSAPP_COLUMNS = [
  "whatsapp_owner",
  "chat_type",
  "chat_id",
  "chat_name",
  "contact_phone",
  "sender_phone",
  "sender_name",
  "recipient_phone",
  "direction",
  "message_type",
  "message",
  "caption",
  "media_url",
  "media_mime_type",
  "transcription",
  "message_id",
  "reply_to_message_id",
  "forwarded",
  "reaction",
  "reacted_to_message_id",
  "status",
  "message_created_at",
  "metadata",
] as const;

export type WhatsappInsertRow = Record<(typeof WHATSAPP_COLUMNS)[number], unknown>;

function jidLocalPart(jid: string): string {
  return jid.split("@")[0] ?? jid;
}

// DMs are keyed by the partner phone (contact_phone is empty for DMs); groups
// are keyed by the group id. See docs/ARQUITETURA.md ("Chats privados").
export function mapMessage(
  m: UazMessage,
  owner: string,
): WhatsappInsertRow | null {
  if (!m.messageId) return null;
  const isGroup = m.chatId.endsWith("@g.us");
  const chatKey = jidLocalPart(m.chatId);
  return {
    whatsapp_owner: owner,
    chat_type: isGroup ? "group" : "private",
    chat_id: chatKey,
    chat_name: m.chatName,
    contact_phone: null,
    sender_phone: m.senderPhone,
    sender_name: m.senderName,
    recipient_phone: null,
    direction: m.fromMe ? "outbound" : "inbound",
    message_type: m.rawType,
    message: m.text,
    caption: m.caption,
    media_url: m.mediaUrl,
    media_mime_type: m.mediaMimeType,
    transcription: null,
    message_id: m.messageId,
    reply_to_message_id: m.replyToMessageId,
    forwarded: m.forwarded,
    reaction: m.reaction,
    reacted_to_message_id: m.reactedToMessageId,
    status: null,
    message_created_at: new Date(m.timestampMs).toISOString(),
    metadata: { source: "uazapi", raw_type: m.rawType, raw: m.raw },
  };
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @workspace/scripts exec vitest run src/uazapi/mapper.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 7: Commit**

```bash
git add scripts/src/uazapi/types.ts scripts/src/uazapi/mapper.ts scripts/src/uazapi/mapper.test.ts scripts/vitest.config.ts scripts/package.json pnpm-lock.yaml
git commit -m "feat(scripts): tipos normalizados uazapi + mapper para whatsapp_messages"
```

---

## Task 3: Client uazapi (transporte + normalização) com fixture

**Files:**
- Create: `scripts/src/uazapi/client.ts`
- Create: `scripts/src/uazapi/fixtures/message.json`
- Create: `scripts/src/uazapi/fixtures/chat.json`
- Create: `scripts/src/uazapi/client.test.ts`

**Interfaces:**
- Consumes: `UazMessage`, `UazChat` de `./types`.
- Produces:
  - `function normalizeMessage(raw: Record<string, unknown>): UazMessage`
  - `function normalizeChat(raw: Record<string, unknown>): UazChat`
  - `class UazapiClient` com `listChats(): AsyncIterable<UazChat>` e `listMessages(chatId: string, opts?: { since?: number; limit?: number }): AsyncIterable<UazMessage>`.

> **Shapes confirmados contra a instância real em 2026-07-12.** Endpoints (auth
> por header `token: <UAZAPI_TOKEN>`):
> - `POST /chat/find` body `{operator:"AND", sort:"-wa_lastMsgTimestamp", limit, offset}`
>   → `{ chats: [...], pagination: { totalRecords } }`. Campos de chat usados:
>   `wa_chatid` (jid), `wa_isGroup`, `name` / `wa_contactName` / `phone`.
> - `POST /message/find` body `{chatid, sort:"-messageTimestamp", limit, offset}`
>   → `{ messages: [...], hasMore, nextOffset }`. Campos de mensagem usados:
>   `messageid`, `chatid`, `fromMe`, `messageType` (ex.: "Conversation",
>   "ImageMessage"), `text` / `content.text`, `content.caption`, `fileURL`
>   (mídia), `content.mimetype`, `sender` (pode ser `@lid` em grupos → não é
>   telefone), `senderName`, `messageTimestamp` (ms), `quoted` (reply), `reaction`.
>
> As fixtures abaixo usam valores **sintéticos** (sem PII real). Todo o
> acoplamento com o uazapi vive neste arquivo — se a instância mudar de versão,
> ajuste só `normalizeMessage`/`normalizeChat` e os campos de endpoint.

- [ ] **Step 1: Salvar fixtures (shape real do uazapi, valores sintéticos)**

Create `scripts/src/uazapi/fixtures/message.json`:

```json
{
  "messageid": "3AFE00000000EXEMPLO",
  "id": "558193452502:3AFE00000000EXEMPLO",
  "chatid": "120363000000000000@g.us",
  "fromMe": false,
  "isGroup": true,
  "messageType": "Conversation",
  "text": "mensagem de exemplo",
  "content": { "text": "mensagem de exemplo" },
  "fileURL": "",
  "quoted": "",
  "reaction": "",
  "sender": "111111111111111@lid",
  "senderName": "Contato Exemplo",
  "messageTimestamp": 1720000000000
}
```

Create `scripts/src/uazapi/fixtures/chat.json`:

```json
{
  "id": "r0000000000exemplo",
  "wa_chatid": "5512900000000@s.whatsapp.net",
  "wa_isGroup": false,
  "name": "",
  "wa_contactName": "Cliente Exemplo",
  "phone": "5512900000000"
}
```

- [ ] **Step 2: Escrever os testes de normalização (falhando)**

Create `scripts/src/uazapi/client.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeMessage, normalizeChat, UazapiClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (f: string) =>
  JSON.parse(readFileSync(path.join(here, "fixtures", f), "utf8"));

describe("normalizeMessage", () => {
  it("normaliza a fixture para UazMessage", () => {
    const m = normalizeMessage(load("message.json"));
    expect(m.messageId).toBe("3AFE00000000EXEMPLO");
    expect(m.chatId).toBe("120363000000000000@g.us");
    expect(m.fromMe).toBe(false);
    expect(m.senderPhone).toBeNull(); // sender é @lid, não telefone
    expect(m.senderName).toBe("Contato Exemplo");
    expect(m.text).toBe("mensagem de exemplo");
    expect(m.mediaUrl).toBeNull(); // fileURL vazio
    expect(m.rawType).toBe("Conversation");
    expect(m.timestampMs).toBe(1_720_000_000_000);
  });
});

describe("normalizeChat", () => {
  it("normaliza a fixture para UazChat (DM usa wa_chatid + wa_contactName)", () => {
    const c = normalizeChat(load("chat.json"));
    expect(c.chatId).toBe("5512900000000@s.whatsapp.net");
    expect(c.name).toBe("Cliente Exemplo");
  });
});

describe("UazapiClient.listMessages paginação", () => {
  it("segue paginando enquanto hasMore for true", async () => {
    const pages: unknown[] = [
      {
        messages: [
          { messageid: "1", chatid: "c@s.whatsapp.net", fromMe: false, sender: "c@s.whatsapp.net", senderName: "x", messageType: "Conversation", text: "oi", messageTimestamp: 1720000000000 },
        ],
        hasMore: true,
        nextOffset: 1,
      },
      { messages: [], hasMore: false },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => pages.shift() ?? { messages: [], hasMore: false },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new UazapiClient("http://x", "tok", 1); // pageSize 1
    const out: string[] = [];
    for await (const m of client.listMessages("c@s.whatsapp.net")) out.push(m.messageId);
    expect(out).toEqual(["1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter @workspace/scripts exec vitest run src/uazapi/client.test.ts`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 4: Implementar o client**

Create `scripts/src/uazapi/client.ts`:

```ts
import type { UazMessage, UazChat } from "./types";

// Endpoints confirmed against the live instance (2026-07-12). All uazapi
// coupling lives in this file; change only here if the instance version differs.
const CHAT_ENDPOINT = "/chat/find";
const MESSAGE_ENDPOINT = "/message/find";

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Only "@s.whatsapp.net" jids are real phone numbers. Group senders use "@lid"
// (WhatsApp linked-id) and group jids use "@g.us" — neither is a phone. Strips a
// device suffix ("558...:17@s.whatsapp.net") before extracting digits.
function phoneFromJid(jid: unknown): string | null {
  const s = str(jid);
  if (!s || !s.endsWith("@s.whatsapp.net")) return null;
  const local = (s.split("@")[0] ?? "").split(":")[0] ?? "";
  const digits = local.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function toMs(ts: unknown): number {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return 0;
  return n < 1_000_000_000_000 ? n * 1000 : n; // seconds → ms
}

// `quoted` is "" when absent, or a string/object carrying the quoted message id.
function normalizeQuoted(q: unknown): string | null {
  if (typeof q === "string") return q.length > 0 ? q : null;
  if (q && typeof q === "object") {
    const o = q as Record<string, unknown>;
    return str(o.messageid) ?? str(o.id);
  }
  return null;
}

export function normalizeMessage(raw: Record<string, unknown>): UazMessage {
  const content = (raw.content ?? {}) as Record<string, unknown>;
  return {
    messageId: str(raw.messageid) ?? "",
    chatId: str(raw.chatid) ?? "",
    chatName: null, // messages carry no chat name; the orchestrator fills it
    fromMe: raw.fromMe === true,
    senderPhone: phoneFromJid(raw.sender),
    senderName: str(raw.senderName),
    text: str(raw.text) ?? str(content.text),
    caption: str(content.caption) ?? str(raw.caption),
    mediaUrl: str(raw.fileURL),
    mediaMimeType: str(content.mimetype) ?? str(raw.mimetype),
    replyToMessageId: normalizeQuoted(raw.quoted),
    forwarded: raw.forwarded === true || raw.isForwarded === true,
    reaction: str(raw.reaction),
    reactedToMessageId: null,
    timestampMs: toMs(raw.messageTimestamp),
    rawType: str(raw.messageType) ?? "unknown",
    raw,
  };
}

export function normalizeChat(raw: Record<string, unknown>): UazChat {
  return {
    chatId: str(raw.wa_chatid) ?? str(raw.id) ?? "",
    name: str(raw.name) ?? str(raw.wa_contactName) ?? str(raw.phone) ?? null,
  };
}

async function postJson(
  base: string,
  token: string,
  endpoint: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const maxAttempts = 4;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers: { token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as Record<string, unknown>;
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, Math.min(15000, 500 * 2 ** attempt)));
      continue;
    }
    throw new Error(`uazapi ${endpoint} ${res.status}: ${await res.text()}`);
  }
}

export class UazapiClient {
  constructor(
    private readonly base: string,
    private readonly token: string,
    private readonly pageSize = 200,
  ) {}

  async *listChats(): AsyncIterable<UazChat> {
    let offset = 0;
    for (;;) {
      const payload = await postJson(this.base, this.token, CHAT_ENDPOINT, {
        operator: "AND",
        sort: "-wa_lastMsgTimestamp",
        limit: this.pageSize,
        offset,
      });
      const batch = (payload.chats ?? []) as Record<string, unknown>[];
      for (const c of batch) yield normalizeChat(c);
      offset += batch.length;
      const total = (payload.pagination as { totalRecords?: number } | undefined)?.totalRecords ?? 0;
      if (batch.length === 0 || offset >= total) return;
    }
  }

  async *listMessages(
    chatId: string,
    opts: { since?: number; limit?: number } = {},
  ): AsyncIterable<UazMessage> {
    let offset = 0;
    let yielded = 0;
    for (;;) {
      const payload = await postJson(this.base, this.token, MESSAGE_ENDPOINT, {
        chatid: chatId,
        sort: "-messageTimestamp",
        limit: this.pageSize,
        offset,
      });
      const batch = (payload.messages ?? []) as Record<string, unknown>[];
      for (const raw of batch) {
        const msg = normalizeMessage(raw);
        if (opts.since && msg.timestampMs < opts.since) return;
        yield msg;
        if (opts.limit && ++yielded >= opts.limit) return;
      }
      if (batch.length === 0 || payload.hasMore !== true) return;
      offset = (payload.nextOffset as number | undefined) ?? offset + batch.length;
    }
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter @workspace/scripts exec vitest run src/uazapi/client.test.ts`
Expected: PASS. (Se falhar por campos diferentes, ajuste `normalizeMessage`/`normalizeChat` e a fixture aos valores reais da sua instância.)

- [ ] **Step 6: Commit**

```bash
git add scripts/src/uazapi/client.ts scripts/src/uazapi/client.test.ts scripts/src/uazapi/fixtures/
git commit -m "feat(scripts): client uazapi (transporte + normalização) com fixture"
```

---

## Task 4: Orquestrador `import-uazapi` (build de insert + runImport)

**Files:**
- Create: `scripts/src/import-uazapi.ts`
- Create: `scripts/src/import-uazapi.test.ts`
- Modify: `scripts/package.json` (script `import-uazapi`)

**Interfaces:**
- Consumes: `UazapiClient` (`listChats`/`listMessages`), `mapMessage`, `WHATSAPP_COLUMNS` de `./uazapi/*`; `pool` de `@workspace/db`.
- Produces:
  - `function buildInsert(rows: WhatsappInsertRow[]): { text: string; values: unknown[] } | null`
  - `interface ImportDeps { listChats; listMessages; insertRows; owner; log?; chatLimit?; msgLimit?; since? }`
  - `function runImport(deps: ImportDeps): Promise<{ chats: number; seen: number; inserted: number }>`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `scripts/src/import-uazapi.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { buildInsert, runImport } from "./import-uazapi";
import { mapMessage } from "./uazapi/mapper";
import type { UazMessage } from "./uazapi/types";

const msg = (id: string): UazMessage => ({
  messageId: id,
  chatId: "5511999999999@s.whatsapp.net",
  chatName: "Fulano",
  fromMe: false,
  senderPhone: "5511999999999",
  senderName: "Fulano",
  text: "oi",
  caption: null,
  mediaUrl: null,
  mediaMimeType: null,
  replyToMessageId: null,
  forwarded: false,
  reaction: null,
  reactedToMessageId: null,
  timestampMs: 1_720_000_000_000,
  rawType: "conversation",
  raw: {},
});

describe("buildInsert", () => {
  it("gera SQL parametrizado com on conflict do nothing", () => {
    const rows = [mapMessage(msg("A"), "OWNER")!, mapMessage(msg("B"), "OWNER")!];
    const stmt = buildInsert(rows)!;
    expect(stmt.text).toContain("insert into whatsapp_messages");
    expect(stmt.text).toContain("on conflict (message_id) do nothing");
    expect(stmt.text).toContain("$46"); // 23 colunas * 2 linhas
    expect(stmt.values.length).toBe(46);
  });

  it("retorna null para lista vazia", () => {
    expect(buildInsert([])).toBeNull();
  });
});

describe("runImport", () => {
  it("percorre chats + mensagens, mapeia e insere em lote", async () => {
    const insertRows = vi.fn(async () => {});
    const result = await runImport({
      owner: "OWNER",
      listChats: async function* () {
        yield { chatId: "5511999999999@s.whatsapp.net", name: "Fulano" };
      },
      listMessages: async function* () {
        yield msg("A");
        yield msg("B");
      },
      insertRows,
    });
    expect(result).toEqual({ chats: 1, seen: 2, inserted: 2 });
    expect(insertRows).toHaveBeenCalledTimes(1);
  });

  it("descarta mensagens sem message_id", async () => {
    const insertRows = vi.fn(async () => {});
    const result = await runImport({
      owner: "OWNER",
      listChats: async function* () {
        yield { chatId: "5511999999999@s.whatsapp.net", name: "Fulano" };
      },
      listMessages: async function* () {
        yield msg("A");
        yield { ...msg(""), messageId: "" };
      },
      insertRows,
    });
    expect(result.seen).toBe(2);
    expect(result.inserted).toBe(1);
  });

  it("um chat que falha não aborta os demais", async () => {
    const insertRows = vi.fn(async () => {});
    const result = await runImport({
      owner: "OWNER",
      listChats: async function* () {
        yield { chatId: "BAD@s.whatsapp.net", name: "x" };
        yield { chatId: "5511999999999@s.whatsapp.net", name: "Fulano" };
      },
      listMessages: (chatId) =>
        (async function* () {
          if (chatId.startsWith("BAD")) throw new Error("boom");
          yield msg("A");
        })(),
      insertRows,
    });
    expect(result.chats).toBe(2);
    expect(result.inserted).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @workspace/scripts exec vitest run src/import-uazapi.test.ts`
Expected: FAIL — `Cannot find module './import-uazapi'`.

- [ ] **Step 3: Implementar o orquestrador**

Create `scripts/src/import-uazapi.ts`:

```ts
import { pool } from "@workspace/db";
import { UazapiClient } from "./uazapi/client";
import type { UazChat, UazMessage } from "./uazapi/types";
import { mapMessage, WHATSAPP_COLUMNS, type WhatsappInsertRow } from "./uazapi/mapper";

const BATCH = 500;

export function buildInsert(
  rows: WhatsappInsertRow[],
): { text: string; values: unknown[] } | null {
  if (rows.length === 0) return null;
  const cols = WHATSAPP_COLUMNS;
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const ph = cols.map((c) => {
      const v = row[c];
      values.push(c === "metadata" ? JSON.stringify(v) : v);
      return `$${values.length}`;
    });
    return `(${ph.join(",")})`;
  });
  const text =
    `insert into whatsapp_messages (${cols.join(",")}) values ` +
    `${tuples.join(",")} on conflict (message_id) do nothing`;
  return { text, values };
}

export interface ImportDeps {
  owner: string;
  listChats: () => AsyncIterable<UazChat>;
  listMessages: (chatId: string) => AsyncIterable<UazMessage>;
  insertRows: (rows: WhatsappInsertRow[]) => Promise<void>;
  log?: (msg: string) => void;
  msgLimit?: number;
}

export async function runImport(
  deps: ImportDeps,
): Promise<{ chats: number; seen: number; inserted: number }> {
  const log = deps.log ?? (() => {});
  let chats = 0;
  let seen = 0;
  let inserted = 0;
  let buffer: WhatsappInsertRow[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    await deps.insertRows(buffer);
    inserted += buffer.length;
    buffer = [];
  };

  for await (const chat of deps.listChats()) {
    chats++;
    let perChat = 0;
    // Resiliência: um chat que falha é logado e não aborta os demais (§7).
    try {
      for await (const m of deps.listMessages(chat.chatId)) {
        seen++;
        // Messages carry no chat display name; take it from the chat.
        const row = mapMessage(m.chatName ? m : { ...m, chatName: chat.name }, deps.owner);
        if (!row) continue;
        buffer.push(row);
        if (buffer.length >= BATCH) await flush();
        if (deps.msgLimit && ++perChat >= deps.msgLimit) break;
      }
    } catch (e) {
      log(`chat ${chat.chatId} falhou: ${(e as Error).message} — seguindo`);
    }
    log(`chat ${chat.chatId}: ${perChat} vistas nesta rodada (total ${seen})`);
  }
  await flush();
  return { chats, seen, inserted };
}

async function main(): Promise<void> {
  const base = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;
  const owner = process.env.WHATSAPP_OWNER;
  if (!base || !token) throw new Error("UAZAPI_BASE_URL e UAZAPI_TOKEN são obrigatórios.");
  if (!owner) throw new Error("WHATSAPP_OWNER é obrigatório.");

  const client = new UazapiClient(base, token);
  const chatLimit = Number(process.env.IMPORT_CHAT_LIMIT ?? Infinity);
  const msgLimit = process.env.IMPORT_MSG_LIMIT ? Number(process.env.IMPORT_MSG_LIMIT) : undefined;
  const since = process.env.IMPORT_SINCE ? Date.parse(process.env.IMPORT_SINCE) : undefined;

  let chatsDone = 0;
  const result = await runImport({
    owner,
    msgLimit,
    log: (m) => console.log(m),
    insertRows: async (rows) => {
      const stmt = buildInsert(rows);
      if (stmt) await pool.query(stmt.text, stmt.values);
    },
    listChats: async function* () {
      for await (const c of client.listChats()) {
        if (chatsDone++ >= chatLimit) return;
        yield c;
      }
    },
    listMessages: (chatId) => client.listMessages(chatId, { since, limit: msgLimit }),
  });

  console.log(
    `import-uazapi done: chats=${result.chats} seen=${result.seen} inserted(novas)=${result.inserted}`,
  );
  await pool.end();
}

// Only run main when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("import-uazapi.ts")) {
  void main();
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @workspace/scripts exec vitest run src/import-uazapi.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Registrar o script**

Modify `scripts/package.json`: add to `"scripts"`:

```json
"import-uazapi": "tsx ./src/import-uazapi.ts",
```

- [ ] **Step 6: Rodar a suíte inteira do pacote + typecheck**

Run:
```bash
pnpm --filter @workspace/scripts run test
pnpm --filter @workspace/scripts run typecheck
```
Expected: todos os testes PASS; typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add scripts/src/import-uazapi.ts scripts/src/import-uazapi.test.ts scripts/package.json
git commit -m "feat(scripts): orquestrador import-uazapi (upsert idempotente)"
```

---

## Task 5: Env + documentação de execução local

**Files:**
- Modify: `.env.example` (variáveis uazapi + nota Supabase local)
- Create: `docs/INSTALACAO-LOCAL-UAZAPI.md`

**Interfaces:**
- Consumes: nada (documentação).
- Produces: guia reproduzível de ponta a ponta.

- [ ] **Step 1: Adicionar variáveis ao `.env.example`**

Modify `.env.example` — acrescentar antes da seção "Apenas no Replit":

```bash
# ── Importação uazapi (rodar local) ──────────────────────────────────────────
# Base URL e token da sua instância uazapi. Usados por `import-uazapi`.
UAZAPI_BASE_URL=https://sua-instancia.uazapi.com
UAZAPI_TOKEN=seu-token-de-instancia
# Ajuste de importação (opcionais; use para pilotar barato):
# IMPORT_CHAT_LIMIT=    # nº máx. de chats a percorrer
# IMPORT_MSG_LIMIT=     # nº máx. de mensagens por chat
# IMPORT_SINCE=         # data mínima ISO, ex.: 2025-01-01
```

- [ ] **Step 2: Escrever o guia local**

Create `docs/INSTALACAO-LOCAL-UAZAPI.md`:

```markdown
# Rodar o Sinal local com importação via uazapi

Pré-requisitos: Node 24, pnpm, Docker (para o Supabase local), CLI do Supabase,
uma instância uazapi com número já conectado (token em mãos), chave OpenAI.

## 1. Subir o Supabase local
\`\`\`bash
supabase start
\`\`\`
Anote da saída: `API URL` (ex.: http://127.0.0.1:54321), `service_role key` e a
`DB URL` (postgresql://postgres:postgres@127.0.0.1:54322/postgres).

## 2. Configurar o .env
\`\`\`bash
cp .env.example .env
\`\`\`
Preencha:
- `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `SUPABASE_URL=http://127.0.0.1:54321`
- `SUPABASE_SERVICE_KEY=<service_role key da saída do supabase start>`
- `SESSION_SECRET=$(openssl rand -hex 32)`
- `WHATSAPP_OWNER=<seu número, ex.: 5511999999999>`
- `OPENAI_API_KEY=sk-...`
- `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`
- `PORT=8080`, `BASE_PATH=/`

Carregue no shell: \`set -a && source .env && set +a\`

## 3. Criar o mirror e as tabelas do app
\`\`\`bash
pnpm install
pnpm --filter @workspace/scripts run create-local-source
pnpm --filter @workspace/scripts run migrate
pnpm --filter @workspace/scripts run bootstrap-auth   # usa ADMIN_EMAIL/ADMIN_PASSWORD
\`\`\`

## 4. Importar do uazapi
Piloto (barato) primeiro:
\`\`\`bash
IMPORT_CHAT_LIMIT=3 IMPORT_MSG_LIMIT=50 pnpm --filter @workspace/scripts run import-uazapi
\`\`\`
Depois, tudo:
\`\`\`bash
pnpm --filter @workspace/scripts run import-uazapi
\`\`\`
Reexecutar a qualquer momento traz só o que ainda não veio (dedup por message_id).

## 5. Rodar os jobs de IA
> ⚠️ Custo OpenAI. Rode amostras antes do volume total.
\`\`\`bash
SAMPLE_SIZE=100 pnpm --filter @workspace/scripts run classify-sample
pnpm --filter @workspace/scripts run refresh-all
\`\`\`

## 6. Subir o app
Em dois terminais (cada um com o env carregado):
\`\`\`bash
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/sinal-web run dev
\`\`\`
Abra http://localhost:5173 e entre com ADMIN_EMAIL / ADMIN_PASSWORD.

## Reimportar (incremental)
Rode o passo 4 e depois `refresh-all` de novo. Só mensagens novas entram.
\`\`\`
```

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/INSTALACAO-LOCAL-UAZAPI.md
git commit -m "docs: guia de execução local + variáveis de importação uazapi"
```

---

## Notas de verificação final (rodar após todas as tasks)

- [ ] `pnpm run typecheck` na raiz — sem erros.
- [ ] `pnpm --filter @workspace/scripts run test` — todos verdes.
- [ ] Fluxo manual: `create-local-source` → `migrate` → `bootstrap-auth` →
  `import-uazapi` (piloto) → conferir linhas em `whatsapp_messages` com
  `psql "$SUPABASE_DB_URL" -c "select chat_type, count(*) from whatsapp_messages group by 1;"`.
- [ ] `refresh-all` (amostra) → abrir o dashboard e confirmar que Visão Geral,
  Privado, Grupos e Mídia mostram dados (Mídia depende de `metadata.raw_type`).
