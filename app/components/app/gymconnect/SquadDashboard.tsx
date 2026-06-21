"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UsersIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowRightStartOnRectangleIcon,
  PlusIcon,
  XMarkIcon,
  ClockIcon,
  CalendarDaysIcon,
  ShareIcon,
  TrashIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import {
  TrophyIcon,
  FireIcon,
  BoltIcon,
  FlagIcon,
} from "@heroicons/react/24/solid";
import type {
  SquadDetail,
  SquadMember,
  FeedEntry,
  Challenge,
  SharedWorkout,
  ChallengeType,
} from "@/app/app/gymconnect-actions";
import {
  leaveSquad,
  createChallenge,
  shareWorkout,
  removeSharedWorkout,
  getExercisesForPicker,
  getMyCollectionsForSharing,
} from "@/app/app/gymconnect-actions";
import { ActiveWorkout } from "@/app/components/app/ActiveWorkout";
import type { TodayWorkoutData } from "@/lib/workout-utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function displayName(m: Pick<SquadMember, "first_name" | "full_name">): string {
  return m.first_name ?? m.full_name?.split(" ")[0] ?? "Aluno";
}

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}

const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  frequency: "Frequência",
  volume: "Volume",
  max_weight: "Carga Máxima",
};

const CHALLENGE_UNIT: Record<ChallengeType, string> = {
  frequency: "treinos",
  volume: "kg·reps",
  max_weight: "kg",
};

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  photo_url,
  name,
  size = "md",
}: {
  photo_url: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" };
  const cls = sizes[size];

  if (photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo_url} alt={name} className={`${cls} rounded-xl object-cover flex-shrink-0`} />;
  }

  const init = name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`${cls} rounded-xl bg-primary/15 flex items-center justify-center font-black text-primary flex-shrink-0`}>
      {init}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-safe-bottom pb-6">
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors";

// ── Ranking Tab ───────────────────────────────────────────────────────────────

type RankPeriod = "week" | "month";

function RankingTab({ members }: { members: SquadMember[] }) {
  const [period, setPeriod] = useState<RankPeriod>("week");

  const sorted = [...members].sort((a, b) =>
    period === "week" ? b.workouts_this_week - a.workouts_this_week : b.workouts_this_month - a.workouts_this_month,
  );

  const medalColors = ["text-yellow-400", "text-zinc-400", "text-amber-600"];
  const medalBg = ["bg-yellow-400/8", "bg-zinc-400/8", "bg-amber-600/8"];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-surface-2 rounded-xl">
        {(["week", "month"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${period === p ? "bg-surface-1 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            {p === "week" ? "Esta Semana" : "Este Mês"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((member, idx) => {
          const count = period === "week" ? member.workouts_this_week : member.workouts_this_month;
          const name = displayName(member);
          const top3 = idx < 3;
          return (
            <div key={member.student_id}
              className={`flex items-center gap-3 p-3 rounded-2xl border ${top3 ? `${medalBg[idx]} border-transparent` : "bg-surface-1/40 border-white/5"}`}>
              <div className="w-7 text-center flex-shrink-0">
                {top3 ? <TrophyIcon className={`w-5 h-5 mx-auto ${medalColors[idx]}`} /> : <span className="text-xs text-zinc-600 font-bold">{idx + 1}</span>}
              </div>
              <Avatar photo_url={member.photo_url} name={name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-black tabular-nums ${top3 ? medalColors[idx] : "text-zinc-400"}`}>{count}</p>
                <p className="text-[9px] text-zinc-600">treino{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Feed Tab ──────────────────────────────────────────────────────────────────

function FeedTab({ feed, currentUserId, squadCollectionIds }: { feed: FeedEntry[]; currentUserId: string; squadCollectionIds: Set<string> }) {
  if (feed.length === 0) {
    return (
      <div className="py-12 text-center">
        <BoltIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">Nenhuma atividade ainda.</p>
        <p className="text-xs text-zinc-600 mt-1">Complete um treino para aparecer aqui!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feed.map((entry) => {
        const name = displayName(entry);
        const isMe = entry.student_id === currentUserId;
        const isSquadWorkout = squadCollectionIds.has(entry.collection_id);
        return (
          <div key={entry.id} className={`flex gap-3 p-3 rounded-2xl border ${isSquadWorkout ? "bg-primary/5 border-primary/15" : "bg-surface-1/40 border-white/5"}`}>
            <Avatar photo_url={entry.photo_url} name={name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 leading-relaxed">
                <span className="font-bold text-white">{isMe ? "Você" : name}</span>
                {" "}completou{" "}
                <span className={`font-semibold ${isSquadWorkout ? "text-primary" : "text-zinc-300"}`}>
                  {entry.collection_name}
                </span>
                {isSquadWorkout && <span className="ml-1">💪</span>}
              </p>
              {isSquadWorkout && (
                <p className="text-[10px] text-primary/80 font-semibold mt-0.5">Treino do Squad!</p>
              )}
              <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(entry.finished_at ?? entry.created_at)}</p>
            </div>
            <FireIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSquadWorkout ? "text-primary" : "text-orange-500/50"}`} />
          </div>
        );
      })}
    </div>
  );
}

