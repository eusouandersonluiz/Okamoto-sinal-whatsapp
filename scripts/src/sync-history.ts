import { UazapiClient } from "./uazapi/client";

// Requests older history from WhatsApp per group, going backward from the oldest
// known message, round by round, until the oldest stops receding (WhatsApp gave
// all it will) or maxRounds is hit. Delivery is async, so each round waits before
// re-checking. Fills the uazapi store; run `import-uazapi` afterwards to persist.
//
// Env: SYNC_CHAT_LIMIT (max groups), SYNC_MAX_ROUNDS (default 4),
//      SYNC_COUNT (msgs per request, default 200), SYNC_WAIT_MS (default 15000).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const base = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;
  if (!base || !token) throw new Error("UAZAPI_BASE_URL e UAZAPI_TOKEN são obrigatórios.");

  const client = new UazapiClient(base, token);
  const chatLimit = Number(process.env.SYNC_CHAT_LIMIT ?? Infinity);
  const maxRounds = Number(process.env.SYNC_MAX_ROUNDS ?? 4);
  const count = Number(process.env.SYNC_COUNT ?? 200);
  const waitMs = Number(process.env.SYNC_WAIT_MS ?? 15000);

  let groups = 0;
  let recedeRounds = 0;
  for await (const g of client.listGroups()) {
    if (groups++ >= chatLimit) break;
    let oldest = await client.oldestMessage(g.chatId);
    if (!oldest || !oldest.messageId) {
      console.log(`grupo ${g.chatId}: sem mensagem-âncora — pulando`);
      continue;
    }
    for (let round = 0; round < maxRounds; round++) {
      const beforeTs = oldest.timestampMs;
      try {
        await client.requestHistorySync(g.chatId, oldest.messageId, count);
      } catch (e) {
        console.log(`grupo ${g.chatId}: history-sync falhou: ${(e as Error).message} — seguindo`);
        break;
      }
      await sleep(waitMs);
      const now = await client.oldestMessage(g.chatId);
      if (!now || now.timestampMs >= beforeTs) break; // não recuou → esgotou
      recedeRounds++;
      oldest = now;
      console.log(`grupo ${g.chatId}: recuou p/ ${new Date(oldest.timestampMs).toISOString()}`);
    }
  }
  console.log(`sync-history: ${groups} grupos processados, ${recedeRounds} rodadas com ganho`);
}

if (process.argv[1] && process.argv[1].endsWith("sync-history.ts")) {
  void main();
}
