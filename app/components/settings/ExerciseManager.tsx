"use client";

import { useActionState, useEffect, useState } from "react";
import {
  PlusIcon,
  XMarkIcon,
  PlayIcon,
  FilmIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { createExercise, type SettingsActionState } from "@/app/dashboard/settings/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Exercise = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  created_at: string;
};

type Props = {
  initialExercises: Exercise[];
};

const INITIAL_STATE: SettingsActionState = { status: "idle" };

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateExerciseModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createExercise, INITIAL_STATE);
  const [videoType, setVideoType] = useState<"none" | "youtube" | "webm">("none");

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const inputClass =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelClass =
    "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-surface-1 border border-white/10 rounded-3xl shadow-2xl my-4">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-white">Novo Exercício</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Adicione um exercício à biblioteca compartilhada.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <form action={formAction} className="px-6 py-6 space-y-5">
            {/* Title */}
            <div>
              <label htmlFor="ex-title" className={labelClass}>
                Título
              </label>
              <input
                id="ex-title"
                name="title"
                type="text"
                placeholder="Ex: Agachamento livre"
                required
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="ex-description" className={labelClass}>
                Descrição <span className="text-zinc-600 normal-case">(opcional)</span>
              </label>
              <textarea
                id="ex-description"
                name="description"
                rows={3}
                placeholder="Execução, músculos trabalhados, dicas de segurança..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Video type selector */}
            <div>
              <p className={labelClass}>Vídeo de demonstração</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "none",    label: "Sem vídeo",  Icon: FilmIcon },
                    { value: "youtube", label: "YouTube",    Icon: PlayIcon },
                    { value: "webm",    label: "Arquivo",    Icon: VideoCameraIcon },
                  ] as const
                ).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVideoType(value)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border text-xs font-semibold transition-all ${
                      videoType === value
                        ? "bg-primary/10 border-primary/50 text-primary"
                        : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Hidden field so the action knows video_type */}
              <input type="hidden" name="video_type" value={videoType} />
            </div>

            {/* YouTube URL */}
            {videoType === "youtube" && (
              <div>
                <label htmlFor="ex-youtube" className={labelClass}>
                  URL do YouTube
                </label>
                <input
                  id="ex-youtube"
                  name="youtube_url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={inputClass}
                />
              </div>
            )}

            {/* WebM upload placeholder */}
            {videoType === "webm" && (
              <div>
                <label htmlFor="ex-webm" className={labelClass}>
                  Arquivo de vídeo (WebM)
                </label>
                <div className="relative">
                  <input
                    id="ex-webm"
                    name="webm_file"
                    type="file"
                    accept="video/webm"
                    disabled
                    className={`${inputClass} opacity-40 cursor-not-allowed`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-600 bg-surface-2 px-2 py-0.5 rounded-lg">
                    Em breve
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-zinc-600">
                  Upload via Supabase Storage será habilitado na próxima fase.
                </p>
              </div>
            )}

            {state.status === "error" && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">
                {state.message}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const hasVideo = !!(exercise.youtube_url || exercise.webm_path);

  return (
    <div className="bg-surface-2/50 border border-white/5 rounded-2xl p-4 flex gap-4 hover:border-white/10 transition-colors">
      {/* Video badge */}
      <div
        className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
          exercise.youtube_url
            ? "bg-red-500/10"
            : exercise.webm_path
            ? "bg-primary/10"
            : "bg-zinc-800"
        }`}
      >
        {exercise.youtube_url ? (
          <PlayIcon className="w-5 h-5 text-red-400" />
        ) : exercise.webm_path ? (
          <VideoCameraIcon className="w-5 h-5 text-primary" />
        ) : (
          <FilmIcon className="w-5 h-5 text-zinc-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white text-sm truncate">{exercise.title}</p>
        {exercise.description && (
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
            {exercise.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {hasVideo ? (
            <span className="text-xs text-primary font-medium">
              {exercise.youtube_url ? "YouTube" : "Arquivo WebM"}
            </span>
          ) : (
            <span className="text-xs text-zinc-600">Sem vídeo</span>
          )}
          <span className="text-zinc-700 text-xs">·</span>
          <span className="text-xs text-zinc-600 tabular-nums">
            {new Intl.DateTimeFormat("pt-BR").format(new Date(exercise.created_at))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ExerciseManager({ initialExercises }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div>
          <h2 className="text-base font-bold text-white">Biblioteca de Exercícios</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Exercícios disponíveis para montagem de treinos.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Exercício
        </button>
      </div>

      {initialExercises.length === 0 ? (
        <div className="p-12 flex flex-col items-center gap-3 text-center">
          <VideoCameraIcon className="w-10 h-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">Nenhum exercício cadastrado.</p>
          <p className="text-xs text-zinc-600">
            Adicione exercícios para montar os treinos dos alunos.
          </p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {initialExercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} />
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t border-white/5">
        <span className="text-xs text-zinc-600">
          {initialExercises.length} exercício{initialExercises.length !== 1 ? "s" : ""} na biblioteca
        </span>
      </div>

      {showModal && <CreateExerciseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
