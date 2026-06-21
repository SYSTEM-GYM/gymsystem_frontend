"use client";

import { useState, useTransition } from "react";
import { assignWorkoutSchedule } from "@/app/dashboard/settings/workout-actions";
import { dayLabel } from "@/lib/workout-utils";

type Collection = { id: string; name: string };
type Schedule = {
  id: string;
  schedule_type: string;
  day_of_week: number | null;
  session_label: string | null;
  collection: { name: string } | null;
};

type ExecutionLog = {
  id: string;
  logged_at: string;
  weight_kg: number | null;
  reps_done: number | null;
  sets_completed: number | null;
  exercise: { title: string } | null;
};

type Props = {
  userId: string;
  collections: Collection[];
  schedules: Schedule[];
  executionLogs: ExecutionLog[];
};

export function MemberWorkoutPanel({
  userId,
  collections,
  schedules,
  executionLogs,
}: Props) {
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  const [scheduleType, setScheduleType] = useState<"weekly" | "session" | "custom">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!collectionId) return;
    startTransition(async () => {
      const result = await assignWorkoutSchedule({
        userId,
        collectionId,
        scheduleType,
        dayOfWeek: scheduleType === "weekly" ? dayOfWeek : undefined,
      });
      setMsg(result.ok ? "Cronograma atribuído." : (result.message ?? "Erro."));
    });
  }

  const selectCls =
    "w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white mb-3">Atribuir Treino</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className={selectCls}>
            <option value="">Selecione a coleção...</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as typeof scheduleType)}
            className={selectCls}
          >
            <option value="weekly">Semanal (por dia)</option>
            <option value="session">Sessão A/B/C</option>
            <option value="custom">Personalizado</option>
          </select>
          {scheduleType === "weekly" && (
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
              className={selectCls}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i}>{dayLabel(i)}</option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={handleAssign}
          disabled={!collectionId || pending}
          className="mt-3 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40"
        >
          {pending ? "Atribuindo..." : "Atribuir ao Aluno"}
        </button>
        {msg && <p className="text-xs text-primary mt-2">{msg}</p>}
      </div>

      {schedules.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-2">Cronogramas Ativos</h3>
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li key={s.id} className="text-xs text-zinc-400 bg-surface-2 rounded-xl px-3 py-2">
                {s.collection?.name ?? "Coleção"} — {s.schedule_type}
                {s.day_of_week != null && ` (${dayLabel(s.day_of_week)})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-white mb-2">Histórico de Execução</h3>
        {executionLogs.length === 0 ? (
          <p className="text-xs text-zinc-600">Nenhum registro ainda.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {executionLogs.map((log) => (
              <li key={log.id} className="text-xs text-zinc-400 flex justify-between gap-2">
                <span>{log.exercise?.title ?? "Exercício"}</span>
                <span className="tabular-nums text-zinc-600">
                  {log.weight_kg != null && `${log.weight_kg}kg · `}
                  {log.sets_completed ?? "?"}×{log.reps_done ?? "?"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
