# Radar Stark

**Inteligência de grupos de WhatsApp.** O Radar Stark transforma um grande arquivo
de mensagens de grupos de WhatsApp (já armazenadas no Supabase) em um cockpit de
análise e gerenciamento de grupos — o que está em alta, digests por grupo e
controle do que é monitorado — tudo em português do Brasil. Um radar que separa o
*sinal* do *ruído*.

> Projeto original de **Bruno Okamoto**.
> Projeto **gratuito e open source** sob licença [MIT](LICENSE): qualquer pessoa
> pode visualizar o que acontece no seu WhatsApp, clonar, instalar com as próprias
> credenciais e adaptar como quiser. Use como base para criar a sua versão.

> ### ⚠️ Não existe integração ao vivo com o WhatsApp
> O Radar Stark **apenas lê** dados. As mensagens são **pré-carregadas em uma tabela
> read-only do Supabase** (`whatsapp_messages`); o app lê essa tabela e a
> enriquece com IA. **Não há telefone para conectar, nenhuma API do WhatsApp e
> nada nunca é enviado.** Para usar o Radar Stark você traz os seus próprios dados de
> mensagens para o Supabase — veja [Fonte de dados](#fonte-de-dados). Agir no
> WhatsApp continua sendo papel de um humano.

## Funcionalidades

Produto focado em **grupos**, sobre o princípio *"nenhum número é beco sem
saída"*: toda métrica permite abrir as mensagens de origem.

- **Dashboard de grupos** — KPIs (grupos monitorados, volume), grupos mais ativos
  e pautas quentes.
- **Grupos** — lista de todos os grupos (roster completo importado do WhatsApp) com
  digests por grupo e **gerenciamento**: marcar monitorado/ignorado, categoria,
  tags, apelido, cadência de digest e arquivar.
- **Pautas** — temas (*topics*) que cruzam grupos.
- **Mídia** — mídia proveniente das mensagens de grupos.

## Stack

- **Monorepo:** Bun workspaces, TypeScript 5.9
- **API:** Express 5 (rotas escritas à mão, sessão por cookie)
- **Banco de dados:** Supabase PostgreSQL + Drizzle ORM
- **IA:** OpenAI (direto), com OpenRouter opcional para execuções em massa mais
  baratas
- **Frontend:** React + Vite + Tailwind v4 + shadcn/ui + React Query + wouter + recharts

## Arquitetura em um relance

```
Supabase  ──►  Jobs de IA       ──►  tabelas do app    ──►  Servidor API  ──►  React
whatsapp_messages   (scripts +       (topics, groups,     (Express,        frontend
(read-only)          lib/ai)          enrichment…)         leituras com     (/api)
                                                            escopo)
```

Um monorepo Bun com três grupos de nível superior:

- **`lib/*`** — bibliotecas compartilhadas: `db` (schema Drizzle + pool +
  migrations), `ai` (classificação, clustering de tópicos, taxonomia) e os pacotes
  de cliente/spec/zod da API.
- **`artifacts/*`** — apps publicáveis: `api-server` (Express) e `radar-web`
  (React/Vite). `mockup-sandbox` guarda referências estáticas de design e
  `radar-deck` é a apresentação do projeto.
- **`scripts/*`** — jobs de dados e IA (migrations, bootstrap de auth, backfills,
  construtores de tópicos/pautas de grupo).

Detalhes completos em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Início rápido

Você precisa do **Bun**, mais um projeto **Supabase** e uma
**chave de API da OpenAI**.

```bash
bun install
cp .env.example .env        # depois preencha os valores
set -a && source .env && set +a

bun run --filter @workspace/scripts migrate          # cria as tabelas do app
bun run --filter @workspace/scripts bootstrap-auth   # cria seu login de admin

# em dois terminais (cada um com o env carregado):
PORT=8080 bun run --filter @workspace/api-server dev
PORT=5173 BASE_PATH=/ bun run --filter @workspace/radar-web dev
```

O servidor de desenvolvimento web faz proxy de `/api` para o servidor de API,
então, com os dois no ar, você abre `http://localhost:5173` e tudo funciona
localmente. O passo a passo completo — variáveis de ambiente, configuração do
Supabase e os jobs de IA — está em **[docs/INSTALACAO.md](docs/INSTALACAO.md)**.

## Deploy (Docker)

Para produção (ex.: VPS), o app roda como um único contêiner Bun: o servidor de
API serve os assets do front buildado na mesma origem.

```bash
cp .env.example .env        # preencha os segredos (Supabase, OpenAI, etc.)
docker compose up --build   # builda a imagem e sobe na porta 8080
```

O `Dockerfile` é multi-stage (build com `bun install` + `vite build`; runtime
`oven/bun` servindo `api/index.mjs` com `WEB_DIST` apontando para o front).

## Documentação

- **[docs/INSTALACAO.md](docs/INSTALACAO.md)** — pré-requisitos, instalação passo
  a passo, todas as APIs/serviços externos e como obter cada credencial, e como
  rodar os jobs de dados/IA.
- **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)** — estrutura do monorepo, rotas
  da API, páginas do frontend, lógica de IA e o pipeline de refresh.
- **[docs/SUPABASE.md](docs/SUPABASE.md)** — como funciona a conexão com o
  Supabase (pooler, SSL), a tabela read-only `whatsapp_messages`, o modelo
  multi-tenant + RLS e a estrutura de todas as tabelas do projeto.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — como contribuir.

## Fonte de dados

O Radar Stark lê uma única tabela read-only, `whatsapp_messages`, no seu banco
Supabase. O app nunca escreve nela. Para trazer seus próprios dados, carregue
linhas com este formato (colunas de texto, salvo indicação):

| Coluna | Observações |
| --- | --- |
| `id` (bigint) | id da linha |
| `whatsapp_owner` | precisa bater com a variável de ambiente `WHATSAPP_OWNER` |
| `chat_type` | ex.: privado vs grupo |
| `chat_id` | para DMs, o telefone do parceiro; a chave da conversa |
| `chat_name` | nome da conversa / contato |
| `contact_phone` | vazio para DMs |
| `sender_phone`, `sender_name` | autor da mensagem |
| `recipient_phone`, `direction` | roteamento / entrada-saída |
| `message_type`, `message`, `caption` | conteúdo |
| `media_url`, `media_mime_type`, `transcription` | mídia + transcrição |
| `message_id` | único; a chave de junção de todo o enriquecimento |
| `reply_to_message_id`, `forwarded`, `reaction`, `reacted_to_message_id` | threading/reações |
| `status` | status de entrega |
| `message_created_at` (timestamptz) | horário da mensagem |
| `metadata` (jsonb) | extras específicos da origem |

Tudo o que o Radar Stark calcula (tópicos/pautas, grupos, enriquecimento) vive em
tabelas separadas, próprias do app, criadas pelas migrations e ligadas por
`message_id`. A tabela de origem nunca é modificada.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Em resumo: `bun install`, rode
`bun run typecheck`, crie um branch e abra um PR. Nunca commite `.env` ou
segredos.

## Licença

[MIT](LICENSE) © 2026 Bruno Okamoto (Pixel Educação).