// ── Challenge Card ────────────────────────────────────────────────────────────

function ChallengeCard({ challenge, memberCount }: { challenge: Challenge; memberCount: number }) {
  const left = daysLeft(challenge.end_date);
  const top = challenge.progress[0];
  const typeLabel = CHALLENGE_LABELS[challenge.challenge_type];
  const unit = CHALLENGE_UNIT[challenge.challenge_type];

  const typeIcons: Record<ChallengeType, React.ReactNode> = {
    frequency: <CalendarDaysIcon className="w-4 h-4" />,
    volume: <BoltIcon className="w-4 h-4" />,
    max_weight: <TrophyIcon className="w-4 h-4" />,
  };

  return (
    <div className="bg-surface-1 border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            {typeIcons[challenge.challenge_type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-snug">{challenge.title}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {typeLabel}{challenge.target_exercise_name ? ` · ${challenge.target_exercise_name}` : ""} · Meta: {challenge.target_value} {unit}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-xs font-bold tabular-nums ${left <= 2 ? "text-danger" : "text-zinc-400"}`}>{left}d</p>
            <p className="text-[9px] text-zinc-600">restantes</p>
          </div>
        </div>
        {challenge.description && (
          <p className="text-xs text-zinc-500 mt-2 ml-12">{challenge.description}</p>
        )}
      </div>

      {/* Mini leaderboard */}
      <div className="border-t border-white/5 divide-y divide-white/5">
        {challenge.progress.slice(0, Math.min(memberCount, 4)).map((p, idx) => {
          const pct = Math.min(100, challenge.target_value > 0 ? Math.round((p.value / challenge.target_value) * 100) : 0);
          const name = p.first_name ?? p.full_name?.split(" ")[0] ?? "Aluno";
          return (
            <div key={p.student_id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-5 text-center flex-shrink-0">
                {idx === 0 ? <TrophyIcon className="w-3.5 h-3.5 text-yellow-400 mx-auto" /> : <span className="text-[10px] text-zinc-600">{idx + 1}</span>}
              </div>
              <Avatar photo_url={p.photo_url} name={name} size="sm" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-300 truncate">{name}</span>
                  <span className="text-xs font-bold text-white tabular-nums flex-shrink-0">
                    {challenge.challenge_type === "volume" ? p.value.toFixed(0) : p.value}{" "}
                    <span className="text-zinc-600 font-normal text-[10px]">{unit}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-primary" : "bg-primary/50"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Create Challenge Modal ─────────────────────────────────────────────────────

function CreateChallengeModal({ squadId, onClose }: { squadId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<ChallengeType>("frequency");
  const [target, setTarget] = useState("");
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exercises, setExercises] = useState<{ id: string; title: string; translated_name: string | null }[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (type !== "frequency") {
      getExercisesForPicker().then(setExercises);
    }
  }, [type]);

  const filteredExercises = exercises.filter((e) => {
    const q = exerciseSearch.toLowerCase();
    return (e.translated_name ?? e.title).toLowerCase().includes(q);
  });

  function handleSubmit() {
    if (!title.trim()) { setError("Título é obrigatório."); return; }
    const tv = parseFloat(target);
    if (isNaN(tv) || tv <= 0) { setError("Meta inválida."); return; }
    if (type !== "frequency" && !selectedExerciseId) { setError("Selecione um exercício para este tipo de desafio."); return; }

    startTransition(async () => {
      const result = await createChallenge({
        squadId,
        title,
        description: desc || null,
        challengeType: type,
        targetValue: tv,
        targetExerciseId: selectedExerciseId,
        endDate,
      });
      if (result.ok) {
        onClose();
      } else {
        setError(result.message);
      }
    });
  }

  const selectedEx = exercises.find((e) => e.id === selectedExerciseId);

  return (
    <Modal title="Criar Desafio" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Título *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Rei do Supino, Projeto Mutante..." className={inputCls} maxLength={100} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Tipo de Desafio</label>
          <select value={type} onChange={(e) => { setType(e.target.value as ChallengeType); setSelectedExerciseId(null); }} className={inputCls}>
            <option value="frequency">Frequência (nº de treinos)</option>
            <option value="max_weight">Carga Máxima (kg num exercício)</option>
            <option value="volume">Volume Total (kg × reps)</option>
          </select>
        </div>

        {type !== "frequency" && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Exercício</label>
            {selectedEx ? (
              <div className="flex items-center justify-between bg-surface-2 border border-primary/30 rounded-xl px-3 py-2">
                <span className="text-sm text-white">{selectedEx.translated_name ?? selectedEx.title}</span>
                <button type="button" onClick={() => setSelectedExerciseId(null)} className="text-zinc-500 hover:text-white">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input type="text" value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Buscar exercício..." className={inputCls} />
                {exerciseSearch.length > 1 && (
                  <div className="mt-1 bg-surface-2 border border-white/10 rounded-xl max-h-36 overflow-y-auto">
                    {filteredExercises.slice(0, 10).map((e) => (
                      <button key={e.id} type="button" onClick={() => { setSelectedExerciseId(e.id); setExerciseSearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-surface-1 hover:text-white transition-colors">
                        {e.translated_name ?? e.title}
                      </button>
                    ))}
                    {filteredExercises.length === 0 && <p className="px-3 py-2 text-xs text-zinc-600">Nenhum resultado.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Meta *</label>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={type === "frequency" ? "20" : "100"} className={inputCls} min="1" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Término</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">Descrição (opcional)</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Regras do desafio..." rows={2} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button type="button" onClick={handleSubmit} disabled={pending}
        className="w-full min-h-[44px] bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40">
        {pending ? "Criando..." : "Criar Desafio"}
      </button>
    </Modal>
  );
}

// ── Desafios Tab ──────────────────────────────────────────────────────────────

function DesafiosTab({
  challenges,
  isCreator,
  squadId,
  memberCount,
}: {
  challenges: Challenge[];
  isCreator: boolean;
  squadId: string;
  memberCount: number;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      {isCreator && (
        <button type="button" onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-surface-1 border border-white/10 text-zinc-300 font-semibold rounded-2xl text-sm hover:border-primary/40 hover:text-white transition-colors">
          <PlusIcon className="w-4 h-4" />
          Criar Desafio
        </button>
      )}

      {challenges.length === 0 ? (
        <div className="py-12 text-center">
          <FlagIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Nenhum desafio ativo.</p>
          {isCreator && <p className="text-xs text-zinc-600 mt-1">Crie um desafio para motivar o squad!</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} memberCount={memberCount} />
          ))}
        </div>
      )}

      {showCreate && <CreateChallengeModal squadId={squadId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ── Share Workout Modal ───────────────────────────────────────────────────────

function ShareWorkoutModal({ squadId, onClose }: { squadId: string; onClose: () => void }) {
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getMyCollectionsForSharing().then((cols) => { setCollections(cols); setLoading(false); });
  }, []);

  function handleShare() {
    if (!selectedId) { setError("Selecione uma coleção."); return; }
    startTransition(async () => {
      const result = await shareWorkout({ squadId, collectionId: selectedId });
      if (result.ok) { onClose(); } else { setError(result.message); }
    });
  }

  return (
    <Modal title="Compartilhar Treino" onClose={onClose}>
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-zinc-500 text-center py-4">Carregando...</p>
        ) : collections.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">Nenhuma coleção encontrada. Peça ao personal para atribuir fichas a você.</p>
        ) : (
          collections.map((c) => (
            <button key={c.id} type="button" onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${selectedId === c.id ? "bg-primary/10 border-primary/40 text-white" : "bg-surface-2 border-white/8 text-zinc-300 hover:border-white/20"}`}>
              {c.name}
            </button>
          ))
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button type="button" onClick={handleShare} disabled={pending || !selectedId || loading}
        className="w-full min-h-[44px] bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40">
        {pending ? "Compartilhando..." : "Compartilhar"}
      </button>
    </Modal>
  );
}

