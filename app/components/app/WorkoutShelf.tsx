"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BoltIcon,
  ClockIcon,
  PlayCircleIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { StudentWorkoutItem } from "@/lib/workout-utils";
import { deleteStudentWorkout } from "@/app/app/workout-actions";
import { WorkoutPreviewModal } from "./WorkoutPreviewModal";
import { StudentWorkoutBuilderModal } from "./StudentWorkoutBuilderModal";

type Props = {
  workouts: StudentWorkoutItem[];
  lastLogs: Record<string, { weight_kg: number | null; reps_done: number | null }>;
};

function WorkoutCard({
  workout,
  onStart,
}: {
  workout: StudentWorkoutItem;
  onStart: () => void;
}) {
  const router = useRouter();
  const [deleting, startDeleting] = useTransition();

  function handleDelete() {
    if (!confirm(`Excluir o treino "${workout.collectionName}"?`)) return;
    startDeleting(async () => {
      const result = await deleteStudentWorkout(workout.collectionId);
      if (result.ok) router.refresh();
      else alert(result.message);
    });
  }

  return (
    <div
      className={`snap-start shrink-0 w-[78%] max-w-75 bg-surface-1 border rounded-3xl overflow-hidden flex flex-col ${
        workout.suggestedToday ? "border-primary/30" : "border-white/8"
      }`}
    >
      {/* Accent strip */}
      <div
        className={`h-1 ${
          workout.suggestedToday
            ? "bg-linear-to-r from-primary via-primary/60 to-transparent"
            : "bg-white/5"
        }`}
      />

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-h-4">
              {workout.suggestedToday && (
                <p className="flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-widest">
                  <SparklesIcon className="w-3 h-3" />
                  Sugerido para hoje
                </p>
              )}
              {workout.createdByMe && (
                <span className="text-[9px] font-bold text-info bg-info/10 border border-info/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Meu treino
                </span>
              )}
            </div>
            {workout.createdByMe && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                title="Excluir treino"
                className="p-1 -mr-1 -mt-1 text-zinc-700 hover:text-danger transition-colors disabled:opacity-40 shrink-0"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <h3 className="font-black text-white leading-tight line-clamp-2 mt-1">
            {workout.collectionName}
          </h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1.5">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              ~{workout.estimatedDurationMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <BoltIcon className="w-3.5 h-3.5" />
              {workout.exercises.length} exercício{workout.exercises.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* First exercises preview */}
        <div className="flex-1 space-y-1">
          {workout.exercises.slice(0, 3).map((row, idx) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 py-1 border-b border-white/5 last:border-0"
            >
              <span className="text-xs text-zinc-400 truncate flex-1">
                {idx + 1}. {row.exercise.translated_name || row.exercise.title}
              </span>
              <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                {row.default_sets}×{row.default_reps}
              </span>
            </div>
          ))}
          {workout.exercises.length > 3 && (
            <p className="text-[10px] text-zinc-600 pt-0.5">
              +{workout.exercises.length - 3} exercícios...
            </p>
          )}
          {workout.exercises.length === 0 && (
            <p className="text-xs text-zinc-600">Ficha sem exercícios.</p>
          )}
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={workout.exercises.length === 0}
          className={`w-full min-h-12 font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 ${
            workout.suggestedToday
              ? "bg-primary text-black hover:opacity-90"
              : "bg-surface-2 text-white border border-white/10 hover:border-primary/40"
          }`}
        >
          <PlayCircleIcon className="w-5 h-5" />
          Iniciar Treino
        </button>
      </div>
    </div>
  );
}

function CreateWorkoutCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="snap-start shrink-0 w-[62%] max-w-60 min-h-55 border border-dashed border-white/15 rounded-3xl flex flex-col items-center justify-center gap-3 text-center p-5 hover:border-primary/40 active:scale-[0.98] transition-all"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <PlusIcon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-black text-white">Criar Meu Treino</p>
        <p className="text-[11px] text-zinc-600 mt-1 leading-snug">
          Monte sua própria ficha escolhendo os exercícios.
        </p>
      </div>
    </button>
  );
}

export function WorkoutShelf({ workouts, lastLogs }: Props) {
  const [preview, setPreview] = useState<StudentWorkoutItem | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
              Meus Treinos
            </p>
            <h2 className="text-lg font-black text-white leading-tight">
              Escolha sua sessão
            </h2>
          </div>
          <span className="text-xs font-semibold text-zinc-500 tabular-nums">
            {workouts.length} {workouts.length === 1 ? "sessão" : "sessões"}
          </span>
        </div>

        {workouts.length === 0 && (
          <div className="p-6 bg-surface-1 border border-dashed border-white/10 rounded-3xl text-center">
            <p className="text-sm font-semibold text-zinc-500">
              Nenhuma ficha de treino atribuída
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Peça ao seu personal — ou monte seu próprio treino abaixo.
            </p>
          </div>
        )}

        {/* Horizontal scrollable shelf */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 [-webkit-overflow-scrolling:touch] scrollbar-none [&::-webkit-scrollbar]:hidden">
          {workouts.map((w) => (
            <WorkoutCard
              key={w.collectionId}
              workout={w}
              onStart={() => setPreview(w)}
            />
          ))}
          <CreateWorkoutCard onClick={() => setShowBuilder(true)} />
        </div>
      </div>

      {preview && (
        <WorkoutPreviewModal
          workout={preview}
          lastLogs={lastLogs}
          onClose={() => setPreview(null)}
        />
      )}

      {showBuilder && (
        <StudentWorkoutBuilderModal onClose={() => setShowBuilder(false)} />
      )}
    </>
  );
}
