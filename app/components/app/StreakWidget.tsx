"use client";

type Props = {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
};

const MILESTONES = [
  { days: 60, label: "Lendário", mult: "5×", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  { days: 30, label: "Mestre", mult: "3×", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  { days: 10, label: "Dedicado", mult: "2×", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  { days: 5, label: "Aquecendo", mult: "1.5×", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
];

function getMultiplier(streak: number): string {
  if (streak >= 60) return "5×";
  if (streak >= 30) return "3×";
  if (streak >= 10) return "2×";
  if (streak >= 5) return "1.5×";
  return "1×";
}

function getNextMilestone(streak: number): { days: number; label: string } | null {
  for (const m of [...MILESTONES].reverse()) {
    if (streak < m.days) return m;
  }
  return null;
}

function isStreakAtRisk(lastWorkoutDate: string | null): boolean {
  if (!lastWorkoutDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toISOString().slice(0, 10);
  return lastWorkoutDate < yd && lastWorkoutDate !== today;
}

export function StreakWidget({ currentStreak, longestStreak, lastWorkoutDate }: Props) {
  const atRisk = currentStreak > 0 && isStreakAtRisk(lastWorkoutDate);
  const activeMilestone = MILESTONES.find((m) => currentStreak >= m.days);
  const nextMilestone = getNextMilestone(currentStreak);
  const multiplier = getMultiplier(currentStreak);

  return (
    <div className={`bg-surface-1 border rounded-3xl p-5 space-y-4 ${
      atRisk ? "border-danger/30" : "border-white/5"
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Ofensiva
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl">🔥</span>
            <span className="text-3xl font-black text-white tabular-nums">
              {currentStreak}
            </span>
            <span className="text-sm text-zinc-500 font-medium">
              {currentStreak === 1 ? "dia" : "dias"}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-black ${
            activeMilestone
              ? `${activeMilestone.color} ${activeMilestone.bg}`
              : "text-zinc-500 bg-surface-2 border-white/5"
          }`}>
            Bônus {multiplier} XP
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5">
            Recorde: {longestStreak} dias
          </p>
        </div>
      </div>

      {atRisk && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-danger/10 border border-danger/20 rounded-xl">
          <span className="text-base">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-danger leading-tight">
              Ofensiva em risco!
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Treine hoje para não perder XP e reiniciar sua ofensiva.
            </p>
          </div>
        </div>
      )}

      {nextMilestone && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>Próxima conquista: <span className="text-zinc-400 font-semibold">{nextMilestone.label}</span></span>
            <span>{nextMilestone.days - currentStreak} dias restantes</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.round((currentStreak / nextMilestone.days) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {!nextMilestone && currentStreak >= 60 && (
        <p className="text-[10px] text-red-400 font-semibold text-center">
          🏆 Você atingiu o nível máximo de ofensiva — Continue assim!
        </p>
      )}
    </div>
  );
}
