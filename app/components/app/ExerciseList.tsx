"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { PlayCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ExerciseVideoModal } from "./ExerciseVideoModal";
import { ExerciseRowSkeleton } from "@/components/ui/Skeleton";

export type Exercise = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  webm_path: string | null;
};

const PAGE_SIZE = 20;

type Props = { exercises: Exercise[] };

export function ExerciseList({ exercises }: Props) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Exercise | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? exercises.filter((e) => e.title.toLowerCase().includes(query))
        : exercises,
    [exercises, query],
  );

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "120px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const hasVideo = (e: Exercise) => !!(e.youtube_url || e.webm_path);

  return (
    <>
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          className="w-full pl-11 pr-4 py-3 bg-surface-1 border border-white/5 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-500">
            {search ? `Nenhum resultado para "${search}".` : "Nenhum exercício cadastrado ainda."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center gap-4 p-4 bg-surface-1 border border-white/5 rounded-2xl"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  hasVideo(exercise) ? "bg-primary/10" : "bg-surface-2"
                }`}
              >
                <PlayCircleIcon
                  className={`w-5 h-5 ${hasVideo(exercise) ? "text-primary" : "text-zinc-600"}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{exercise.title}</p>
                {exercise.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{exercise.description}</p>
                )}
              </div>

              {hasVideo(exercise) && (
                <button
                  type="button"
                  onClick={() => setActive(exercise)}
                  className="flex-shrink-0 min-h-[44px] px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Ver Vídeo
                </button>
              )}
            </li>
          ))}

          {hasMore && (
            <li ref={sentinelRef} className="space-y-2" aria-hidden="true">
              <ExerciseRowSkeleton />
              <ExerciseRowSkeleton />
            </li>
          )}
        </ul>
      )}

      <ExerciseVideoModal exercise={active} onClose={() => setActive(null)} />
    </>
  );
}
