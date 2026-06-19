import OpenAI from "openai";
import { CLASSIFY_MODEL } from "./classify";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required.");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export const MENTION_TYPES = [
  "elogio",
  "crítica",
  "objeção",
  "recomendação",
  "lead",
  "indireta",
  "neutra",
] as const;
export type MentionType = (typeof MENTION_TYPES)[number];

export interface MentionInput {
  messageId: string;
  text: string;
}

export interface MentionResult {
  messageId: string;
  isMention: boolean;
  mentionType: MentionType;
  sentiment: "positivo" | "neutro" | "negativo";
}

function systemPrompt(entityName: string): string {
  return `Você analisa menções a "${entityName}" em mensagens de WhatsApp (grupos e privado). Para CADA mensagem, decida se ela é uma menção GENUÍNA a "${entityName}" (a pessoa/marca), e classifique o tipo.

"is_mention": true apenas se a mensagem realmente fala SOBRE "${entityName}" (não apenas dirige uma mensagem a ele em conversa trivial). Saudações triviais não contam.

"mention_type" (escolha EXATAMENTE um):
- "elogio": elogio/admiração a ${entityName} ou seu trabalho.
- "crítica": crítica negativa.
- "objeção": dúvida/objeção sobre preço, valor ou produto ("vale a pena?", "é caro").
- "recomendação": alguém recomendando ${entityName} para outra pessoa (venda orgânica).
- "lead": alguém demonstrando interesse em comprar/contratar.
- "indireta": mencionado de passagem, contexto neutro.
- "neutra": menção sem carga clara.

"sentiment": "positivo", "neutro" ou "negativo".
Responda SEMPRE em português.`;
}

function schema() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "mention_batch",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                message_id: { type: "string" },
                is_mention: { type: "boolean" },
                mention_type: { type: "string", enum: [...MENTION_TYPES] },
                sentiment: {
                  type: "string",
                  enum: ["positivo", "neutro", "negativo"],
                },
              },
              required: [
                "message_id",
                "is_mention",
                "mention_type",
                "sentiment",
              ],
            },
          },
        },
        required: ["results"],
      },
    },
  };
}

/** Classify a batch of candidate messages that contain an entity alias. */
export async function classifyMentions(
  entityName: string,
  inputs: MentionInput[],
): Promise<MentionResult[]> {
  if (inputs.length === 0) return [];
  const payload = inputs.map((m) => ({
    message_id: m.messageId,
    text: m.text.slice(0, 2000),
  }));
  const completion = await getClient().chat.completions.create({
    model: CLASSIFY_MODEL,
    temperature: 0,
    response_format: schema(),
    messages: [
      { role: "system", content: systemPrompt(entityName) },
      {
        role: "user",
        content:
          "Analise cada mensagem abaixo. Um resultado por mensagem, preservando message_id.\n\n" +
          JSON.stringify(payload),
      },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content)
    throw new Error("Empty completion from OpenAI (classifyMentions).");
  const parsed = JSON.parse(content) as {
    results: {
      message_id: string;
      is_mention: boolean;
      mention_type: MentionType;
      sentiment: "positivo" | "neutro" | "negativo";
    }[];
  };
  return parsed.results.map((r) => ({
    messageId: r.message_id,
    isMention: r.is_mention,
    mentionType: r.mention_type,
    sentiment: r.sentiment,
  }));
}
