import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, CalculatorIcon } from "@heroicons/react/24/outline";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { getStoreDashboardData } from "../actions";
import { PosClient } from "./PosClient";

export const revalidate = 0;

export default async function PosPage() {
  const auth = await requireRole([...ADMIN_ROLES, "receptionist"]);
  if (!auth.ok) redirect("/dashboard");

  const data = await getStoreDashboardData();

  return (
    <div className="space-y-6" data-print-hide-wrapper="">
      <div className="flex items-center gap-3" data-print-hide="">
        <Link href="/dashboard/store"
          className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-surface-1 transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalculatorIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Loja</p>
          <h1 className="text-xl font-black text-white leading-tight">Ponto de Venda</h1>
        </div>
      </div>

      <PosClient products={data.products} categories={data.categories} />
    </div>
  );
}
