# Rodar o Sinal local com importação via uazapi

Pré-requisitos: Node 24, pnpm, Docker (para o Supabase local), CLI do Supabase,
uma instância uazapi com número já conectado (token em mãos), chave OpenAI.

## 1. Subir o Supabase local

```bash
supabase start
```

Anote da saída: `API URL` (ex.: http://127.0.0.1:54321), `service_role key` e a
`DB URL` (postgresql://postgres:postgres@127.0.0.1:54322/postgres).

## 2. Configurar o .env

```bash
cp .env.example .env
```

Preencha:
- `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `SUPABASE_URL=http://127.0.0.1:54321`
- `SUPABASE_SERVICE_KEY=<service_role key da saída do supabase start>`
- `SESSION_SECRET=$(openssl rand -hex 32)`
- `WHATSAPP_OWNER=<seu número, ex.: 5511999999999>`
- `OPENAI_API_KEY=sk-...`
- `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`
- `PORT=8080`, `BASE_PATH=/`

Carregue no shell: `set -a && source .env && set +a`

## 3. Criar o mirror e as tabelas do app

```bash
pnpm install
pnpm --filter @workspace/scripts run create-local-source
pnpm --filter @workspace/scripts run migrate
pnpm --filter @workspace/scripts run bootstrap-auth   # usa ADMIN_EMAIL/ADMIN_PASSWORD
```

## 4. Importar do uazapi

Piloto (barato) primeiro:

```bash
IMPORT_CHAT_LIMIT=3 IMPORT_MSG_LIMIT=50 pnpm --filter @workspace/scripts run import-uazapi
```

Depois, tudo:

```bash
pnpm --filter @workspace/scripts run import-uazapi
```

Reexecutar a qualquer momento traz só o que ainda não veio (dedup por message_id).

## 5. Rodar os jobs de IA

> ⚠️ Custo OpenAI. Rode amostras antes do volume total.

```bash
SAMPLE_SIZE=100 pnpm --filter @workspace/scripts run classify-sample
pnpm --filter @workspace/scripts run refresh-all
```

## 6. Subir o app

Em dois terminais (cada um com o env carregado):

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/sinal-web run dev
```

Abra http://localhost:5173 e entre com ADMIN_EMAIL / ADMIN_PASSWORD.

## Reimportar (incremental)

Rode o passo 4 e depois `refresh-all` de novo. Só mensagens novas entram.
