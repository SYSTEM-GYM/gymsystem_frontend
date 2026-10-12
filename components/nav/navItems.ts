import {
  HomeIcon,
  UsersIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ChatBubbleLeftEllipsisIcon,
  ChatBubbleLeftRightIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType } from "react";
import type { UserRole } from "@/app/dashboard/layout";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Explicit allow-list — mirrors the roles each page's requireRole() accepts. */
  roles: UserRole[];
};

const STAFF: UserRole[] = ["admin", "trainer", "receptionist"];
const FRONT_DESK: UserRole[] = ["admin", "receptionist"];

export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",           label: "Início",         icon: HomeIcon,                    exact: true, roles: ["admin", "trainer", "receptionist", "customer"] },
  { href: "/dashboard/members",   label: "Membros",        icon: UsersIcon,                                roles: ["admin"] },
  { href: "/dashboard/finance",        label: "Financeiro",     icon: BanknotesIcon,                 roles: ["admin"] },
  { href: "/dashboard/finance/plans", label: "Balcão",         icon: ShoppingCartIcon,              roles: ["admin"] },
  { href: "/dashboard/store",          label: "Loja",           icon: BuildingStorefrontIcon,        roles: FRONT_DESK },
  { href: "/dashboard/workouts",       label: "Treinos",        icon: ClipboardDocumentListIcon,     roles: ["admin"] },
  { href: "/dashboard/marketing/whatsapp", label: "WhatsApp CRM", icon: ChatBubbleLeftEllipsisIcon, roles: ["admin"] },
  { href: "/dashboard/access-control", label: "Controle de Acesso", icon: KeyIcon,                 roles: FRONT_DESK },
  { href: "/dashboard/feedback",       label: "Ouvidoria",      icon: ChatBubbleLeftRightIcon,       roles: FRONT_DESK },
  { href: "/dashboard/team-chat",      label: "Chat da Equipe", icon: ChatBubbleLeftEllipsisIcon,    roles: STAFF },
  { href: "/dashboard/settings",  label: "Configurações",  icon: Cog6ToothIcon,                           roles: ["admin"] },
];

export function getVisibleNavItems(role: UserRole) {
  return ALL_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
