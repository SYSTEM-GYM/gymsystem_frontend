"use client";

import Link from "next/link";
import { BuildingOffice2Icon, VideoCameraIcon } from "@heroicons/react/24/outline";

const TABS = [
  { key: "gyms",      label: "Filiais",               icon: BuildingOffice2Icon },
  { key: "exercises", label: "Biblioteca de Exercícios", icon: VideoCameraIcon },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsTabs({ activeTab }: { activeTab: string }) {
  return (
    <div className="flex gap-1 p-1 bg-surface-1 border border-white/5 rounded-2xl w-fit">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key;
        return (
          <Link
            key={key}
            href={`/dashboard/settings?tab=${key}`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isActive
                ? "bg-primary text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
