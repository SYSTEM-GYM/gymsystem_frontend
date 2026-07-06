import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  CalculatorIcon,
} from "@heroicons/react/24/outline";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { getStoreDashboardData } from "./actions";
import { StoreClient } from "./StoreClient";

export const revalidate = 0;

export default async function StorePage() {
  const auth = await requireRole([...ADMIN_ROLES, "receptionist"]);
  if (!auth.ok) redirect("/dashboard");

  const data = await getStoreDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <BuildingStorefrontIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
              E-commerce
            </p>
            <h1 className="text-xl font-black text-white leading-tight">Loja</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/store/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-surface-1 border border-white/10 text-zinc-300 hover:border-white/25 transition-colors"
          >
            <ClipboardDocumentListIcon className="w-4 h-4" />
            Pedidos
          </Link>
          <Link
            href="/dashboard/store/pos"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform"
          >
            <CalculatorIcon className="w-4 h-4" />
            Abrir PDV
          </Link>
        </div>
      </div>

      <StoreClient initialData={data} />
    </div>
  );
}
