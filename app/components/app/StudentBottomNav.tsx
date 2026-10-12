"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserCircleIcon,
  QrCodeIcon,
  UsersIcon,
  WalletIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  QrCodeIcon as QrCodeIconSolid,
  UsersIcon as UsersIconSolid,
  WalletIcon as WalletIconSolid,
  BuildingStorefrontIcon as BuildingStorefrontIconSolid,
} from "@heroicons/react/24/solid";

const NAV_ITEMS = [
  {
    href:        "/app",
    label:       "Treino",
    icon:        HomeIcon,
    iconActive:  HomeIconSolid,
    exact:       true,
  },
  {
    href:        "/app/gymconnect",
    label:       "Squads",
    icon:        UsersIcon,
    iconActive:  UsersIconSolid,
    exact:       false,
  },
  {
    href:        "/app/store",
    label:       "Loja",
    icon:        BuildingStorefrontIcon,
    iconActive:  BuildingStorefrontIconSolid,
    exact:       false,
  },
  {
    href:        "/app/wallet",
    label:       "Carteira",
    icon:        WalletIcon,
    iconActive:  WalletIconSolid,
    exact:       false,
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
    label:       "Perfil",
    icon:        UserCircleIcon,
    iconActive:  UserCircleIconSolid,
    exact:       false,
  },
];

export function StudentBottomNav({
  flashCoupon,
}: {
  flashCoupon?: string | null;
}) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  // Hide the flash banner while the student is already browsing the store
  const showCouponBadge = !!flashCoupon && !pathname.startsWith("/app/store");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface-1 border-t border-white/5 safe-area-inset-bottom">
      {/* Floating flash-coupon banner anchored to the nav */}
      {showCouponBadge && (
        <Link
          href="/app/store"
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-black text-[11px] font-black whitespace-nowrap shadow-lg shadow-primary/25 animate-pulse active:scale-95 transition-transform"
        >
          ⚡ {flashCoupon}
        </Link>
      )}

      <div className="max-w-lg mx-auto flex items-stretch h-20">
        {NAV_ITEMS.map(({ href, label, icon: Icon, iconActive: IconActive, exact }) => {
          const active = isActive(href, exact);
          const isStore = href === "/app/store";
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors ${
                active ? "text-primary" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <span className="relative">
                {active ? (
                  <IconActive className="w-6 h-6" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
                {/* Pulsing dot on the store icon while a coupon is live */}
                {isStore && !!flashCoupon && !active && (
                  <span className="absolute -top-0.5 -right-0.5 flex w-2.5 h-2.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-75 animate-ping" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-primary" />
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
