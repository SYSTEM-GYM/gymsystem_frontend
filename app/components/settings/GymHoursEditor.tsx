"use client";

import { useState, useTransition } from "react";
import { saveGymOperatingHours } from "@/app/dashboard/settings/workout-actions";
import { dayLabel } from "@/lib/workout-utils";

export type OperatingHour = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

const DEFAULT_HOURS: OperatingHour[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: "06:00",
  close_time: "22:00",
  is_closed: i === 0,
}));

type Props = {
  gymId: string;
  gymName: string;
  initialHours: OperatingHour[];
};

export function GymHoursEditor({ gymId, gymName, initialHours }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hours, setHours] = useState<OperatingHour[]>(() => {
    if (initialHours.length === 0) return DEFAULT_HOURS;
    const map = new Map(initialHours.map((h) => [h.day_of_week, h]));
    return DEFAULT_HOURS.map((d) => map.get(d.day_of_week) ?? d);
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function updateDay(day: number, patch: Partial<OperatingHour>) {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)),
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveGymOperatingHours(gymId, hours);
      setMsg({
        ok: result.ok,
        text: result.ok ? "Horários salvos." : (result.message ?? "Erro ao salvar."),
      });
    });
  }

  return (
    <div className="border-t border-white/5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-3 text-left text-xs text-primary hover:bg-surface-2/50 transition-colors"
      >
        {expanded ? "▾" : "▸"} Horários de funcionamento — {gymName}
      </button>

      {expanded && (
        <div className="px-6 pb-5 space-y-3">
          {hours.map((h) => (
            <div key={h.day_of_week} className="flex flex-wrap items-center gap-3">
              <span className="w-10 text-xs font-semibold text-zinc-400">
                {dayLabel(h.day_of_week)}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={h.is_closed}
                  onChange={(e) => updateDay(h.day_of_week, { is_closed: e.target.checked })}
                />
                Fechado
              </label>
              {!h.is_closed && (
                <>
                  <input
                    type="time"
                    value={h.open_time.slice(0, 5)}
                    onChange={(e) => updateDay(h.day_of_week, { open_time: e.target.value })}
                    className="bg-surface-2 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                  <span className="text-zinc-600 text-xs">até</span>
                  <input
                    type="time"
                    value={h.close_time.slice(0, 5)}
                    onChange={(e) => updateDay(h.day_of_week, { close_time: e.target.value })}
                    className="bg-surface-2 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                </>
              )}
            </div>
          ))}
          {msg && (
            <p className={`text-xs ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.text}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="px-4 py-2 rounded-full text-xs font-bold bg-primary text-black disabled:opacity-40"
          >
            {pending ? "Salvando..." : "Salvar Horários"}
          </button>
        </div>
      )}
    </div>
  );
}
