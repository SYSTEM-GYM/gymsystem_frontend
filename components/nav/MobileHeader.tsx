"use client";

import { useState } from "react";
import { Bars3Icon, XMarkIcon, ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "@/app/auth/actions";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/app/dashboard/layout";
import { getVisibleNavItems } from "./navItems";
import { GymSelector } from "@/app/components/layout/GymSelector";

type Gym = { id: string; name: string; city: string };

type Props = {
  role: UserRole;
  gyms?: Gym[];
  currentGymId?: string | null;
  gymName?: string;
  logoUrl?: string | null;
};

export function MobileHeader({
  role,
  gyms = [],
  currentGymId = null,
  gymName = "SIMP",
  logoUrl = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = getVisibleNavItems(role);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      {/* Sticky top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-5 py-3 bg-surface-1 border-b border-white/5">
        <span className="flex items-center gap-2 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={gymName} className="h-6 w-6 rounded-lg object-cover shrink-0" />
          ) : null}
          <span className="font-black tracking-tighter text-primary truncate">
            {gymName}
          </span>
        </span>
        {role === "admin" && gyms.length > 0 && (
          <div className="flex-1 flex justify-center">
            <GymSelector gyms={gyms} currentGymId={currentGymId} />
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 rounded-xl text-zinc-400 hover:bg-surface-2 hover:text-white transition-colors"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-surface-1 border-r border-white/5 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <span className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={gymName} className="h-7 w-7 rounded-lg object-cover shrink-0" />
            ) : null}
            <span className="text-lg font-black tracking-tighter text-primary truncate">
              {gymName}
            </span>
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="p-1.5 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links with labels */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-black"
                    : "text-zinc-400 hover:bg-surface-2 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Drawer logout */}
        <div className="px-3 py-4 border-t border-white/5">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:bg-danger/10 hover:text-danger transition-colors"
            >
              <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
              Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
