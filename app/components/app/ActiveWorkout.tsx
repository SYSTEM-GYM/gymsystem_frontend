"use client";

import { useState, useTransition, useRef } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import type { TodayWorkoutData, CollectionExerciseRow } from "@/lib/workout-utils";
import { saveWorkoutLog, type SetLogInput } from "@/app/app/workout-actions";
import { ExerciseVideoModal } from "./ExerciseVideoModal";
import { PlayCircleIcon } from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────

type SetState = { weight: string; reps: string; done: boolean };
type WorkoutSets = Record<string, SetState[]>; // keyed by collection_exercise row id

// ── Helpers ───────────────────────────────────────────────────────────────────

function initSets(
  exercises: CollectionExerciseRow[],
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>,
): WorkoutSets {
  const result: WorkoutSets = {};
  for (const row of exercises) {
    const last = lastLogs[row.exercise_id];
    result[row.id] = Array.from({ length: row.default_sets }, () => ({
      weight: last?.weight_kg?.toString() ?? row.default_weight_kg?.toString() ?? "",
      reps: last?.reps_done?.toString() ?? row.default_reps.toString(),
      done: false,
    }));
  }
  return result;
}

function useElapsedTimer(startedAt: Date) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!ref.current) {
    ref.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
  }
  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── SetRow ────────────────────────────────────────────────────────────────────

