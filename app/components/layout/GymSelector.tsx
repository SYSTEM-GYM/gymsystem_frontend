"use client";

import { useTransition } from "react";
import { BuildingStorefrontIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { setAdminHomeGym } from "@/app/dashboard/settings/actions";

type Gym = { id: string; name: string; city: string };

type Props = {
  gyms: Gym[];
  currentGymId: string | null;
};

export function GymSelector({ gyms, currentGymId }: Props) {
  const [pending, startTransition] = useTransition();

  if (gyms.length === 0) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const gymId = e.target.value;
    startTransition(async () => { await setAdminHomeGym(gymId); });
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <BuildingStorefrontIcon className="absolute left-3 w-3.5 h-3.5 text-zinc-500 pointer-events-none z-10" />
      <select
        value={currentGymId ?? ""}
        onChange={handleChange}
        disabled={pending}
        className="appearance-none pl-8 pr-7 py-1.5 bg-surface-2 border border-white/10 rounded-xl text-xs font-medium text-zinc-300 hover:border-white/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 disabled:opacity-50 transition-colors cursor-pointer truncate max-w-[160px]"
        aria-label="Selecionar filial ativa"
      >
        {!currentGymId && (
          <option value="" disabled>
            Selecionar filial...
          </option>
        )}
        {gyms.map((gym) => (
          <option key={gym.id} value={gym.id}>
            {gym.name}
          </option>
        ))}
      </select>
      <ChevronUpDownIcon className="absolute right-2 w-3 h-3 text-zinc-500 pointer-events-none" />
      {pending && (
        <span className="absolute -right-5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      )}
    </div>
  );
}
