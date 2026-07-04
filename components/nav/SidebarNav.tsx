"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import {
  ArrowLeftStartOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import type { UserRole } from "@/app/dashboard/layout";
import { getVisibleNavItems } from "./navItems";

type Props = {
  role: UserRole;
  expanded?: boolean;
  onToggle?: () => void;
  gymName?: string;
  logoUrl?: string | null;
};

export function SidebarNav({ role, expanded = false, onToggle, gymName = "SIMP", logoUrl = null }: Props) {
  const pathname = usePathname();
  const navItems = getVisibleNavItems(role);
  const initial = gymName.charAt(0).toUpperCase();
  const rest = gymName.slice(1);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const itemCls = (active: boolean) =>
    `flex items-center gap-3 transition-all duration-200 ${
      expanded
        ? "w-full px-3 py-2.5 rounded-xl"
        : "w-11 h-11 justify-center rounded-2xl"
    } ${
      active
        ? "bg-primary text-black shadow-[0_0_20px_rgba(193,244,41,0.25)]"
        : "text-zinc-500 hover:bg-surface-2 hover:text-white"
    }`;

  return (
    <nav className="flex flex-col h-full py-5 gap-1">
      {/* Logo row + toggle */}
      <div
        className={`flex items-center mb-5 px-3 ${
          expanded ? "justify-between" : "justify-center"
        }`}
      >
        <div
          className={`flex items-center ${
            expanded ? "gap-2" : "flex-col"
          }`}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={gymName}
              className={expanded ? "h-6 w-6 rounded-lg object-cover shrink-0" : "h-7 w-7 rounded-lg object-cover shrink-0"}
            />
          ) : (
            <span className="font-black tracking-tighter text-primary leading-none">
              {initial}
            </span>
          )}
          {expanded ? (
            <span className="text-sm font-black tracking-tighter text-white truncate max-w-[120px]">
              {logoUrl ? gymName : rest}
            </span>
          ) : (
            !logoUrl && (
              <span className="text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">
                {rest}
              </span>
            )
          )}
        </div>

        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={expanded ? "Recolher menu" : "Expandir menu"}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-surface-2 transition-colors shrink-0"
          >
            {expanded ? (
              <ChevronLeftIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav items */}
      <ul
        className={`flex flex-col gap-1 flex-1 ${
          expanded ? "px-3" : "items-center px-0"
        }`}
      >
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href} className={expanded ? "w-full" : ""}>
              <Link
                href={href}
                aria-label={label}
                title={!expanded ? label : undefined}
                className={itemCls(active)}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {expanded && (
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Logout */}
      <div className={`mt-auto ${expanded ? "px-3" : "flex justify-center"}`}>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            title={!expanded ? "Sair" : undefined}
            className={`flex items-center gap-3 ${
              expanded
                ? "w-full px-3 py-2.5 rounded-xl"
                : "w-11 h-11 justify-center rounded-2xl"
            } text-zinc-600 hover:bg-danger/10 hover:text-danger transition-all duration-200`}
          >
            <ArrowLeftStartOnRectangleIcon className="w-5 h-5 shrink-0" />
            {expanded && (
              <span className="text-sm font-semibold">Sair</span>
            )}
          </button>
        </form>
      </div>
    </nav>
  );
}
