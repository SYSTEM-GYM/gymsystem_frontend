"use client";

import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { MuscleVolume } from "@/app/app/workout-actions";

// Map raw primary_muscle → radar category. Covers both vocabularies present in
// exercises.primary_muscle (ExerciseDB: "pectorals", free-exercise-db: "chest")
// plus the pt-BR names written by gym_importer/translator.js.
const MUSCLE_TO_CATEGORY: Record<string, string> = {
  pectorals:       "Peito",
  chest:           "Peito",
  "upper chest":   "Peito",
  peitorais:       "Peito",
  lats:            "Costas",
  traps:           "Costas",
  "upper back":    "Costas",
  "middle back":   "Costas",
  "lower back":    "Costas",
  spine:           "Costas",
  neck:            "Costas",
  "latíssimo do dorso": "Costas",
  "trapézio":      "Costas",
  "costas superiores": "Costas",
  "coluna vertebral": "Costas",
  quads:           "Pernas",
  quadriceps:      "Pernas",
  hamstrings:      "Pernas",
  glutes:          "Pernas",
  calves:          "Pernas",
  abductors:       "Pernas",
  adductors:       "Pernas",
  "quadríceps":    "Pernas",
  isquiotibiais:   "Pernas",
  "glúteos":       "Pernas",
  panturrilhas:    "Pernas",
  abdutores:       "Pernas",
  adutores:        "Pernas",
  biceps:          "Braços",
  triceps:         "Braços",
  forearms:        "Braços",
  "bíceps":        "Braços",
  "tríceps":       "Braços",
  "antebraços":    "Braços",
  delts:           "Ombros",
  shoulders:       "Ombros",
  "front delts":   "Ombros",
  "rear delts":    "Ombros",
  "lateral delts": "Ombros",
  deltoides:       "Ombros",
  abs:             "Core",
  abdominals:      "Core",
  "upper abs":     "Core",
  "lower abs":     "Core",
  serratus:        "Core",
  "serratus anterior": "Core",
  obliques:        "Core",
  "abdômen":       "Core",
  "serrátil anterior": "Core",
};

const CATEGORIES = ["Peito", "Costas", "Pernas", "Braços", "Ombros", "Core"] as const;

type Props = { volume: MuscleVolume };

// Custom tooltip
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { subject: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const { subject } = payload[0].payload;
  const val = payload[0].value;
  return (
    <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 shadow-xl text-xs">
      <p className="font-bold text-white">{subject}</p>
      <p className="text-zinc-400 mt-0.5">{val} séries</p>
    </div>
  );
}

export function MuscleRadarChart({ volume }: Props) {
  const data = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cat of CATEGORIES) totals[cat] = 0;

    for (const [muscle, vol] of Object.entries(volume)) {
      const cat = MUSCLE_TO_CATEGORY[muscle.toLowerCase().trim()];
      if (cat) totals[cat] = (totals[cat] ?? 0) + vol;
    }

    const maxVal = Math.max(1, ...Object.values(totals));

    return CATEGORIES.map((cat) => ({
      subject: cat,
      value: totals[cat] ?? 0,
      fullMark: maxVal,
    }));
  }, [volume]);

  const hasData = data.some((d) => d.value > 0);
  const totalSets = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Distribuição Muscular
          </p>
          <p className="text-sm font-bold text-white mt-0.5">Últimos 15 dias</p>
        </div>
        {hasData && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">Séries totais</p>
            <p className="text-lg font-black text-primary tabular-nums">{totalSets}</p>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-surface-2 flex items-center justify-center">
            <span className="text-2xl">🕸️</span>
          </div>
          <p className="text-xs text-zinc-600">
            Complete treinos para ver seu perfil muscular.
          </p>
        </div>
      ) : (
        <>
          {/* Radar chart */}
          <div className="w-full" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <defs>
                  <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                  </radialGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <PolarGrid
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />

                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fill: "#a1a1aa",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                />

                <Radar
                  name="Volume"
                  dataKey="value"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#radarFill)"
                  dot={{ fill: "#22c55e", r: 3, strokeWidth: 0 }}
                  filter="url(#glow)"
                />

                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Category pills */}
          <div className="grid grid-cols-3 gap-2">
            {data.map(({ subject, value, fullMark }) => {
              const pct = fullMark > 0 ? Math.round((value / fullMark) * 100) : 0;
              return (
                <div
                  key={subject}
                  className="flex flex-col gap-1 px-3 py-2 bg-surface-2 rounded-2xl"
                >
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {subject}
                  </p>
                  <p className="text-sm font-bold text-white tabular-nums">{value}</p>
                  <div className="h-1 rounded-full bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
