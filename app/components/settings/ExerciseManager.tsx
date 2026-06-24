"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  PlusIcon,
  XMarkIcon,
  PlayIcon,
  FilmIcon,
  VideoCameraIcon,
  TrashIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  createExercise,
  deleteExercise,
  seedDefaultExercises,
  syncExercisesFromCloudflare,
  type SettingsActionState,
} from "@/app/dashboard/settings/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Exercise = {
  id: string;
  title: string;
  translated_name: string | null;
  description: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
  created_at: string;
};

type Props = {
  initialExercises: Exercise[];
};

const INITIAL_STATE: SettingsActionState = { status: "idle" };

// ── Submit Button ─────────────────────────────────────────────────────────────

function SubmitButton({ videoType }: { videoType: "none" | "youtube" | "webm" }) {
  const { pending } = useFormStatus();
  const label = pending
    ? videoType === "webm"
      ? "Enviando vídeo..."
      : "Salvando..."
    : "Salvar";

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      {label}
    </button>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateExerciseModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(createExercise, INITIAL_STATE);
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

              <input type="hidden" name="video_type" value={videoType} />
            </div>

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

            {videoType === "webm" && (
              <div>
                <label htmlFor="ex-webm" className={labelClass}>
                  Arquivo de vídeo (WebM)
                </label>
                <input
                  id="ex-webm"
                  name="webm_file"
                  type="file"
                  accept="video/webm"
                  className={`${inputClass} file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer`}
                />
                <p className="mt-1.5 text-xs text-zinc-600">
                  Máximo 100 MB · somente formato .webm
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
              <SubmitButton videoType={videoType} />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExercise(exercise.id);
      if (result.status === "error") {
        setError(result.message);
      } else {
        onClose();
      }
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl shadow-2xl p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto">
            <TrashIcon className="w-6 h-6 text-danger" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Excluir Exercício</h3>
            <p className="text-sm text-zinc-500">
              Tem certeza que deseja excluir{" "}
              <span className="text-white font-semibold">{exercise.title}</span>? Esta ação não pode ser desfeita.
            </p>
          </div>
          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3 text-center">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 py-3 rounded-full text-sm font-bold bg-danger text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isPending ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseVideoPreview({ exercise }: { exercise: Exercise }) {
  if (exercise.video_url) {
    return (
      <video
        src={exercise.video_url}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-32 object-cover rounded-xl"
      />
    );
  }
  if (exercise.youtube_url) {
    const m =
      exercise.youtube_url.match(/youtube\.com\/watch\?v=([^&]+)/) ??
      exercise.youtube_url.match(/youtu\.be\/([^?]+)/);
    const ytId = m?.[1];
    if (ytId) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
          alt={exercise.title}
          className="w-full h-32 object-cover rounded-xl"
        />
      );
    }
  }
  return null;
}

function ExerciseCard({
  exercise,
  onDelete,
}: {
  exercise: Exercise;
  onDelete: (e: Exercise) => void;
}) {
  const hasVideo = !!(exercise.video_url || exercise.youtube_url || exercise.webm_path);

  const videoLabel = exercise.video_url
    ? "R2 WebM"
    : exercise.youtube_url
    ? "YouTube"
    : exercise.webm_path
    ? "Arquivo WebM"
    : null;

  const preview = <ExerciseVideoPreview exercise={exercise} />;

  return (
    <div className="bg-surface-2/50 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors group">
      {/* Video preview strip */}
      {preview && (
        <div className="relative bg-zinc-900">
          {preview}
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-primary backdrop-blur-sm">
            {videoLabel}
          </span>
        </div>
      )}

      <div className="p-4 flex gap-3">
        {/* Icon badge (shown only when no video preview) */}
        {!preview && (
          <div
            className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
              hasVideo ? "bg-primary/10" : "bg-zinc-800"
            }`}
          >
            {hasVideo ? (
              <VideoCameraIcon className="w-5 h-5 text-primary" />
            ) : (
              <FilmIcon className="w-5 h-5 text-zinc-600" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white text-sm truncate">
            {exercise.translated_name || exercise.title}
          </p>
          {exercise.description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
              {exercise.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {videoLabel && !preview ? (
              <span className="text-xs text-primary font-medium">{videoLabel}</span>
            ) : !hasVideo ? (
              <span className="text-xs text-zinc-600">Sem vídeo</span>
            ) : null}
            <span className="text-xs text-zinc-600 tabular-nums">
              {new Intl.DateTimeFormat("pt-BR").format(new Date(exercise.created_at))}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            type="button"
            onClick={() => onDelete(exercise)}
            title="Excluir exercício"
            className="p-2 rounded-xl text-zinc-500 hover:bg-danger/10 hover:text-danger transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action Buttons ────────────────────────────────────────────────────────────

function R2SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const res = await syncExercisesFromCloudflare();
      setResult(
        res.ok
          ? { ok: true, message: `${res.count} exercícios sincronizados do Cloudflare R2!` }
          : { ok: false, message: res.error },
      );
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
      >
        <SparklesIcon className="w-4 h-4" />
        {isPending ? "Sincronizando com R2..." : "☁️ Sincronizar com Cloudflare R2"}
      </button>
      {result && (
        <p className={`text-xs ${result.ok ? "text-primary" : "text-danger"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function SeedExercisesButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSeed() {
    setResult(null);
    startTransition(async () => {
      const res = await seedDefaultExercises();
      setResult(
        res.ok
          ? { ok: true, message: `${res.count} exercícios padrão adicionados!` }
          : { ok: false, message: res.error },
      );
    });
  }

  return (
    <button
      type="button"
      onClick={handleSeed}
      disabled={isPending}
      className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-40"
    >
      {isPending ? "Adicionando..." : "Ou adicionar 35 exercícios padrão"}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ExerciseManager({ initialExercises }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [toDelete, setToDelete] = useState<Exercise | null>(null);

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
        <div className="p-12 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <VideoCameraIcon className="w-8 h-8 text-zinc-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-400">Biblioteca de exercícios vazia</p>
            <p className="text-xs text-zinc-600 max-w-xs">
              Popule instantaneamente com 35 exercícios essenciais já traduzidos para pt-BR, ou adicione manualmente.
            </p>
          </div>
          <R2SyncButton />
          <SeedExercisesButton />
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {initialExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onDelete={setToDelete}
            />
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t border-white/5">
        <span className="text-xs text-zinc-600">
          {initialExercises.length} exercício{initialExercises.length !== 1 ? "s" : ""} na biblioteca
        </span>
      </div>

      {showModal && <CreateExerciseModal onClose={() => setShowModal(false)} />}
      {toDelete && (
        <DeleteConfirmModal exercise={toDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
