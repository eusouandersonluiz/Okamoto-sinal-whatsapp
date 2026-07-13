import { useState } from "react";
import {
  useGroups,
  usePatchGroup,
  useArchiveGroup,
  type GroupRow,
  type GroupInclude,
} from "@/lib/api";

const FILTERS: { key: GroupInclude; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "archived", label: "Arquivados" },
  { key: "all", label: "Todos" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function GroupCard({ g }: { g: GroupRow }) {
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState(g.alias ?? "");
  const [category, setCategory] = useState(g.category ?? "");
  const [tagsText, setTagsText] = useState((g.tags ?? []).join(", "));
  const patch = usePatchGroup();
  const archive = useArchiveGroup();

  const ignored = g.relevance === "ignored";
  const archived = !!g.archived_at;

  const save = () => {
    patch.mutate({
      chatId: g.chat_id,
      patch: {
        alias: alias.trim() || null,
        category: category.trim() || null,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      },
    });
    setOpen(false);
  };

  return (
    <div className="rounded-xl border border-[#22222A] bg-[#111114] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#ECECF1] truncate">{g.name ?? "(sem nome)"}</span>
            {ignored && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A2A33] text-[#8C8C99]">ignorado</span>}
            {archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3A2A1A] text-[#C9A16A]">arquivado</span>}
          </div>
          <div className="text-xs text-[#8C8C99] mt-1 font-mono">
            {g.message_count} msgs · última atividade {fmtDate(g.last_activity_at)}
          </div>
          {g.category && <div className="text-xs text-[#35E0D8] mt-1">{g.category}</div>}
          {g.tags && g.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {g.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A20] text-[#B7B7C2]">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={() =>
              patch.mutate({ chatId: g.chat_id, patch: { relevance: ignored ? "monitored" : "ignored" } })
            }
            className="text-xs px-2 py-1 rounded border border-[#2A2A33] text-[#B7B7C2] hover:bg-[#1A1A20]"
          >
            {ignored ? "Monitorar" : "Ignorar"}
          </button>
          <button
            onClick={() => archive.mutate({ chatId: g.chat_id, archived: !archived })}
            className="text-xs px-2 py-1 rounded border border-[#2A2A33] text-[#B7B7C2] hover:bg-[#1A1A20]"
          >
            {archived ? "Desarquivar" : "Arquivar"}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-2 py-1 rounded text-[#35E0D8] hover:underline"
          >
            {open ? "Fechar" : "Gerenciar"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-[#22222A] grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-[#8C8C99]">
            Apelido
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={g.raw_name ?? ""}
              className="mt-1 w-full bg-[#0A0A0C] border border-[#2A2A33] rounded px-2 py-1 text-sm text-[#ECECF1]"
            />
          </label>
          <label className="text-xs text-[#8C8C99]">
            Categoria
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full bg-[#0A0A0C] border border-[#2A2A33] rounded px-2 py-1 text-sm text-[#ECECF1]"
            />
          </label>
          <label className="text-xs text-[#8C8C99] sm:col-span-2">
            Tags (separadas por vírgula)
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="mt-1 w-full bg-[#0A0A0C] border border-[#2A2A33] rounded px-2 py-1 text-sm text-[#ECECF1]"
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <span className="text-xs text-[#8C8C99]">Digest:</span>
            <button
              onClick={() =>
                patch.mutate({ chatId: g.chat_id, patch: { digestEnabled: !g.digest_enabled } })
              }
              className="text-xs px-2 py-1 rounded border border-[#2A2A33] text-[#B7B7C2] hover:bg-[#1A1A20]"
            >
              {g.digest_enabled ? "Ligado" : "Desligado"}
            </button>
            {(["daily", "weekly"] as const).map((c) => (
              <button
                key={c}
                onClick={() => patch.mutate({ chatId: g.chat_id, patch: { digestCadence: c } })}
                className={`text-xs px-2 py-1 rounded border ${
                  g.digest_cadence === c
                    ? "border-[#35E0D8] text-[#35E0D8]"
                    : "border-[#2A2A33] text-[#B7B7C2] hover:bg-[#1A1A20]"
                }`}
              >
                {c === "daily" ? "Diário" : "Semanal"}
              </button>
            ))}
            <button
              onClick={save}
              className="ml-auto text-xs px-3 py-1 rounded bg-[#35E0D8] text-[#06201e] font-medium"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Grupos() {
  const [filter, setFilter] = useState<GroupInclude>("active");
  const { data: groups, isLoading } = useGroups(filter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-semibold text-2xl text-[#ECECF1]">Grupos</h1>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded ${
                filter === f.key
                  ? "bg-[#1A1A20] text-[#35E0D8]"
                  : "text-[#8C8C99] hover:text-[#ECECF1]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[#8C8C99] font-mono">Carregando grupos...</p>
      ) : !groups || groups.length === 0 ? (
        <p className="text-sm text-[#8C8C99]">Nenhum grupo. Rode a importação (roster do uazapi).</p>
      ) : (
        <>
          <p className="text-xs text-[#8C8C99] mb-3 font-mono">{groups.length} grupos</p>
          <div className="grid gap-3">
            {groups.map((g) => (
              <GroupCard key={g.chat_id} g={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
