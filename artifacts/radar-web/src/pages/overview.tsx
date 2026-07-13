import { useLocation } from "wouter";
import { useGroups, useGroupTopics } from "@/lib/api";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#22222A] bg-[#111114] p-4">
      <div className="text-xs text-[#8C8C99] uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-display font-semibold text-[#ECECF1] mt-1">{value}</div>
    </div>
  );
}

export default function Overview() {
  const [, setLocation] = useLocation();
  const { data: groups, isLoading } = useGroups("active");
  const { data: pautas } = useGroupTopics(30);

  const monitored = groups?.length ?? 0;
  const totalMsgs = (groups ?? []).reduce((s, g) => s + (g.message_count ?? 0), 0);
  const topGroups = [...(groups ?? [])].sort((a, b) => b.message_count - a.message_count).slice(0, 8);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-display font-semibold text-2xl text-[#ECECF1] mb-4">Dashboard de grupos</h1>

      {isLoading ? (
        <p className="text-sm text-[#8C8C99] font-mono">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <Kpi label="Grupos monitorados" value={monitored} />
            <Kpi label="Mensagens (total)" value={totalMsgs.toLocaleString("pt-BR")} />
            <Kpi label="Pautas quentes (30d)" value={pautas?.length ?? 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-[#ECECF1]">Grupos mais ativos</h2>
                <button onClick={() => setLocation("/grupos")} className="text-xs text-[#35E0D8] hover:underline">
                  ver todos
                </button>
              </div>
              <div className="grid gap-2">
                {topGroups.length === 0 && (
                  <p className="text-sm text-[#8C8C99]">Nenhum grupo. Rode a importação.</p>
                )}
                {topGroups.map((g) => (
                  <button
                    key={g.chat_id}
                    onClick={() => setLocation("/grupos")}
                    className="text-left rounded-lg border border-[#22222A] bg-[#111114] px-3 py-2 hover:bg-[#16161B]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[#ECECF1] truncate">{g.name ?? "(sem nome)"}</span>
                      <span className="text-xs text-[#8C8C99] font-mono shrink-0">{g.message_count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium text-[#ECECF1] mb-2">Pautas quentes</h2>
              <div className="grid gap-2">
                {(!pautas || pautas.length === 0) && (
                  <p className="text-sm text-[#8C8C99]">Sem pautas ainda. Rode o refresh (classificação + pautas).</p>
                )}
                {(pautas ?? []).slice(0, 10).map((p) => (
                  <div
                    key={p.topic}
                    className="rounded-lg border border-[#22222A] bg-[#111114] px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-[#ECECF1] truncate">{p.topic}</span>
                    <span className="text-xs text-[#8C8C99] font-mono shrink-0">
                      {p.count} · {p.group_count} grupos
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
