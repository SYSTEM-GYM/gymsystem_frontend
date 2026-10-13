"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  FilmIcon,
  FireIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { saveWorkoutLog, type SetLogInput } from "@/app/app/workout-actions";
import { useWorkoutSession, type SetState } from "@/lib/workout-session-store";
import { resolveExerciseMedia } from "@/lib/exercise-utils";
import { ExerciseVideoModal } from "./ExerciseVideoModal";

const DEFAULT_REST_SECONDS = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

function useElapsedTimer(startedAtIso: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedMs = new Date(startedAtIso).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startedMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtIso]);
  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clampWeight(value: string): string {
  if (value === "") return value;
  const num = parseFloat(value);
  if (Number.isNaN(num)) return "";
  return Math.max(0, num).toString();
}

// ── Rest Timer ────────────────────────────────────────────────────────────────

function RestTimerBar({ restEndsAt }: { restEndsAt: string }) {
  const { adjustRest, clearRest } = useWorkoutSession();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - Date.now()) / 1000));
      setRemaining(rem);
      if (rem === 0) clearRest();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restEndsAt, clearRest]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border-t border-primary/20 shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ClockIcon className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-black text-primary tabular-nums">Descanso: {remaining}s</p>
      </div>
      <button
        type="button"
        onClick={() => adjustRest(-10)}
        className="min-h-9 px-3 rounded-xl bg-surface-1 border border-white/10 text-xs font-bold text-zinc-300 active:scale-95 transition-transform"
      >
        -10s
      </button>
      <button
        type="button"
        onClick={() => adjustRest(30)}
        className="min-h-9 px-3 rounded-xl bg-surface-1 border border-white/10 text-xs font-bold text-zinc-300 active:scale-95 transition-transform"
      >
        +30s
      </button>
      <button
        type="button"
        onClick={clearRest}
        className="min-h-9 px-3 rounded-xl bg-surface-2 text-xs font-bold text-zinc-400 active:scale-95 transition-transform"
      >
        Pular
      </button>
    </div>
  );
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
    "w-full min-h-11 bg-surface-1 border border-white/10 rounded-xl px-3 text-center text-sm font-bold text-white tabular-nums focus:outline-none focus:border-primary/40 transition-colors";

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
          min="0"
          step="0.5"
          value={state.weight}
          onChange={(e) => onChange("weight", clampWeight(e.target.value))}
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
          min="0"
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
        className={`min-h-11 min-w-11 flex items-center justify-center rounded-xl transition-all ${
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

type ExerciseCardExercise = {
  id: string;
  title: string;
  translated_name: string | null;
  description: string | null;
  instructions: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
};

function ExerciseCardThumb({ exercise }: { exercise: ExerciseCardExercise }) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const media = resolveExerciseMedia(exercise);

  if (!mediaFailed && media.kind === "video") {
    return (
      <video
        src={media.url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        onError={() => setMediaFailed(true)}
      />
    );
  }
  if (!mediaFailed && media.kind === "youtube") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.thumbUrl}
        alt={exercise.translated_name || exercise.title}
        className="w-full h-full object-cover"
        onError={() => setMediaFailed(true)}
      />
    );
  }
  // Null or broken media — static fallback, never a hanging loading state
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-2">
      <FilmIcon className="w-6 h-6 text-zinc-600" />
    </div>
  );
}

function ExerciseCard({
  index,
  total,
  exercise,
  defaultSets,
  defaultReps,
  defaultWeightKg,
  sets,
  onSetChange,
  onSetDone,
}: {
  index: number;
  total: number;
  exercise: ExerciseCardExercise;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
  sets: SetState[];
  onSetChange: (setIdx: number, field: "weight" | "reps", value: string) => void;
  onSetDone: (setIdx: number) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const hasVideo = resolveExerciseMedia(exercise).kind !== "none";
  const doneSets = sets.filter((s) => s.done).length;
  const allDone = doneSets === sets.length;

  return (
    <>
      <div
        className={`bg-surface-1 border rounded-2xl overflow-hidden transition-colors ${
          allDone ? "border-primary/30" : "border-white/5"
        }`}
      >
        {/* Header with media thumbnail */}
        <div className="flex items-stretch gap-3 p-3">
          <button
            type="button"
            onClick={() => hasVideo && setShowVideo(true)}
            disabled={!hasVideo}
            className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-surface-2"
          >
            <ExerciseCardThumb exercise={exercise} />
            {hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <PlayCircleIcon className="w-6 h-6 text-white drop-shadow" />
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">
              Exercício {index + 1} de {total}
            </p>
            <p className={`text-sm font-bold leading-snug mt-0.5 ${allDone ? "text-primary" : "text-white"}`}>
              {exercise.translated_name || exercise.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] text-zinc-600">
                Meta: {defaultSets}×{defaultReps}
                {defaultWeightKg && ` · ${defaultWeightKg} kg`}
              </p>
              <span className="text-xs font-bold tabular-nums text-zinc-600">
                {doneSets}/{sets.length}
              </span>
            </div>
          </div>
        </div>

        {/* Set rows */}
        <div className="px-3 pb-3 space-y-0.5">
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
        exercise={showVideo ? exercise : null}
        onClose={() => setShowVideo(false)}
      />
    </>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({ xpAwarded, onClose }: { xpAwarded: number; onClose: () => void }) {
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
        {xpAwarded > 0 && (
          <p className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-black tabular-nums">
            +{xpAwarded} XP
          </p>
        )}
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

// ── Early-finish confirmation modal ──────────────────────────────────────────

function EarlyFinishModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl shadow-2xl p-5 space-y-4">
        <p className="font-bold text-white">
          Algumas séries não foram concluídas.
        </p>
        <p className="text-sm text-zinc-400">
          Deseja encerrar o treino mesmo assim? Seu progresso parcial será salvo.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-12 rounded-2xl bg-surface-2 text-zinc-300 font-bold text-sm active:scale-95 transition-transform"
          >
            Continuar treino
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-h-12 rounded-2xl bg-primary text-black font-black text-sm active:scale-95 transition-transform"
          >
            Encerrar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ActiveWorkout({ onMinimize }: { onMinimize: () => void }) {
  const { session, updateSets, startRest, endSession } = useWorkoutSession();
  const elapsed = useElapsedTimer(session?.startedAt ?? new Date().toISOString());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [showEarlyFinish, setShowEarlyFinish] = useState(false);
  const finishedRef = useRef(false);

  if (!session) return null;
  const activeSession = session;

  const { workout, workoutSets } = activeSession;
  const totalSets = workout.exercises.reduce((acc, r) => acc + r.default_sets, 0);
  const completedSets = Object.values(workoutSets).reduce(
    (acc, sets) => acc + sets.filter((s) => s.done).length,
    0,
  );
  const allSetsDone = totalSets > 0 && completedSets === totalSets;

  function handleSetChange(rowId: string, setIdx: number, field: "weight" | "reps", value: string) {
    updateSets((prev) => {
      const copy = [...(prev[rowId] ?? [])];
      copy[setIdx] = { ...copy[setIdx], [field]: value };
      return { ...prev, [rowId]: copy };
    });
  }

  function handleSetDone(rowId: string, setIdx: number) {
    updateSets((prev) => {
      const copy = [...(prev[rowId] ?? [])];
      copy[setIdx] = { ...copy[setIdx], done: true };
      return { ...prev, [rowId]: copy };
    });
    startRest(DEFAULT_REST_SECONDS);
  }

  function doFinish() {
    const allSets: SetLogInput[] = [];
    for (const row of workout.exercises) {
      const sets = workoutSets[row.id] ?? [];
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        if (!s.done) continue;
        allSets.push({
          rowId: row.id,
          exerciseId: row.exercise_id,
          setNumber: i + 1,
          weightKg: s.weight ? parseFloat(s.weight) : null,
          repsCompleted: s.reps ? parseInt(s.reps, 10) : null,
        });
      }
    }

    const startedAt = activeSession.startedAt;
    startTransition(async () => {
      const result = await saveWorkoutLog({
        collectionId: workout.collectionId,
        startedAt,
        sets: allSets,
      });
      if (result.ok) {
        finishedRef.current = true;
        setXpAwarded(result.xpAwarded);
        setDone(true);
      } else {
        setError(result.message);
      }
    });
  }

  function handleFinishClick() {
    if (!allSetsDone) {
      setShowEarlyFinish(true);
      return;
    }
    doFinish();
  }

  function handleClose() {
    if (finishedRef.current) endSession();
    else onMinimize();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 border-b border-white/5 bg-surface-1/80 backdrop-blur-sm shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors min-h-11 min-w-11 flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="text-center flex-1 min-w-0 mx-3">
          <p className="text-xs text-zinc-500 truncate">{workout.collectionName}</p>
          <p className="text-[11px] font-semibold text-primary tabular-nums">
            {completedSets}/{totalSets} séries
          </p>
        </div>
        <div className="flex items-center gap-1 text-zinc-500 text-xs tabular-nums min-w-13 justify-end">
          <ClockIcon className="w-3.5 h-3.5" />
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Progress bar */}
      {!done && (
        <div className="h-1 bg-white/5 shrink-0">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Body */}
      {done ? (
        <SuccessScreen xpAwarded={xpAwarded} onClose={handleClose} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 pb-28">
            {workout.exercises.map((row, idx) => (
              <ExerciseCard
                key={row.id}
                index={idx}
                total={workout.exercises.length}
                exercise={row.exercise}
                defaultSets={row.default_sets}
                defaultReps={row.default_reps}
                defaultWeightKg={row.default_weight_kg}
                sets={workoutSets[row.id] ?? []}
                onSetChange={(idx2, field, value) => handleSetChange(row.id, idx2, field, value)}
                onSetDone={(idx2) => handleSetDone(row.id, idx2)}
              />
            ))}
          </div>

          {/* Rest timer */}
          {session.restEndsAt && <RestTimerBar restEndsAt={session.restEndsAt} />}

          {/* Sticky footer */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-safe-bottom pb-6 pt-4 bg-linear-to-t from-background via-background/95 to-transparent">
            {error && (
              <p className="text-xs text-danger text-center mb-2">{error}</p>
            )}
            <button
              type="button"
              onClick={handleFinishClick}
              disabled={pending}
              className="w-full min-h-13 rounded-2xl bg-primary text-black font-black hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <FireIcon className="w-5 h-5" />
              {pending ? "Salvando..." : "Finalizar Treino"}
            </button>
          </div>
        </>
      )}

      {showEarlyFinish && (
        <EarlyFinishModal
          onConfirm={() => {
            setShowEarlyFinish(false);
            doFinish();
          }}
          onCancel={() => setShowEarlyFinish(false)}
        />
      )}
    </div>
  );
}
