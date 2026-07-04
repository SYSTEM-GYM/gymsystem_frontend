"use client";

import { useEffect, useRef, useState } from "react";
import { FilmIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { resolveExerciseMedia } from "@/lib/exercise-utils";

export type Exercise = {
  id: string;
  title: string;
  translated_name: string | null;
  description: string | null;
  instructions: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
  muscle_group?: string | null;
};

type Props = {
  exercise: Exercise | null;
  onClose: () => void;
};

type MediaState = { id: string | null; load: boolean; failed: boolean };

export function ExerciseVideoModal({ exercise, onClose }: Props) {
  const [media, setMedia] = useState<MediaState>({ id: null, load: false, failed: false });
  const videoRef = useRef<HTMLVideoElement>(null);

  // Render-phase reset when the opened exercise changes. Keyed by id — NOT by
  // onClose/object identity: onClose gets a new identity on every parent
  // re-render (ActiveWorkout re-renders each second for the elapsed timer),
  // and the previous effect-based reset left the spinner stuck forever.
  const exerciseId = exercise?.id ?? null;
  if (media.id !== exerciseId) {
    setMedia({ id: exerciseId, load: false, failed: false });
  }

  const loadVideo = media.id === exerciseId && media.load;
  const mediaFailed = media.id === exerciseId && media.failed;
  const markFailed = () => setMedia((s) => ({ ...s, failed: true }));

  // Escape key handler
  useEffect(() => {
    if (!exercise) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [exercise, onClose]);

  // Lock body scroll and lazy-load media one frame after opening
  useEffect(() => {
    if (!exerciseId) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() =>
      setMedia((s) => (s.id === exerciseId ? { ...s, load: true } : s)),
    );
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = "";
    };
  }, [exerciseId]);

  // Slow playback rate for WebM animations so beginners can follow the movement
  useEffect(() => {
    const vid = videoRef.current;
    if (vid && loadVideo) {
      vid.playbackRate = 0.35;
    }
  }, [loadVideo]);

  if (!exercise) return null;

  const displayTitle = exercise.translated_name || exercise.title;
  // Resolves R2 direct video vs YouTube embed — including R2 URLs stored in
  // youtube_url by the importer, which must play as <video>, not iframe.
  const mediaSource = resolveExerciseMedia(exercise);
  const hasYoutube = mediaSource.kind === "youtube";
  const hasDirectVideo = mediaSource.kind === "video";

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div className="pointer-events-auto w-full sm:max-w-lg bg-surface-1 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h3 className="font-bold text-white">{displayTitle}</h3>
              {exercise.description && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{exercise.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors shrink-0 ml-3 min-w-11 min-h-11 flex items-center justify-center"
              aria-label="Fechar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Video */}
          <div className="bg-black min-h-50">
            {hasYoutube && mediaSource.kind === "youtube" && loadVideo && (
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={mediaSource.embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={displayTitle}
                  loading="lazy"
                />
              </div>
            )}

            {mediaSource.kind === "video" && loadVideo && !mediaFailed && (
              <video
                ref={videoRef}
                src={mediaSource.url}
                autoPlay
                loop
                muted
                playsInline
                preload="none"
                className="w-full"
                onError={markFailed}
                onLoadedMetadata={() => {
                  if (videoRef.current) videoRef.current.playbackRate = 0.35;
                }}
              />
            )}

            {!loadVideo && !mediaFailed && (hasYoutube || hasDirectVideo) && (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {(mediaFailed || (!hasYoutube && !hasDirectVideo)) && (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <FilmIcon className="w-8 h-8 text-zinc-700" />
                <p className="text-sm text-zinc-600">
                  {mediaFailed
                    ? "Não foi possível carregar o vídeo."
                    : "Nenhum vídeo disponível para este exercício."}
                </p>
              </div>
            )}
          </div>

          {/* Instructions */}
          {exercise.instructions && (
            <div className="px-5 py-4 border-t border-white/5 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Execução
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                {exercise.instructions}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
