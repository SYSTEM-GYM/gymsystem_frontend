"use client";

import { useState } from "react";
import { ClockIcon, BoltIcon, PlayCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { TodayWorkoutData } from "@/lib/workout-utils";
import { useWorkoutSession, type WorkoutSetsMap } from "@/lib/workout-session-store";

function initSets(
  workout: TodayWorkoutData,
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>,
): WorkoutSetsMap {
  const result: WorkoutSetsMap = {};
  for (const row of workout.exercises) {
    const last = lastLogs[row.exercise_id];
    result[row.id] = Array.from({ length: row.default_sets }, () => ({
      weight: last?.weight_kg?.toString() ?? row.default_weight_kg?.toString() ?? "",
      reps: last?.reps_done?.toString() ?? row.default_reps.toString(),
      done: false,
    }));
  }
  return result;
}

function ConflictModal({
  currentName,
  onKeepCurrent,
  onReplace,
}: {
  currentName: string;
  onKeepCurrent: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl shadow-2xl p-5 space-y-4">
        <p className="font-bold text-white">
          Você já possui um treino em execução.
        </p>
        <p className="text-sm text-zinc-400">
          &ldquo;{currentName}&rdquo; está em andamento. Deseja finalizar o atual e iniciar este novo treino?
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onKeepCurrent}
            className="flex-1 min-h-12 rounded-2xl bg-surface-2 text-zinc-300 font-bold text-sm active:scale-95 transition-transform"
          >
            Continuar atual
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="flex-1 min-h-12 rounded-2xl bg-primary text-black font-black text-sm active:scale-95 transition-transform"
          >
            Finalizar e iniciar novo
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkoutPreviewModal({
  workout,
  lastLogs,
  onClose,
}: {
  workout: TodayWorkoutData;
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>;
  onClose: () => void;
}) {
  const { session, startSession, setViewingWorkout } = useWorkoutSession();
  const [showConflict, setShowConflict] = useState(false);

  function begin() {
    startSession(workout, initSets(workout, lastLogs));
    onClose();
  }

  function handleStartClick() {
    if (session && session.workout.collectionId !== workout.collectionId) {
      setShowConflict(true);
      return;
    }
    if (session && session.workout.collectionId === workout.collectionId) {
      // Same workout already active — just resume it.
      setViewingWorkout(true);
      onClose();
      return;
    }
    begin();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] bg-surface-1 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
              Prévia do Treino
            </p>
            <h2 className="text-lg font-black text-white mt-0.5 leading-tight">
              {workout.collectionName}
            </h2>
            <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
              <span className="flex items-center gap-1.5">
                <ClockIcon className="w-3.5 h-3.5" />
                ~{workout.estimatedDurationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <BoltIcon className="w-3.5 h-3.5" />
                {workout.exercises.length} exercício{workout.exercises.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/8 transition-colors shrink-0 min-h-11 min-w-11 flex items-center justify-center"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
          {workout.exercises.map((row, idx) => (
            <div
              key={row.id}
              className="flex items-center gap-3 bg-surface-2/60 rounded-2xl p-2.5"
            >
              <span className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {row.exercise.translated_name || row.exercise.title}
                </p>
                <p className="text-[10px] text-zinc-600">
                  {row.default_sets}×{row.default_reps}
                  {row.default_weight_kg && ` · ${row.default_weight_kg} kg`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Sticky footer */}
        <div className="px-5 py-4 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={handleStartClick}
            className="w-full min-h-13 bg-primary text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <PlayCircleIcon className="w-6 h-6" />
            Iniciar Treino
          </button>
        </div>
      </div>

      {showConflict && session && (
        <ConflictModal
          currentName={session.workout.collectionName}
          onKeepCurrent={() => {
            setShowConflict(false);
            setViewingWorkout(true);
            onClose();
          }}
          onReplace={() => {
            setShowConflict(false);
            begin();
          }}
        />
      )}
    </div>
  );
}
