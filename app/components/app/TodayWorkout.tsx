"use client";

import { useState, useTransition } from "react";
import { CheckIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import { logExerciseExecution } from "@/app/app/workout-actions";
import { ExerciseVideoModal } from "./ExerciseVideoModal";
import type { TodayWorkoutData, CollectionExerciseRow } from "@/lib/workout-utils";

type Props = {
  workout: TodayWorkoutData;
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>;
};

function ExerciseTracker({
  row,
  collectionId,
  lastLog,
}: {
  row: CollectionExerciseRow;
  collectionId: string;
  lastLog?: { weight_kg: number | null; reps_done: number | null };
}) {
  const [weight, setWeight] = useState(
    lastLog?.weight_kg?.toString() ?? row.default_weight_kg?.toString() ?? "",
  );
  const [reps, setReps] = useState(
    lastLog?.reps_done?.toString() ?? row.default_reps.toString(),
  );
  const [sets, setSets] = useState(row.default_sets.toString());
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showVideo, setShowVideo] = useState(false);

  const hasVideo = !!(row.exercise.youtube_url || row.exercise.webm_path);

  function handleSave() {
    const prevSaved = saved;
    setSaved(true);

    startTransition(async () => {
      const result = await logExerciseExecution({
        exerciseId: row.exercise_id,
        collectionId,
        weightKg: weight ? parseFloat(weight) : null,
        repsDone: reps ? parseInt(reps, 10) : null,
        setsCompleted: sets ? parseInt(sets, 10) : null,
      });
      if (!result.ok) setSaved(prevSaved);
    });
  }

  const inputCls =
    "w-full min-h-[44px] bg-surface-2 border border-white/10 rounded-xl px-3 text-center text-sm font-bold text-white tabular-nums focus:outline-none focus:border-primary/40";

  return (
    <>
      <li className="p-4 bg-surface-1 border border-white/5 rounded-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{row.exercise.title}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Meta: {row.default_sets}×{row.default_reps}
              {lastLog?.weight_kg != null && (
                <span className="ml-2 text-primary">
                  Última: {lastLog.weight_kg} kg
                </span>
              )}
            </p>
          </div>
          {hasVideo && (
            <button
              type="button"
              onClick={() => setShowVideo(true)}
              className="p-2 rounded-xl bg-primary/10 text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <PlayCircleIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase text-center mb-1">Kg</label>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => { setWeight(e.target.value); setSaved(false); }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase text-center mb-1">Reps</label>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => { setReps(e.target.value); setSaved(false); }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase text-center mb-1">Séries</label>
            <input
              type="number"
              inputMode="numeric"
              value={sets}
              onChange={(e) => { setSets(e.target.value); setSaved(false); }}
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className={`w-full min-h-[44px] rounded-xl text-sm font-bold transition-all ${
            saved
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-primary text-black hover:scale-[1.01] active:scale-[0.99]"
          } disabled:opacity-40`}
        >
          {saved ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4" /> Registrado
            </span>
          ) : pending ? (
            "Salvando..."
          ) : (
            "Registrar série"
          )}
        </button>
      </li>

      <ExerciseVideoModal
        exercise={showVideo ? row.exercise : null}
        onClose={() => setShowVideo(false)}
      />
    </>
  );
}

export function TodayWorkout({ workout, lastLogs }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Treino de Hoje</p>
          <h2 className="text-lg font-black text-white">{workout.collectionName}</h2>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
          ~{workout.estimatedDurationMinutes} min
        </span>
      </div>

      {workout.exercises.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">
          Esta coleção ainda não tem exercícios.
        </p>
      ) : (
        <ul className="space-y-3">
          {workout.exercises.map((row) => (
            <ExerciseTracker
              key={row.id}
              row={row}
              collectionId={workout.collectionId}
              lastLog={lastLogs[row.exercise_id]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
