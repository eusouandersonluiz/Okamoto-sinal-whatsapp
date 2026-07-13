import { useRoute, useLocation } from "wouter";
import { useGroupMessages, useGroupParticipants, useGroups } from "@/lib/api";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

function mediaLabel(mime: string | null): string {
  if (!mime) return "[mídia]";
  if (mime.startsWith("image/")) return "[imagem]";
  if (mime.startsWith("audio/")) return "[áudio]";
  if (mime.startsWith("video/")) return "[vídeo]";
  return "[arquivo]";
}

export default function GrupoDetalhe() {
  const [, params] = useRoute("/grupos/:chatId");
  const chatId = params?.chatId;
  const [, setLocation] = useLocation();

  const { data: groups } = useGroups("all");
  const group = groups?.find((g) => g.chat_id === chatId);
  const { data: participants } = useGroupParticipants(chatId);
  const q = useGroupMessages(chatId);

  // Pages come newest-first; flatten then reverse for chronological display.
  const flat = (q.data?.pages ?? []).flatMap((p) => p.messages);
  const chronological = [...flat].reverse();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => setLocation("/grupos")} className="text-xs text-[#35E0D8] hover:underline mb-3">
        ← Grupos
      </button>
      <h1 className="font-display font-semibold text-2xl text-[#ECECF1]">
        {group?.name ?? "Grupo"}
      </h1>
      <p className="text-xs text-[#8C8C99] font-mono mt-1 mb-5">
        {group?.participants ?? participants?.length ?? 0} participantes · {group?.message_count ?? 0} mensagens
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Timeline */}
        <section>
          <h2 className="text-sm font-medium text-[#ECECF1] mb-2">Linha do tempo</h2>
          {q.hasNextPage && (
            <button
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
              className="w-full text-xs px-3 py-2 mb-2 rounded border border-[#2A2A33] text-[#B7B7C2] hover:bg-[#1A1A20]"
            >
              {q.isFetchingNextPage ? "Carregando..." : "Carregar mensagens mais antigas"}
            </button>
          )}
          {q.isLoading ? (
            <p className="text-sm text-[#8C8C99] font-mono">Carregando...</p>
          ) : chronological.length === 0 ? (
            <p className="text-sm text-[#8C8C99]">Sem mensagens importadas para este grupo.</p>
          ) : (
            <div className="grid gap-2">
              {chronological.map((m) => {
                const out = m.direction === "outbound";
                return (
                  <div
                    key={m.message_id}
                    className={`rounded-lg border border-[#22222A] px-3 py-2 ${out ? "bg-[#12201F]" : "bg-[#111114]"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[#B7B7C2] truncate">
                        {out ? "Você" : (m.sender_name ?? "—")}
                      </span>
                      <span className="text-[10px] text-[#6C6A74] font-mono shrink-0">
                        {fmtDateTime(m.message_created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-[#ECECF1] whitespace-pre-wrap break-words">
                      {m.text ??
                        (m.media_url ? (
                          <a href={m.media_url} target="_blank" rel="noreferrer" className="text-[#35E0D8] hover:underline">
                            {mediaLabel(m.media_mime_type)}
                          </a>
                        ) : (
                          <span className="text-[#6C6A74]">[sem texto]</span>
                        ))}
                    </div>
                    {m.reaction && <div className="text-xs mt-0.5">{m.reaction}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Participants */}
        <section>
          <h2 className="text-sm font-medium text-[#ECECF1] mb-2">Participantes</h2>
          <div className="grid gap-1">
            {(!participants || participants.length === 0) && (
              <p className="text-sm text-[#8C8C99]">Sem participantes. Rode a importação.</p>
            )}
            {(participants ?? []).map((p) => (
              <div key={p.lid} className="rounded-lg border border-[#22222A] bg-[#111114] px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-[#ECECF1] truncate">{p.name ?? p.phone ?? "—"}</span>
                  {p.is_admin && <span className="text-[10px] px-1 rounded bg-[#12201F] text-[#35E0D8]">admin</span>}
                </div>
                <div className="text-[11px] text-[#8C8C99] font-mono">{p.phone ?? "sem telefone"}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
