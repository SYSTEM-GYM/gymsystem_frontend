"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TodayWorkoutData } from "@/lib/workout-utils";

export type SetState = { weight: string; reps: string; done: boolean };
export type WorkoutSetsMap = Record<string, SetState[]>; // keyed by collection_exercise row id

export type ActiveWorkoutSession = {
  workout: TodayWorkoutData;
  workoutSets: WorkoutSetsMap;
  startedAt: string; // ISO
  restEndsAt: string | null;
  restSeconds: number;
};

type WorkoutSessionContextValue = {
  session: ActiveWorkoutSession | null;
  isViewingWorkout: boolean;
  setViewingWorkout: (viewing: boolean) => void;
  startSession: (workout: TodayWorkoutData, workoutSets: WorkoutSetsMap) => void;
  updateSets: (updater: (prev: WorkoutSetsMap) => WorkoutSetsMap) => void;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  clearRest: () => void;
  endSession: () => void;
};

const STORAGE_KEY = "gym:activeWorkoutSession";

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | null>(null);

function readStoredSession(): ActiveWorkoutSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveWorkoutSession;
  } catch {
    return null;
  }
}

export function WorkoutSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [isViewingWorkout, setViewingWorkout] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only localStorage read, deferred to avoid SSR hydration mismatch
    setSession(readStoredSession());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session, hydrated]);

  const startSession = useCallback((workout: TodayWorkoutData, workoutSets: WorkoutSetsMap) => {
    setSession({
      workout,
      workoutSets,
      startedAt: new Date().toISOString(),
      restEndsAt: null,
      restSeconds: 0,
    });
    setViewingWorkout(true);
  }, []);

  const updateSets = useCallback((updater: (prev: WorkoutSetsMap) => WorkoutSetsMap) => {
    setSession((prev) => (prev ? { ...prev, workoutSets: updater(prev.workoutSets) } : prev));
  }, []);

  const startRest = useCallback((seconds: number) => {
    setSession((prev) =>
      prev
        ? { ...prev, restSeconds: seconds, restEndsAt: new Date(Date.now() + seconds * 1000).toISOString() }
        : prev,
    );
  }, []);

  const adjustRest = useCallback((deltaSeconds: number) => {
    setSession((prev) => {
      if (!prev || !prev.restEndsAt) return prev;
      const remainingMs = Math.max(0, new Date(prev.restEndsAt).getTime() - Date.now());
      const nextRemainingMs = Math.max(0, remainingMs + deltaSeconds * 1000);
      if (nextRemainingMs === 0) return { ...prev, restEndsAt: null, restSeconds: 0 };
      return { ...prev, restEndsAt: new Date(Date.now() + nextRemainingMs).toISOString() };
    });
  }, []);

  const clearRest = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, restEndsAt: null, restSeconds: 0 } : prev));
  }, []);

  const endSession = useCallback(() => {
    setSession(null);
    setViewingWorkout(false);
  }, []);

  const value = useMemo<WorkoutSessionContextValue>(
    () => ({
      session,
      isViewingWorkout,
      setViewingWorkout,
      startSession,
      updateSets,
      startRest,
      adjustRest,
      clearRest,
      endSession,
    }),
    [session, isViewingWorkout, startSession, updateSets, startRest, adjustRest, clearRest, endSession],
  );

  return (
    <WorkoutSessionContext.Provider value={value}>{children}</WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) throw new Error("useWorkoutSession must be used within a WorkoutSessionProvider");
  return ctx;
}
