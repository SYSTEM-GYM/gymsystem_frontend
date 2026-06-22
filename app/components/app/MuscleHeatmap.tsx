"use client";

import { useMemo, useState } from "react";
import type { MuscleVolume } from "@/app/app/workout-actions";

// Map ExerciseDB primary_muscle strings to our SVG region IDs
const MUSCLE_MAP: Record<string, string[]> = {
  pectorals:        ["chest"],
  "upper chest":    ["chest"],
  delts:            ["shoulder-l", "shoulder-r"],
  "front delts":    ["shoulder-l", "shoulder-r"],
  biceps:           ["bicep-l", "bicep-r"],
  abs:              ["abs"],
  "upper abs":      ["abs"],
  "lower abs":      ["abs"],
  serratus:         ["abs"],
  quads:            ["quad-l", "quad-r"],
  "quadriceps":     ["quad-l", "quad-r"],
  calves:           ["calf-l", "calf-r"],
  lats:             ["lat-l", "lat-r"],
  traps:            ["traps"],
  "upper back":     ["traps"],
  triceps:          ["tricep-l", "tricep-r"],
  hamstrings:       ["ham-l", "ham-r"],
  glutes:           ["glute-l", "glute-r"],
  forearms:         ["forearm-l", "forearm-r"],
  "lower back":     ["lower-back"],
  spine:            ["lower-back"],
};

function volumeToColor(vol: number, maxVol: number): string {
  if (maxVol === 0 || vol === 0) return "#27272a"; // zinc-800
  const ratio = Math.min(1, vol / maxVol);
  if (ratio < 0.25) return "#713f12"; // brown — low
  if (ratio < 0.5) return "#a16207";  // yellow-dark
  if (ratio < 0.75) return "#c2410c"; // orange
  return "#dc2626"; // red — high
}

type Props = { volume: MuscleVolume };

export function MuscleHeatmap({ volume }: Props) {
  const [gender, setGender] = useState<"male" | "female">("male");

  const regionVolume = useMemo(() => {
    const rv: Record<string, number> = {};
    for (const [muscle, vol] of Object.entries(volume)) {
      const regions = MUSCLE_MAP[muscle.toLowerCase()];
      if (!regions) continue;
      for (const r of regions) {
        rv[r] = (rv[r] ?? 0) + vol;
      }
    }
    return rv;
  }, [volume]);

  const maxVol = useMemo(
    () => Math.max(0, ...Object.values(regionVolume)),
    [regionVolume],
  );

  function c(id: string) {
    return volumeToColor(regionVolume[id] ?? 0, maxVol);
  }

  const hasData = Object.keys(volume).length > 0;

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Mapa Muscular
          </p>
          <p className="text-sm font-bold text-white mt-0.5">Últimos 15 dias</p>
        </div>
        <div className="flex bg-surface-2 rounded-xl p-0.5 gap-0.5">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                gender === g
                  ? "bg-primary text-black"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {g === "male" ? "♂" : "♀"}
            </button>
          ))}
        </div>
      </div>

      {!hasData && (
        <p className="text-xs text-zinc-600 text-center py-2">
          Complete treinos para ver seu mapa muscular.
        </p>
      )}

      <div className="flex justify-center">
        <BodySVG c={c} />
      </div>

      <div className="flex items-center gap-2 justify-center">
        <span className="text-[10px] text-zinc-600">Fraco</span>
        <div className="flex gap-0.5">
          {["#27272a", "#713f12", "#a16207", "#c2410c", "#dc2626"].map((col) => (
            <div key={col} className="w-5 h-2 rounded-sm" style={{ background: col }} />
          ))}
        </div>
        <span className="text-[10px] text-zinc-600">Forte</span>
      </div>
    </div>
  );
}

