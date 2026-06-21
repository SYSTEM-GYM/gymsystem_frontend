"use client";

import { useState, useTransition, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  ClockIcon,
  ChevronDownIcon,
  TrashIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import {
  assignWorkoutSchedule,
  unassignWorkoutSchedule,
} from "@/app/dashboard/settings/workout-actions";
import { dayLabel } from "@/lib/workout-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type CollectionExercise = {
  sort_order: number;
  default_sets: number;
  default_reps: number;
  exercise: { id: string; title: string; translated_name: string | null } | null;
};

type Collection = {
  id: string;
  name: string;
  description: string | null;
  estimated_duration_minutes: number;
  exercises: CollectionExercise[];
};

type Schedule = {
  id: string;
  schedule_type: string;
  day_of_week: number | null;
  session_label: string | null;
  created_at: string | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  session: "Sessão A/B/C",
  custom: "Personalizado",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Collection Card ───────────────────────────────────────────────────────────

function CollectionCard({
  collection,
  userId,
  onAssigned,
}: {
  collection: Collection;
  userId: string;
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [scheduleType, setScheduleType] = useState<"weekly" | "session" | "custom">("session");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    startTransition(async () => {
      const result = await assignWorkoutSchedule({
        userId,
        collectionId: collection.id,
        scheduleType,
        dayOfWeek: scheduleType === "weekly" ? dayOfWeek : undefined,
      });
      if (result.ok) {
        setMsg({ ok: true, text: "Treino atribuído com sucesso!" });
        setAssigning(false);
        setTimeout(() => {
          setMsg(null);
          onAssigned();
        }, 1200);
      } else {
        setMsg({ ok: false, text: result.message ?? "Erro ao atribuir." });
      }
    });
  }

  const inputCls =
    "bg-surface-1 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40";

  return (
    <div className="bg-surface-2/60 border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors">
      {/* Card header */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm leading-snug">{collection.name}</p>
            {collection.description && (
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{collection.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            ~{collection.estimated_duration_minutes} min
          </span>
          <span className="flex items-center gap-1">
            <ClipboardDocumentListIcon className="w-3 h-3" />
            {collection.exercises.length} exercício{collection.exercises.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Success message */}
        {msg?.ok && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <CheckIcon className="w-3.5 h-3.5" />
            {msg.text}
          </div>
        )}
        {msg && !msg.ok && (
          <p className="text-xs text-danger">{msg.text}</p>
        )}
      </div>

      {/* Espiar Treino accordion */}
      <div className="border-t border-white/5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <span>Espiar Treino</span>
          <ChevronDownIcon
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="px-4 pb-3 space-y-1.5">
            {collection.exercises.length === 0 ? (
              <p className="text-xs text-zinc-600 py-2">Nenhum exercício nesta coleção.</p>
            ) : (
              collection.exercises.map((ce, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-zinc-300 flex-1 min-w-0 truncate">
                    {idx + 1}. {ce.exercise?.translated_name || ce.exercise?.title || "—"}
                  </span>
                  <span className="text-[10px] text-zinc-600 flex-shrink-0 tabular-nums">
                    {ce.default_sets}×{ce.default_reps}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Assign section */}
      <div className="border-t border-white/5 p-3 space-y-2">
        {!assigning ? (
          <button
            type="button"
            onClick={() => setAssigning(true)}
            disabled={pending}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary text-black hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            Atribuir ao Aluno
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as typeof scheduleType)}
                className={inputCls}
              >
                <option value="session">Sessão A/B/C</option>
                <option value="weekly">Dia da semana</option>
                <option value="custom">Personalizado</option>
              </select>
              {scheduleType === "weekly" && (
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                  className={inputCls}
                >
                  {Array.from({ length: 7 }, (_, i) => (
                    <option key={i} value={i}>{dayLabel(i)}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAssigning(false); setMsg(null); }}
                disabled={pending}
                className="flex-1 py-2 rounded-xl text-xs text-zinc-400 border border-white/10 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={pending}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-black disabled:opacity-40 transition-opacity"
              >
                {pending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active Schedule Card ──────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onRemoved,
}: {
  schedule: Schedule;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    startTransition(async () => {
      const result = await unassignWorkoutSchedule(schedule.id);
      if (result.ok) {
        onRemoved();
      } else {
        setError(result.message ?? "Erro ao remover.");
      }
    });
  }

  const typeLabel = SCHEDULE_TYPE_LABELS[schedule.schedule_type] ?? schedule.schedule_type;
  const dayStr = schedule.day_of_week != null ? ` · ${dayLabel(schedule.day_of_week)}` : "";

  return (
    <div className="flex items-center gap-3 p-4 bg-surface-2 border border-white/5 rounded-2xl">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <ClipboardDocumentListIcon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {schedule.collection?.name ?? "Coleção"}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {typeLabel}{dayStr}
          {schedule.created_at && (
            <span className="ml-2 text-zinc-600">· Atribuído em {formatDate(schedule.created_at)}</span>
          )}
        </p>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={handleRemove}
        disabled={pending}
        title="Remover treino"
        className="p-2 rounded-xl text-zinc-600 hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-40 flex-shrink-0"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function MemberWorkoutPanel({
  userId,
  collections,
  schedules,
  executionLogs,
}: Props) {
  const [search, setSearch] = useState("");
  const [localSchedules, setLocalSchedules] = useState(schedules);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? collections.filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              (c.description ?? "").toLowerCase().includes(query),
          )
        : collections,
    [collections, query],
  );

  return (
    <div className="space-y-8">

      {/* ── Section 1: Assign ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Vitrine de Treinos</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Selecione uma ficha de prateleira e atribua ao aluno.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar coleções..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Collection grid */}
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <ClipboardDocumentListIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">
              {search ? `Nenhuma coleção encontrada para "${search}".` : "Nenhuma coleção criada ainda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                userId={userId}
                onAssigned={() => {
                  // Optimistically add a placeholder schedule; page refresh will hydrate
                  setLocalSchedules((prev) => [
                    ...prev,
                    {
                      id: `temp-${Date.now()}`,
                      schedule_type: "session",
                      day_of_week: null,
                      session_label: null,
                      created_at: new Date().toISOString(),
                      collection: { name: c.name },
                    },
                  ]);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Active schedules ───────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">Cronogramas Ativos</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Treinos atualmente atribuídos a este aluno.
          </p>
        </div>

        {localSchedules.length === 0 ? (
          <div className="py-8 text-center bg-surface-2/40 border border-dashed border-white/8 rounded-2xl">
            <p className="text-sm text-zinc-500">Nenhum treino atribuído ainda.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Escolha uma ficha na vitrine acima e clique em &ldquo;Atribuir ao Aluno&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {localSchedules.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                onRemoved={() =>
                  setLocalSchedules((prev) => prev.filter((x) => x.id !== s.id))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Execution history ─────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Histórico de Execução</h3>
        {executionLogs.length === 0 ? (
          <p className="text-xs text-zinc-600 py-4 text-center">Nenhum registro de execução ainda.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {executionLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-2/50 rounded-xl"
              >
                <span className="text-xs text-zinc-300 truncate flex-1">
                  {log.exercise?.title ?? "Exercício"}
                </span>
                <span className="text-xs text-zinc-600 tabular-nums flex-shrink-0">
                  {log.weight_kg != null && `${log.weight_kg} kg · `}
                  {log.sets_completed ?? "?"}×{log.reps_done ?? "?"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
