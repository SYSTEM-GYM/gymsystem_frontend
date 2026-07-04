"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  FilmIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import {
  createStudentWorkout,
  searchStudentExercises,
  type StudentExerciseResult,
} from "@/app/app/workout-actions";
import { MUSCLE_GROUP_LABELS, resolveExerciseMedia } from "@/lib/exercise-utils";

type Step = "pick" | "review";

type SelectedExercise = StudentExerciseResult & { sets: number; reps: number };

function ExerciseTile({
  exercise,
  selected,
  onToggle,
}: {
  exercise: StudentExerciseResult;
  selected: boolean;
  onToggle: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const media = resolveExerciseMedia(exercise);
  const name = exercise.translated_name || exercise.title;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative text-left rounded-2xl overflow-hidden border transition-all active:scale-[0.98] ${
        selected ? "border-primary/60 ring-1 ring-primary/40" : "border-white/8"
      }`}
    >
      <div className="relative aspect-square bg-surface-2">
        {!failed && media.kind === "video" ? (
          <video
            src={media.url}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : !failed && media.kind === "youtube" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbUrl}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FilmIcon className="w-7 h-7 text-zinc-700" />
          </div>
        )}
        {selected && (
          <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
            <CheckCircleIcon className="w-9 h-9 text-primary drop-shadow" />
          </div>
        )}
      </div>
      <div className="p-2 bg-surface-1">
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{name}</p>
        {exercise.muscle_group && (
          <p className="text-[9px] text-zinc-600 mt-0.5">
            {MUSCLE_GROUP_LABELS[exercise.muscle_group] ?? exercise.muscle_group}
          </p>
        )}
      </div>
    </button>
  );
}

export function StudentWorkoutBuilderModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, SelectedExercise>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const searchSeq = useRef(0);

  // Results are keyed by the search they answer; loading is derived, so the
  // effect never calls setState synchronously.
  const searchKey = `${category ?? ""}|${query.trim()}`;
  const [searchData, setSearchData] = useState<{ key: string; rows: StudentExerciseResult[] }>({
    key: "__unloaded__",
    rows: [],
  });
  const loading = searchData.key !== searchKey;
  const results = searchData.rows;

  // Debounced search — re-runs on query/category change
  useEffect(() => {
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      const rows = await searchStudentExercises(query, category);
      if (searchSeq.current === seq) {
        setSearchData({ key: `${category ?? ""}|${query.trim()}`, rows });
      }
    }, query.trim().length >= 2 ? 280 : 0);
    return () => clearTimeout(t);
  }, [query, category]);

  const selectedList = useMemo(() => [...selected.values()], [selected]);

  function toggle(ex: StudentExerciseResult) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.set(ex.id, { ...ex, sets: 3, reps: 12 });
      return next;
    });
  }

  function updateSelected(id: string, patch: Partial<Pick<SelectedExercise, "sets" | "reps">>) {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, ...patch });
      return next;
    });
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await createStudentWorkout({
        name,
        exercises: selectedList.map((e) => ({
          exerciseId: e.id,
          sets: e.sets,
          reps: e.reps,
        })),
      });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.message);
      }
    });
  }

  const numberCls =
    "w-16 min-h-11 bg-surface-2 border border-white/10 rounded-xl text-center text-sm font-bold text-white tabular-nums focus:outline-none focus:border-primary/40";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 border-b border-white/5 bg-surface-1/80 backdrop-blur-sm shrink-0">
        <button
          type="button"
          onClick={() => (step === "review" ? setStep("pick") : onClose())}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors min-h-11 min-w-11 flex items-center justify-center"
        >
          {step === "review" ? <ArrowLeftIcon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
            Criar Meu Treino
          </p>
          <p className="text-sm font-black text-white">
            {step === "pick" ? "Escolha os exercícios" : "Revise e salve"}
          </p>
        </div>
        <span className="text-xs font-bold text-primary tabular-nums shrink-0">
          {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
        </span>
      </div>

      {step === "pick" ? (
        <>
          {/* Search + category chips */}
          <div className="px-4 pt-3 space-y-2.5 shrink-0">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar exercício..."
                className="w-full min-h-11 pl-11 pr-4 bg-surface-1 border border-white/8 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                  category === null
                    ? "bg-primary text-black border-primary"
                    : "bg-surface-1 border-white/10 text-zinc-500"
                }`}
              >
                Todos
              </button>
              {Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(category === value ? null : value)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                    category === value
                      ? "bg-primary text-black border-primary"
                      : "bg-surface-1 border-white/10 text-zinc-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-3/4 rounded-2xl bg-surface-1 animate-pulse" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="py-16 text-center">
                <FilmIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">Nenhum exercício encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {results.map((ex) => (
                  <ExerciseTile
                    key={ex.id}
                    exercise={ex}
                    selected={selected.has(ex.id)}
                    onToggle={() => toggle(ex)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Continue */}
          <div className="px-4 pb-safe-bottom pb-6 pt-3 bg-linear-to-t from-background via-background/95 to-transparent shrink-0">
            <button
              type="button"
              onClick={() => setStep("review")}
              disabled={selected.size === 0}
              className="w-full min-h-13 rounded-2xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              Continuar ({selected.size})
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Review list */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            <div>
              <label
                htmlFor="workout-name"
                className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
              >
                Nome do treino
              </label>
              <input
                id="workout-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Peito e Tríceps, Treino de Sábado..."
                maxLength={60}
                className="w-full min-h-12 px-4 bg-surface-1 border border-white/8 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
              />
            </div>

            <div className="space-y-2">
              {selectedList.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="flex items-center gap-3 bg-surface-1 border border-white/5 rounded-2xl p-3"
                >
                  <span className="w-6 text-center text-xs font-bold text-zinc-600 tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {ex.translated_name || ex.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={10}
                          value={ex.sets}
                          onChange={(e) =>
                            updateSelected(ex.id, { sets: parseInt(e.target.value, 10) || 1 })
                          }
                          className={numberCls}
                        />
                        <span className="text-[10px] text-zinc-600">séries</span>
                      </div>
                      <span className="text-zinc-700">×</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={ex.reps}
                          onChange={(e) =>
                            updateSelected(ex.id, { reps: parseInt(e.target.value, 10) || 1 })
                          }
                          className={numberCls}
                        />
                        <span className="text-[10px] text-zinc-600">reps</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(ex)}
                    className="p-2 text-zinc-600 hover:text-danger transition-colors shrink-0"
                    title="Remover exercício"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="px-4 pb-safe-bottom pb-6 pt-3 bg-linear-to-t from-background via-background/95 to-transparent shrink-0 space-y-2">
            {error && <p className="text-xs text-danger text-center">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || selected.size === 0 || name.trim().length < 3}
              className="w-full min-h-13 rounded-2xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <CheckIcon className="w-5 h-5" />
              {saving ? "Salvando..." : "Salvar Treino"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
