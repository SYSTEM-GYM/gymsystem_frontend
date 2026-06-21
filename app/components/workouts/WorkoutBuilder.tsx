"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FilmIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { createWorkout } from "@/app/dashboard/workouts/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExerciseOption = {
  id: string;
  title: string;
  primary_muscle: string | null;
  youtube_url: string | null;
  webm_path: string | null;
  video_url: string | null;
};

type BuilderItem = {
  key: string;
  exercise: ExerciseOption;
  sets: number;
  reps: number;
};

type Props = {
  exercises: ExerciseOption[];
  gyms: { id: string; name: string }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const m =
    url.match(/youtube\.com\/watch\?v=([^&]+)/) ??
    url.match(/youtu\.be\/([^?]+)/);
  return m?.[1] ?? null;
}

// ── Video Thumbnail ───────────────────────────────────────────────────────────

function ExerciseThumbnail({ exercise }: { exercise: ExerciseOption }) {
  const ytId = extractYoutubeId(exercise.youtube_url);

  if (exercise.video_url) {
    return (
      <video
        src={exercise.video_url}
        muted
        autoPlay
        loop
        playsInline
        className="w-14 h-14 object-cover rounded-2xl flex-shrink-0 bg-zinc-900"
      />
    );
  }
  if (ytId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://img.youtube.com/vi/${ytId}/default.jpg`}
        alt={exercise.title}
        className="w-14 h-14 object-cover rounded-2xl flex-shrink-0 bg-zinc-900"
      />
    );
  }
  return (
    <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center flex-shrink-0">
      <FilmIcon className="w-6 h-6 text-zinc-600" />
    </div>
  );
}

// ── Exercise Combobox ─────────────────────────────────────────────────────────

function ExerciseCombobox({
  exercises,
  usedIds,
  onSelect,
}: {
  exercises: ExerciseOption[];
  usedIds: Set<string>;
  onSelect: (ex: ExerciseOption) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) => !usedIds.has(e.id) && (!q || e.title.toLowerCase().includes(q)),
    );
  }, [exercises, usedIds, query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(ex: ExerciseOption) {
    onSelect(ex);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2"
      >
        Buscar exercício
      </label>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar exercício..."
          autoComplete="off"
          className="w-full pl-11 pr-4 py-3 bg-surface-2 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
        />
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-30 top-full mt-2 w-full bg-surface-1 border border-white/10 rounded-2xl shadow-2xl max-h-72 overflow-y-auto">
          {filtered.slice(0, 50).map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(ex)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <ExerciseThumbnail exercise={ex} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{ex.title}</p>
                  {ex.primary_muscle && (
                    <p className="text-xs text-zinc-500 capitalize">{ex.primary_muscle}</p>
                  )}
                </div>
                <PlusIcon className="w-4 h-4 text-primary flex-shrink-0 ml-auto" />
              </button>
            </li>
          ))}
          {filtered.length > 50 && (
            <li className="px-4 py-2 text-xs text-zinc-600 text-center">
              {filtered.length - 50} exercícios ocultos — refine a busca
            </li>
          )}
        </ul>
      )}

      {open && query && filtered.length === 0 && (
        <div className="absolute z-30 top-full mt-2 w-full bg-surface-1 border border-white/10 rounded-2xl shadow-2xl px-4 py-4 text-sm text-zinc-500 text-center">
          Nenhum exercício encontrado para &quot;{query}&quot;.
        </div>
      )}
    </div>
  );
}

// ── Builder Item Row ──────────────────────────────────────────────────────────

