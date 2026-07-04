"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { FilmIcon, PlayCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ExerciseVideoModal, type Exercise } from "./ExerciseVideoModal";
import { ExerciseRowSkeleton } from "@/components/ui/Skeleton";
import { muscleGroupLabel, resolveExerciseMedia } from "@/lib/exercise-utils";

export type { Exercise };

const PAGE_SIZE = 20;

function ExerciseThumb({ exercise, alt }: { exercise: Exercise; alt: string }) {
  const [failed, setFailed] = useState(false);
  const media = resolveExerciseMedia(exercise);

  if (!failed && media.kind === "video") {
    return (
      <video
        src={media.url}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  if (!failed && media.kind === "youtube") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.thumbUrl}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-900">
      <FilmIcon className="w-8 h-8 text-zinc-600" />
    </div>
  );
}

type Props = { exercises: Exercise[] };

export function ExerciseList({ exercises }: Props) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Exercise | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const query = search.trim().toLowerCase();

  // Render-phase pagination reset when the search changes (avoids an
  // effect-based setState cascade)
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setVisibleCount(PAGE_SIZE);
  }
  const filtered = useMemo(
    () =>
      query
        ? exercises.filter(
            (e) =>
              e.title.toLowerCase().includes(query) ||
              (e.translated_name ?? "").toLowerCase().includes(query),
          )
        : exercises,
    [exercises, query],
  );

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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

  const hasVideo = (e: Exercise) => resolveExerciseMedia(e).kind !== "none";

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
        <ul className="space-y-3">
          {visible.map((exercise) => {
            const clickable = hasVideo(exercise);
            const displayName = exercise.translated_name || exercise.title;
            const muscleLabel = muscleGroupLabel(exercise.muscle_group);
            return (
              <li
                key={exercise.id}
                onClick={() => clickable && setActive(exercise)}
                className={`flex items-stretch bg-surface-1 border border-white/5 rounded-2xl overflow-hidden transition-colors ${
                  clickable ? "cursor-pointer hover:border-primary/20 active:scale-[0.99]" : ""
                }`}
              >
                {/* Thumbnail — strictly left, fixed size */}
                <div className="w-24 h-24 shrink-0 relative bg-zinc-800">
                  <ExerciseThumb exercise={exercise} alt={displayName} />
                  {/* Play overlay for video items */}
                  {clickable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                      <PlayCircleIcon className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  )}
                </div>

                {/* Info — right side, left-aligned text */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-3 px-4">
                  <p className="text-sm font-bold text-white leading-tight text-left">
                    {displayName}
                  </p>
                  {exercise.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 text-left">
                      {exercise.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    {muscleLabel && (
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-2 text-zinc-400 border border-white/5">
                        {muscleLabel}
                      </span>
                    )}
                    {clickable && (
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                        Ver Vídeo
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}

          {hasMore && (
            <li ref={sentinelRef} className="space-y-3" aria-hidden="true">
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
