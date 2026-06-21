"use client";

import { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export type Exercise = {
  id: string;
  title: string;
  translated_name: string | null;
  description: string | null;
  instructions: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
};

type Props = {
  exercise: Exercise | null;
  onClose: () => void;
};

function getYouTubeEmbedUrl(url: string): string {
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  const longMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  const videoId = shortMatch?.[1] ?? longMatch?.[1];
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
}

export function ExerciseVideoModal({ exercise, onClose }: Props) {
  const [loadVideo, setLoadVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!exercise) {
      setLoadVideo(false);
      return;
    }
    setLoadVideo(false);
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [exercise, onClose]);

  useEffect(() => {
    if (exercise) {
      document.body.style.overflow = "hidden";
      const t = requestAnimationFrame(() => setLoadVideo(true));
      return () => {
        cancelAnimationFrame(t);
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
  }, [exercise]);

  // Slow playback rate for WebM animations so beginners can follow the movement
  useEffect(() => {
    const vid = videoRef.current;
    if (vid && loadVideo) {
      vid.playbackRate = 0.35;
    }
  }, [loadVideo]);

  if (!exercise) return null;

  const displayTitle = exercise.translated_name || exercise.title;
  const hasYoutube = !!exercise.youtube_url;
  // video_url (R2) takes priority over legacy webm_path
  const webmSrc = exercise.video_url || exercise.webm_path || null;
  const hasWebm = !!webmSrc;

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
              <h3 className="text-base font-bold text-white">{displayTitle}</h3>
              {exercise.description && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{exercise.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors flex-shrink-0 ml-3 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fechar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Video */}
          <div className="bg-black min-h-[200px]">
            {hasYoutube && loadVideo && (
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={getYouTubeEmbedUrl(exercise.youtube_url!)}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={displayTitle}
                  loading="lazy"
                />
              </div>
            )}

            {!hasYoutube && hasWebm && loadVideo && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={videoRef}
                src={webmSrc!}
                autoPlay
                loop
                muted
                playsInline
                preload="none"
                className="w-full"
                onLoadedMetadata={() => {
                  if (videoRef.current) videoRef.current.playbackRate = 0.35;
                }}
              />
            )}

            {!loadVideo && (hasYoutube || hasWebm) && (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!hasYoutube && !hasWebm && (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-zinc-600">Nenhum vídeo disponível para este exercício.</p>
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
