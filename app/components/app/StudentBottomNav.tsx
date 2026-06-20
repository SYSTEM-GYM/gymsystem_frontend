"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserCircleIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  QrCodeIcon as QrCodeIconSolid,
} from "@heroicons/react/24/solid";

const NAV_ITEMS = [
  {
    href:        "/app",
    label:       "Meu Treino",
    icon:        HomeIcon,
    iconActive:  HomeIconSolid,
    exact:       true,
  },
  {
    href:        "/app/access",
    label:       "Acesso",
    icon:        QrCodeIcon,
    iconActive:  QrCodeIconSolid,
    exact:       false,
  },
  {
    href:        "/app/profile",
    label:       "Meu Perfil",
    icon:        UserCircleIcon,
    iconActive:  UserCircleIconSolid,
    exact:       false,
  },
];

export function StudentBottomNav() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface-1 border-t border-white/5 safe-area-inset-bottom">
      <div className="max-w-lg mx-auto flex items-stretch h-20">
        {NAV_ITEMS.map(({ href, label, icon: Icon, iconActive: IconActive, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors ${
                active ? "text-primary" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {active ? (
                <IconActive className="w-6 h-6" />
              ) : (
                <Icon className="w-6 h-6" />
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
