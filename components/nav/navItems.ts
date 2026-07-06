import {
  HomeIcon,
  UsersIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType } from "react";
import type { UserRole } from "@/app/dashboard/layout";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  minRole: "customer" | "trainer" | "admin";
};

const ROLE_RANK: Record<UserRole, number> = {
  customer: 0,
  trainer: 1,
  admin: 2,
};

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",           label: "Início",         icon: HomeIcon,                    exact: true, minRole: "customer" },
  { href: "/dashboard/members",   label: "Membros",        icon: UsersIcon,                                minRole: "admin"    },
  { href: "/dashboard/finance",        label: "Financeiro",     icon: BanknotesIcon,                 minRole: "admin" },
  { href: "/dashboard/finance/plans", label: "Balcão",         icon: ShoppingCartIcon,              minRole: "admin" },
  { href: "/dashboard/store",          label: "Loja",           icon: BuildingStorefrontIcon,        minRole: "admin" },
  { href: "/dashboard/workouts",       label: "Treinos",        icon: ClipboardDocumentListIcon,     minRole: "admin" },
  { href: "/dashboard/marketing/whatsapp", label: "WhatsApp CRM", icon: ChatBubbleLeftEllipsisIcon, minRole: "admin" },
  { href: "/dashboard/settings",  label: "Configurações",  icon: Cog6ToothIcon,                           minRole: "admin"    },
];

export function getVisibleNavItems(role: UserRole) {
  return ALL_NAV_ITEMS.filter(
    (item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole]
  );
}