// ── Shared Workout Card ────────────────────────────────────────────────────────

function SharedWorkoutCard({
  sw,
  currentUserId,
  isCreator,
  squadId,
  onStart,
}: {
  sw: SharedWorkout;
  currentUserId: string;
  isCreator: boolean;
  squadId: string;
  onStart: (w: TodayWorkoutData) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canRemove = isCreator || sw.shared_by_id === currentUserId;

  function handleRemove() {
    if (!confirm("Remover este treino do squad?")) return;
    startTransition(async () => {
      const result = await removeSharedWorkout(sw.id, squadId);
      if (!result.ok) setError(result.message);
    });
  }

  function handleStart() {
    const workoutData: TodayWorkoutData = {
      collectionId: sw.collection_id,
      collectionName: sw.collection_name,
      estimatedDurationMinutes: sw.estimated_duration_minutes,
      scheduleType: "custom",
      exercises: sw.exercises,
    };
    onStart(workoutData);
  }

  return (
    <div className="bg-surface-1 border border-white/8 rounded-2xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FireIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-snug">{sw.collection_name}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Compartilhado por {sw.shared_by_name} · <ClockIcon className="w-2.5 h-2.5 inline" /> ~{sw.estimated_duration_minutes} min · {sw.exercise_count} exercícios
            </p>
          </div>
          {canRemove && (
            <button type="button" onClick={handleRemove} disabled={pending}
              className="p-1.5 text-zinc-600 hover:text-danger transition-colors disabled:opacity-40">
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button type="button" onClick={handleStart}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all">
          <PlayCircleIcon className="w-5 h-5" />
          Iniciar Treino
        </button>
      </div>
    </div>
  );
}

// ── Treinos Tab ───────────────────────────────────────────────────────────────

function TreinosTab({
  sharedWorkouts,
  currentUserId,
  isCreator,
  squadId,
}: {
  sharedWorkouts: SharedWorkout[];
  currentUserId: string;
  isCreator: boolean;
  squadId: string;
}) {
  const [showShare, setShowShare] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<TodayWorkoutData | null>(null);

  return (
    <>
      <div className="space-y-4">
        <button type="button" onClick={() => setShowShare(true)}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-surface-1 border border-white/10 text-zinc-300 font-semibold rounded-2xl text-sm hover:border-primary/40 hover:text-white transition-colors">
          <ShareIcon className="w-4 h-4" />
          Compartilhar Treino
        </button>

        {sharedWorkouts.length === 0 ? (
          <div className="py-12 text-center">
            <FireIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Nenhum treino compartilhado ainda.</p>
            <p className="text-xs text-zinc-600 mt-1">Compartilhe uma ficha e sofram juntos!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sharedWorkouts.map((sw) => (
              <SharedWorkoutCard
                key={sw.id}
                sw={sw}
                currentUserId={currentUserId}
                isCreator={isCreator}
                squadId={squadId}
                onStart={setActiveWorkout}
              />
            ))}
          </div>
        )}
      </div>

      {showShare && <ShareWorkoutModal squadId={squadId} onClose={() => setShowShare(false)} />}

      {activeWorkout && (
        <ActiveWorkout
          workout={activeWorkout}
          lastLogs={{}}
          onClose={() => setActiveWorkout(null)}
        />
      )}
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

type Tab = "ranking" | "feed" | "desafios" | "treinos";

const TABS: { id: Tab; label: string }[] = [
  { id: "ranking", label: "Ranking" },
  { id: "feed", label: "Feed" },
  { id: "desafios", label: "Desafios" },
  { id: "treinos", label: "Treinos" },
];

export function SquadDashboard({
  squad,
  currentUserId,
}: {
  squad: SquadDetail;
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ranking");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const isCreator = squad.created_by === currentUserId;

  const squadCollectionIds = new Set(squad.sharedWorkouts.map((sw) => sw.collection_id));

  function copyCode() {
    navigator.clipboard.writeText(squad.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleLeave() {
    if (!confirm("Tem certeza que quer sair deste squad?")) return;
    startTransition(async () => {
      const result = await leaveSquad(squad.id);
      if (result.ok) { router.push("/app/gymconnect"); } else { setLeaveError(result.message); }
    });
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white leading-tight">{squad.name}</h1>
              {squad.description && <p className="text-sm text-zinc-500 mt-1">{squad.description}</p>}
            </div>
            {!isCreator && (
              <button type="button" onClick={handleLeave} disabled={pending} title="Sair do squad"
                className="p-2 text-zinc-600 hover:text-danger transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <UsersIcon className="w-3.5 h-3.5" />
              {squad.members.length} membro{squad.members.length !== 1 ? "s" : ""}
            </span>
            <button type="button" onClick={copyCode}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-mono">
              {copied ? <CheckIcon className="w-3.5 h-3.5 text-primary" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : squad.invite_code}
            </button>
            {squad.challenges.length > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <FlagIcon className="w-3 h-3" />
                {squad.challenges.length} desafio{squad.challenges.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {leaveError && <p className="text-xs text-danger mt-2">{leaveError}</p>}

          <div className="flex items-center gap-1.5 mt-4">
            {squad.members.slice(0, 8).map((m) => (
              <Avatar key={m.student_id} photo_url={m.photo_url} name={displayName(m)} size="sm" />
            ))}
            {squad.members.length > 8 && (
              <span className="text-[10px] text-zinc-600 ml-1">+{squad.members.length - 8}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
        {TABS.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${tab === id ? "bg-primary text-black" : "bg-surface-1 border border-white/8 text-zinc-500 hover:text-zinc-300"}`}>
            {label}
            {id === "desafios" && squad.challenges.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full">
                {squad.challenges.length}
              </span>
            )}
            {id === "treinos" && squad.sharedWorkouts.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full">
                {squad.sharedWorkouts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "ranking" && <RankingTab members={squad.members} />}
      {tab === "feed" && <FeedTab feed={squad.feed} currentUserId={currentUserId} squadCollectionIds={squadCollectionIds} />}
      {tab === "desafios" && (
        <DesafiosTab
          challenges={squad.challenges}
          isCreator={isCreator}
          squadId={squad.id}
          memberCount={squad.members.length}
        />
      )}
      {tab === "treinos" && (
        <TreinosTab
          sharedWorkouts={squad.sharedWorkouts}
          currentUserId={currentUserId}
          isCreator={isCreator}
          squadId={squad.id}
        />
      )}
    </div>
  );
}