function BodySVG({ c }: { c: (id: string) => string }) {
  return (
    <svg
      viewBox="0 0 120 260"
      width={120}
      height={260}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head */}
      <ellipse cx="60" cy="18" rx="13" ry="15" fill="#3f3f46" />

      {/* Neck */}
      <rect x="54" y="30" width="12" height="8" rx="3" fill="#3f3f46" />

      {/* Traps */}
      <path d="M38 38 Q44 35 54 37 L54 47 Q44 48 38 52 Z" fill={c("traps")} />
      <path d="M82 38 Q76 35 66 37 L66 47 Q76 48 82 52 Z" fill={c("traps")} />

      {/* Shoulders */}
      <ellipse cx="34" cy="52" rx="11" ry="10" fill={c("shoulder-l")} />
      <ellipse cx="86" cy="52" rx="11" ry="10" fill={c("shoulder-r")} />

      {/* Chest */}
      <path d="M44 46 Q54 44 60 45 Q66 44 76 46 L76 66 Q66 68 60 68 Q54 68 44 66 Z" fill={c("chest")} />

      {/* Abs */}
      <rect x="51" y="68" width="8" height="8" rx="2" fill={c("abs")} />
      <rect x="61" y="68" width="8" height="8" rx="2" fill={c("abs")} />
      <rect x="51" y="78" width="8" height="8" rx="2" fill={c("abs")} />
      <rect x="61" y="78" width="8" height="8" rx="2" fill={c("abs")} />
      <rect x="51" y="88" width="8" height="8" rx="2" fill={c("abs")} />
      <rect x="61" y="88" width="8" height="8" rx="2" fill={c("abs")} />

      {/* Lats */}
      <path d="M44 46 L44 80 Q42 90 38 95 L30 85 Q28 72 34 62 Q38 54 44 46 Z" fill={c("lat-l")} />
      <path d="M76 46 L76 80 Q78 90 82 95 L90 85 Q92 72 86 62 Q82 54 76 46 Z" fill={c("lat-r")} />

      {/* Biceps */}
      <path d="M23 62 Q20 75 22 90 L30 88 Q30 74 32 62 Z" fill={c("bicep-l")} />
      <path d="M97 62 Q100 75 98 90 L90 88 Q90 74 88 62 Z" fill={c("bicep-r")} />

      {/* Triceps (behind arms) */}
      <path d="M30 62 Q34 55 38 62 L34 88 L28 88 Z" fill={c("tricep-l")} />
      <path d="M90 62 Q86 55 82 62 L86 88 L92 88 Z" fill={c("tricep-r")} />

      {/* Forearms */}
      <path d="M22 90 Q18 102 20 115 L28 113 Q28 102 30 90 Z" fill={c("forearm-l")} />
      <path d="M98 90 Q102 102 100 115 L92 113 Q92 102 90 90 Z" fill={c("forearm-r")} />

      {/* Hip / Lower back */}
      <rect x="44" y="98" width="32" height="14" rx="4" fill={c("lower-back")} />

      {/* Glutes */}
      <path d="M44 112 Q44 128 50 132 Q57 135 60 134 Q63 135 70 132 Q76 128 76 112 Z" fill={c("glute-l")} />

      {/* Quads */}
      <path d="M46 130 Q42 148 44 165 L54 164 Q54 148 54 130 Z" fill={c("quad-l")} />
      <path d="M74 130 Q78 148 76 165 L66 164 Q66 148 66 130 Z" fill={c("quad-r")} />
      <path d="M54 130 Q57 148 60 148 Q63 148 66 130 Z" fill={c("quad-l")} />

      {/* Hamstrings (slightly behind quad color) */}
      <path d="M46 130 Q44 148 44 165 L54 164 Q54 148 54 130 Z" fill={c("ham-l")} opacity="0.4" />
      <path d="M74 130 Q76 148 76 165 L66 164 Q66 148 66 130 Z" fill={c("ham-r")} opacity="0.4" />

      {/* Knees */}
      <ellipse cx="49" cy="167" rx="7" ry="5" fill="#3f3f46" />
      <ellipse cx="71" cy="167" rx="7" ry="5" fill="#3f3f46" />

      {/* Calves */}
      <path d="M43 172 Q40 186 42 200 L55 200 Q56 186 55 172 Z" fill={c("calf-l")} />
      <path d="M77 172 Q80 186 78 200 L65 200 Q64 186 65 172 Z" fill={c("calf-r")} />

      {/* Feet */}
      <ellipse cx="48" cy="202" rx="8" ry="4" fill="#3f3f46" />
      <ellipse cx="72" cy="202" rx="8" ry="4" fill="#3f3f46" />
    </svg>
  );
}