function BuilderItemRow({
  item,
  index,
  onRemove,
  onChangeSets,
  onChangeReps,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  item: BuilderItem;
  index: number;
  onRemove: () => void;
  onChangeSets: (v: number) => void;
  onChangeReps: (v: number) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const inputCls =
    "w-16 bg-surface-2 border border-white/10 rounded-xl px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-primary/50 transition-colors tabular-nums";

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 p-3 bg-surface-1 border rounded-2xl transition-all ${
        isDragging
          ? "border-primary/40 opacity-50"
          : "border-white/5 hover:border-white/10"
      }`}
    >
      <Bars3Icon className="w-4 h-4 text-zinc-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />

      <span className="w-5 text-xs text-zinc-600 tabular-nums text-center flex-shrink-0">
        {index + 1}
      </span>

      <ExerciseThumbnail exercise={item.exercise} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{item.exercise.title}</p>
        {item.exercise.primary_muscle && (
          <p className="text-xs text-zinc-500 capitalize mt-0.5">{item.exercise.primary_muscle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Séries</span>
          <input
            type="number"
            min={1}
            max={20}
            value={item.sets}
            onChange={(e) => onChangeSets(Math.max(1, parseInt(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
        <span className="text-zinc-700 text-xs mt-3">×</span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Reps</span>
          <input
            type="number"
            min={1}
            max={200}
            value={item.reps}
            onChange={(e) => onChangeReps(Math.max(1, parseInt(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-zinc-600 hover:text-danger transition-colors flex-shrink-0"
        aria-label="Remover exercício"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </li>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorkoutBuilder({ exercises, gyms }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gymId, setGymId] = useState("");
  const [duration, setDuration] = useState(60);

  // Exercise list
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Feedback
  const [result, setResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  const usedIds = useMemo(() => new Set(items.map((i) => i.exercise.id)), [items]);

  const addExercise = useCallback((ex: ExerciseOption) => {
    setItems((prev) => [
      ...prev,
      { key: `${ex.id}-${Date.now()}`, exercise: ex, sets: 3, reps: 12 },
    ]);
  }, []);

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, patch: Partial<Pick<BuilderItem, "sets" | "reps">>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  // Drag-and-drop reorder
  function handleDragOver(e: React.DragEvent, overIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === overIdx) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      return next;
    });
    setDragIdx(overIdx);
  }

  function handleSubmit() {
    setResult(null);
    startTransition(async () => {
      const res = await createWorkout({
        name,
        description: description || null,
        gym_id: gymId || null,
        estimated_duration_minutes: duration,
        exercises: items.map((item, i) => ({
          exercise_id: item.exercise.id,
          sort_order: i,
          default_sets: item.sets,
          default_reps: item.reps,
        })),
      });

      if (res.ok) {
        setResult({ ok: true });
        setTimeout(() => router.push("/dashboard/workouts"), 1200);
      } else {
        setResult({ ok: false, message: res.message });
      }
    });
  }

  const inputCls =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelCls =
    "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2";

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
            Nova Ficha
          </p>
          <h1 className="text-2xl font-black text-white">Montar Treino</h1>
        </div>
      </div>

      {/* Workout metadata */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-6 space-y-5">
        <div>
          <label className={labelCls}>Nome do Treino *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Treino A — Peito e Tríceps"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Descrição <span className="text-zinc-600 normal-case">(opcional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Foco do treino, observações para o aluno..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Filial <span className="text-zinc-600 normal-case">(opcional)</span></label>
            <select
              value={gymId}
              onChange={(e) => setGymId(e.target.value)}
              className={inputCls}
            >
              <option value="">Todas as filiais</option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Duração estimada (min)</label>
            <input
              type="number"
              min={10}
              max={300}
              value={duration}
              onChange={(e) => setDuration(Math.max(10, parseInt(e.target.value) || 60))}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Exercise selector */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-6">
        <ExerciseCombobox
          exercises={exercises}
          usedIds={usedIds}
          onSelect={addExercise}
        />
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-10 bg-surface-1 border border-dashed border-white/10 rounded-3xl text-center space-y-2">
            <p className="text-sm font-semibold text-zinc-500">Nenhum exercício adicionado</p>
            <p className="text-xs text-zinc-600">
              Use o campo acima para buscar e adicionar exercícios à ficha.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Exercícios ({items.length})
              </p>
              <p className="text-xs text-zinc-600">Arraste para reordenar</p>
            </div>
            <ul className="space-y-2">
              {items.map((item, idx) => (
                <BuilderItemRow
                  key={item.key}
                  item={item}
                  index={idx}
                  onRemove={() => removeItem(item.key)}
                  onChangeSets={(v) => updateItem(item.key, { sets: v })}
                  onChangeReps={(v) => updateItem(item.key, { reps: v })}
                  isDragging={dragIdx === idx}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={() => setDragIdx(null)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Feedback */}
      {result && !result.ok && (
        <div className="flex items-center gap-3 px-4 py-3 bg-danger/10 border border-danger/20 rounded-2xl">
          <ExclamationTriangleIcon className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{result.message}</p>
        </div>
      )}
      {result?.ok && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl">
          <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm text-primary font-semibold">Treino salvo com sucesso!</p>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !name.trim() || items.length === 0 || result?.ok}
        className="w-full py-4 rounded-2xl text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99] transition-transform"
      >
        {isPending ? "Salvando treino..." : "Salvar Treino"}
      </button>
    </div>
  );
}