function SetRow({
  index,
  state,
  onChange,
  onDone,
}: {
  index: number;
  state: SetState;
  onChange: (field: "weight" | "reps", value: string) => void;
  onDone: () => void;
}) {
  const inputCls =
    "w-full min-h-[44px] bg-surface-1 border border-white/10 rounded-xl px-3 text-center text-sm font-bold text-white tabular-nums focus:outline-none focus:border-primary/40 transition-colors";

  return (
    <div
      className={`grid grid-cols-[48px_1fr_1fr_48px] items-center gap-2 py-2 px-1 rounded-xl transition-colors ${
        state.done ? "bg-primary/5" : ""
      }`}
    >
      <span
        className={`text-xs font-bold text-center tabular-nums ${
          state.done ? "text-primary" : "text-zinc-500"
        }`}
      >
        {index + 1}ª
      </span>

      <div>
        <label className="block text-[9px] text-zinc-600 uppercase text-center mb-1">Carga (kg)</label>
        <input
          type="number"
          inputMode="decimal"
          value={state.weight}
          onChange={(e) => onChange("weight", e.target.value)}
          disabled={state.done}
          placeholder="0"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[9px] text-zinc-600 uppercase text-center mb-1">Reps</label>
        <input
          type="number"
          inputMode="numeric"
          value={state.reps}
          onChange={(e) => onChange("reps", e.target.value)}
          disabled={state.done}
          className={inputCls}
        />
      </div>

      <button
        type="button"
        onClick={onDone}
        disabled={state.done}
        title="Confirmar série"
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all ${
          state.done
            ? "bg-primary/20 text-primary"
            : "bg-surface-1 border border-white/10 text-zinc-500 hover:border-primary/40 hover:text-primary active:scale-95"
        }`}
      >
        {state.done ? (
          <CheckCircleIcon className="w-5 h-5" />
        ) : (
          <CheckIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// ── ExerciseCard ──────────────────────────────────────────────────────────────

function ExerciseCard({
  row,
  sets,
  onSetChange,
  onSetDone,
}: {
  row: CollectionExerciseRow;
  sets: SetState[];
  onSetChange: (setIdx: number, field: "weight" | "reps", value: string) => void;
  onSetDone: (setIdx: number) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const hasVideo = !!(row.exercise.youtube_url || row.exercise.webm_path || row.exercise.video_url);
  const doneSets = sets.filter((s) => s.done).length;
  const allDone = doneSets === sets.length;

  return (
    <>
      <div
        className={`bg-surface-1 border rounded-2xl overflow-hidden transition-colors ${
          allDone ? "border-primary/30" : "border-white/5"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-snug ${allDone ? "text-primary" : "text-white"}`}>
              {row.exercise.translated_name || row.exercise.title}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Meta: {row.default_sets}×{row.default_reps}
              {row.default_weight_kg && ` · ${row.default_weight_kg} kg`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasVideo && (
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                className="p-2 rounded-xl bg-surface-2 text-zinc-500 hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <PlayCircleIcon className="w-5 h-5" />
              </button>
            )}
            <span className="text-xs font-bold tabular-nums text-zinc-600">
              {doneSets}/{sets.length}
            </span>
          </div>
        </div>

        {/* Set rows */}
        <div className="px-3 pb-3 space-y-0.5">
          {/* Column headers */}
          <div className="grid grid-cols-[48px_1fr_1fr_48px] gap-2 mb-1">
            <span className="text-[9px] text-zinc-700 uppercase text-center">Série</span>
            <span className="text-[9px] text-zinc-700 uppercase text-center">Carga (kg)</span>
            <span className="text-[9px] text-zinc-700 uppercase text-center">Reps</span>
            <span />
          </div>
          {sets.map((s, idx) => (
            <SetRow
              key={idx}
              index={idx}
              state={s}
              onChange={(field, value) => onSetChange(idx, field, value)}
              onDone={() => onSetDone(idx)}
            />
          ))}
        </div>
      </div>

      <ExerciseVideoModal
        exercise={showVideo ? row.exercise : null}
        onClose={() => setShowVideo(false)}
      />
    </>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-6 py-16">
      <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
        <CheckCircleIcon className="w-12 h-12 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-white">Treino concluído!</h2>
        <p className="text-sm text-zinc-400 mt-2">
          Carga registrada com sucesso. Continue assim! 💪
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 px-8 py-3 bg-primary text-black font-bold rounded-2xl text-sm hover:opacity-90 active:scale-95 transition-all"
      >
        Voltar ao Início
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ActiveWorkout({
  workout,
  lastLogs,
  onClose,
}: {
  workout: TodayWorkoutData;
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>;
  onClose: () => void;
}) {
  const startedAt = useRef(new Date());
  const elapsed = useElapsedTimer(startedAt.current);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSets>(() =>
    initSets(workout.exercises, lastLogs),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totalSets = workout.exercises.reduce((acc, r) => acc + r.default_sets, 0);
  const completedSets = Object.values(workoutSets).reduce(
    (acc, sets) => acc + sets.filter((s) => s.done).length,
    0,
  );

  function handleSetChange(rowId: string, setIdx: number, field: "weight" | "reps", value: string) {
    setWorkoutSets((prev) => {
      const copy = [...(prev[rowId] ?? [])];
      copy[setIdx] = { ...copy[setIdx], [field]: value };
      return { ...prev, [rowId]: copy };
    });
  }

  function handleSetDone(rowId: string, setIdx: number) {
    setWorkoutSets((prev) => {
      const copy = [...(prev[rowId] ?? [])];
      copy[setIdx] = { ...copy[setIdx], done: true };
      return { ...prev, [rowId]: copy };
    });
  }

  function handleFinish() {
    const allSets: SetLogInput[] = [];
    for (const row of workout.exercises) {
      const sets = workoutSets[row.id] ?? [];
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        allSets.push({
          exerciseId: row.exercise_id,
          setNumber: i + 1,
          weightKg: s.weight ? parseFloat(s.weight) : null,
          repsCompleted: s.reps ? parseInt(s.reps, 10) : null,
        });
      }
    }

    startTransition(async () => {
      const result = await saveWorkoutLog({
        collectionId: workout.collectionId,
        startedAt: startedAt.current.toISOString(),
        sets: allSets,
      });
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 border-b border-white/5 bg-surface-1/80 backdrop-blur-sm flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="text-center flex-1 min-w-0 mx-3">
          <p className="text-xs text-zinc-500 truncate">{workout.collectionName}</p>
          <p className="text-[11px] font-semibold text-primary tabular-nums">
            {completedSets}/{totalSets} séries
          </p>
        </div>
        <div className="flex items-center gap-1 text-zinc-500 text-xs tabular-nums min-w-[52px] justify-end">
          <ClockIcon className="w-3.5 h-3.5" />
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Body */}
      {done ? (
        <SuccessScreen onClose={onClose} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 pb-28">
            {workout.exercises.map((row) => (
              <ExerciseCard
                key={row.id}
                row={row}
                sets={workoutSets[row.id] ?? []}
                onSetChange={(idx, field, value) => handleSetChange(row.id, idx, field, value)}
                onSetDone={(idx) => handleSetDone(row.id, idx)}
              />
            ))}
          </div>

          {/* Sticky footer */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-safe-bottom pb-6 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
            {error && (
              <p className="text-xs text-danger text-center mb-2">{error}</p>
            )}
            <button
              type="button"
              onClick={handleFinish}
              disabled={pending}
              className="w-full min-h-[52px] rounded-2xl bg-primary text-black font-black text-base hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <FireIcon className="w-5 h-5" />
              {pending ? "Salvando..." : "Finalizar Treino"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
