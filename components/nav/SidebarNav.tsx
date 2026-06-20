"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline";
import type { UserRole } from "@/app/dashboard/layout";
import { getVisibleNavItems } from "./navItems";

type Props = { role: UserRole };

export function SidebarNav({ role }: Props) {
  const pathname = usePathname();
  const navItems = getVisibleNavItems(role);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col items-center h-full py-6 gap-2">
      {/* Logo mark */}
      <div className="mb-6 flex flex-col items-center">
        <span className="text-base font-black tracking-tighter text-primary leading-none">
          S
        </span>
        <span className="text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">
          IMP
        </span>
      </div>

      {/* Nav icon pills */}
      <ul className="flex flex-col items-center gap-2 flex-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                title={label}
                className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200 ${
                  active
                    ? "bg-primary text-black shadow-[0_0_20px_rgba(193,244,41,0.25)]"
                    : "text-zinc-500 hover:bg-surface-2 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Logout icon */}
      <form action={signOut} className="mt-auto">
        <button
          type="submit"
          aria-label="Sair"
          title="Sair"
          className="flex items-center justify-center w-11 h-11 rounded-2xl text-zinc-600 hover:bg-danger/10 hover:text-danger transition-all duration-200"
        >
          <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
        </button>
      </form>
    </nav>
  );
}
