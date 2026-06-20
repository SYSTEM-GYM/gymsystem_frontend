"use client";

import { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

type Exercise = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  webm_path: string | null;
};

type Props = {
  exercise: Exercise | null;
  onClose: () => void;
};

function getYouTubeEmbedUrl(url: string): string {
  // Handles both https://youtu.be/ID and https://www.youtube.com/watch?v=ID
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  const longMatch  = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  const videoId    = shortMatch?.[1] ?? longMatch?.[1];
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
}

export function ExerciseVideoModal({ exercise, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!exercise) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [exercise, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (exercise) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [exercise]);

  if (!exercise) return null;

  const hasYoutube = !!exercise.youtube_url;
  const hasWebm    = !!exercise.webm_path;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="pointer-events-auto w-full sm:max-w-lg bg-surface-1 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-white">{exercise.title}</h3>
              {exercise.description && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{exercise.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors flex-shrink-0 ml-3"
              aria-label="Fechar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Video area */}
          <div className="bg-black">
            {hasYoutube && (
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={getYouTubeEmbedUrl(exercise.youtube_url!)}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={exercise.title}
                />
              </div>
            )}

            {!hasYoutube && hasWebm && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={exercise.webm_path!}
                controls
                autoPlay
                playsInline
                className="w-full"
              />
            )}

            {!hasYoutube && !hasWebm && (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-zinc-600">Nenhum vídeo disponível para este exercício.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
