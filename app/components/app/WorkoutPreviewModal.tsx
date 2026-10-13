"use client";

import { useState } from "react";
import {
  ClockIcon,
  BoltIcon,
  FilmIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  Square3Stack3DIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { CollectionExerciseRow, TodayWorkoutData } from "@/lib/workout-utils";
import { useWorkoutSession, type WorkoutSetsMap } from "@/lib/workout-session-store";
import { resolveExerciseMedia } from "@/lib/exercise-utils";
import { ExerciseVideoModal, type Exercise } from "./ExerciseVideoModal";

type LastLogs = Record<string, { weight_kg: number | null; reps_done: number | null }>;

function initSets(workout: TodayWorkoutData, lastLogs: LastLogs): WorkoutSetsMap {
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
          &ldquo;{currentName}&rdquo; está em andamento. Deseja descartá-lo e iniciar este novo treino?
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
            Descartar e iniciar
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const [failed, setFailed] = useState(false);
  const media = resolveExerciseMedia(exercise);

  if (!failed && media.kind === "video") {
    return (
      <video
        src={media.url}
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  if (!failed && media.kind === "youtube") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.thumbUrl}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center">
      <FilmIcon className="w-5 h-5 text-zinc-600" />
    </div>
  );
}

function ExerciseRow({
  index,
  row,
  last,
  onWatch,
}: {
  index: number;
  row: CollectionExerciseRow;
  last: LastLogs[string] | undefined;
  onWatch: () => void;
}) {
  const hasMedia = resolveExerciseMedia(row.exercise).kind !== "none";
  const name = row.exercise.translated_name || row.exercise.title;

  return (
    <div className="flex items-center gap-3 bg-surface-2/60 rounded-2xl p-2.5">
      <button
        type="button"
        onClick={onWatch}
        disabled={!hasMedia}
        aria-label={hasMedia ? `Ver vídeo de ${name}` : undefined}
        className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-surface-2"
      >
        <ExerciseThumb exercise={row.exercise} />
        {hasMedia && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <PlayCircleIcon className="w-5 h-5 text-white drop-shadow" />
          </span>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-zinc-600 tabular-nums">#{index + 1}</p>
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{name}</p>
        <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap mt-1 text-[11px] tabular-nums">
          <span className="font-bold text-primary">
            {row.default_sets} séries × {row.default_reps} reps
          </span>
          {row.default_weight_kg ? (
            <span className="text-zinc-500">· {row.default_weight_kg} kg</span>
          ) : null}
        </div>
        {last && (last.weight_kg != null || last.reps_done != null) && (
          <p className="text-[10px] text-zinc-600 mt-0.5 tabular-nums">
            Última vez: {last.weight_kg != null ? `${last.weight_kg} kg` : "—"}
            {last.reps_done != null && ` × ${last.reps_done}`}
          </p>
        )}
      </div>
    </div>
  );
}

export function WorkoutPreviewModal({
  workout,
  lastLogs,
  onClose,
  onEdit,
  onDelete,
}: {
  workout: TodayWorkoutData;
  lastLogs: LastLogs;
  onClose: () => void;
  /** Owner-only actions — omitted for workouts the viewer did not create. */
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { session, startSession, setViewingWorkout } = useWorkoutSession();
  const [showConflict, setShowConflict] = useState(false);
  const [watching, setWatching] = useState<Exercise | null>(null);

  const totalSets = workout.exercises.reduce((acc, r) => acc + r.default_sets, 0);
  const isActive = session?.workout.collectionId === workout.collectionId;

  function begin() {
    startSession(workout, initSets(workout, lastLogs));
    onClose();
  }

  function handleStartClick() {
    if (session && !isActive) {
      setShowConflict(true);
      return;
    }
    if (isActive) {
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-preview-title"
        className="w-full sm:max-w-lg max-h-[90vh] bg-surface-1 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/5 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
              Prévia do Treino
            </p>
            <h2 id="workout-preview-title" className="text-lg font-black text-white mt-0.5 leading-tight">
              {workout.collectionName}
            </h2>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-zinc-500 mt-2">
              <span className="flex items-center gap-1.5">
                <ClockIcon className="w-3.5 h-3.5" />
                ~{workout.estimatedDurationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <BoltIcon className="w-3.5 h-3.5" />
                {workout.exercises.length} exercício{workout.exercises.length !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Square3Stack3DIcon className="w-3.5 h-3.5" />
                {totalSets} séries
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 -mr-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Editar treino"
                title="Editar treino"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors min-h-11 min-w-11 flex items-center justify-center"
              >
                <PencilSquareIcon className="w-5 h-5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Excluir treino"
                title="Excluir treino"
                className="p-2 rounded-xl text-zinc-400 hover:text-danger hover:bg-danger/10 transition-colors min-h-11 min-w-11 flex items-center justify-center"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/8 transition-colors min-h-11 min-w-11 flex items-center justify-center"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4 space-y-2">
          {workout.exercises.map((row, idx) => (
            <ExerciseRow
              key={row.id}
              index={idx}
              row={row}
              last={lastLogs[row.exercise_id]}
              onWatch={() => setWatching(row.exercise)}
            />
          ))}
          {workout.exercises.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-600">Ficha sem exercícios.</p>
          )}
        </div>

        {/* Sticky footer */}
        <div className="px-5 py-4 border-t border-white/5 shrink-0 pb-safe-bottom">
          <button
            type="button"
            onClick={handleStartClick}
            disabled={workout.exercises.length === 0}
            className="w-full min-h-13 bg-primary text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <PlayCircleIcon className="w-6 h-6" />
            {isActive ? "Retomar Treino" : "Iniciar Treino"}
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

      <ExerciseVideoModal exercise={watching} onClose={() => setWatching(null)} />
    </div>
  );
}
