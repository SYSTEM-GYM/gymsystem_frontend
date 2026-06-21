"use client";

import { useState } from "react";
import { ClockIcon, BoltIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import type { TodayWorkoutData } from "@/lib/workout-utils";
import { ActiveWorkout } from "./ActiveWorkout";

type Props = {
  workout: TodayWorkoutData;
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>;
};

export function TodayWorkout({ workout, lastLogs }: Props) {
  const [active, setActive] = useState(false);

  return (
    <>
      <div className="bg-surface-1 border border-white/8 rounded-3xl overflow-hidden">
        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
              Treino de Hoje
            </p>
            <h2 className="text-lg font-black text-white mt-0.5 leading-tight">
              {workout.collectionName}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5" />
              ~{workout.estimatedDurationMinutes} min
            </span>
            <span className="flex items-center gap-1.5">
              <BoltIcon className="w-3.5 h-3.5" />
              {workout.exercises.length} exercício{workout.exercises.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Exercise preview */}
          {workout.exercises.length > 0 && (
            <div className="space-y-1">
              {workout.exercises.slice(0, 4).map((row, idx) => (
                <div key={row.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-zinc-400 truncate flex-1">
                    {idx + 1}. {row.exercise.translated_name || row.exercise.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 flex-shrink-0 tabular-nums">
                    {row.default_sets}×{row.default_reps}
                  </span>
                </div>
              ))}
              {workout.exercises.length > 4 && (
                <p className="text-[10px] text-zinc-600 pt-1">
                  +{workout.exercises.length - 4} exercícios...
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setActive(true)}
            className="w-full min-h-[52px] bg-primary text-black font-black text-base rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <PlayCircleIcon className="w-6 h-6" />
            Iniciar Treino
          </button>
        </div>
      </div>

      {active && (
        <ActiveWorkout
          workout={workout}
          lastLogs={lastLogs}
          onClose={() => setActive(false)}
        />
      )}
    </>
  );
}
