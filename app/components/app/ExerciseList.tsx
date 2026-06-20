"use client";

import { useState } from "react";
import { PlayCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ExerciseVideoModal } from "./ExerciseVideoModal";

export type Exercise = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  webm_path: string | null;
};

type Props = { exercises: Exercise[] };

export function ExerciseList({ exercises }: Props) {
  const [search, setSearch]     = useState("");
  const [active, setActive]     = useState<Exercise | null>(null);

  const query    = search.trim().toLowerCase();
  const filtered = query
    ? exercises.filter((e) => e.title.toLowerCase().includes(query))
    : exercises;

  const hasVideo = (e: Exercise) => !!(e.youtube_url || e.webm_path);

  return (
    <>
      {/* Search */}
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
          {filtered.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center gap-4 p-4 bg-surface-1 border border-white/5 rounded-2xl"
            >
              {/* Play indicator */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                hasVideo(exercise) ? "bg-primary/10" : "bg-surface-2"
              }`}>
                <PlayCircleIcon className={`w-5 h-5 ${hasVideo(exercise) ? "text-primary" : "text-zinc-600"}`} />
              </div>

              {/* Title + description */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{exercise.title}</p>
                {exercise.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{exercise.description}</p>
                )}
              </div>

              {/* Ver Vídeo button */}
              {hasVideo(exercise) && (
                <button
                  type="button"
                  onClick={() => setActive(exercise)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Ver Vídeo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ExerciseVideoModal exercise={active} onClose={() => setActive(null)} />
    </>
  );
}
