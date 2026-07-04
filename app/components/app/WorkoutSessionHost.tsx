"use client";

import { useEffect, useState } from "react";
import { PlayCircleIcon } from "@heroicons/react/24/outline";
import { useWorkoutSession } from "@/lib/workout-session-store";
import { ActiveWorkout } from "./ActiveWorkout";

function useElapsedLabel(startedAt: string): string {
  const [label, setLabel] = useState("00:00:00");
  useEffect(() => {
    const started = new Date(startedAt).getTime();
    const tick = () => {
      const totalSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      setLabel(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return label;
}

function GlobalActiveWorkoutBanner() {
  const { session, isViewingWorkout, setViewingWorkout } = useWorkoutSession();
  const elapsed = useElapsedLabel(session?.startedAt ?? new Date().toISOString());

  if (!session || isViewingWorkout) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
      <button
        type="button"
        onClick={() => setViewingWorkout(true)}
        className="pointer-events-auto w-full max-w-lg flex items-center gap-3 bg-primary text-black rounded-2xl px-4 py-3 shadow-2xl active:scale-[0.98] transition-transform"
      >
        <PlayCircleIcon className="w-6 h-6 shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-black truncate">{session.workout.collectionName} em andamento</p>
          <p className="text-xs font-bold tabular-nums opacity-80">{elapsed}</p>
        </div>
        <span className="text-xs font-black uppercase shrink-0">Continuar</span>
      </button>
    </div>
  );
}

export function WorkoutSessionHost() {
  const { session, isViewingWorkout, setViewingWorkout } = useWorkoutSession();

  return (
    <>
      <GlobalActiveWorkoutBanner />
      {session && isViewingWorkout && (
        <ActiveWorkout onMinimize={() => setViewingWorkout(false)} />
      )}
    </>
  );
}
