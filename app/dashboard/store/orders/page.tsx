import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { getStoreOrders } from "../actions";
import { OrdersClient } from "./OrdersClient";

export const revalidate = 0;

export default async function StoreOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  const auth = await requireRole([...ADMIN_ROLES, "receptionist"]);
  if (!auth.ok) redirect("/dashboard");

  const params = await searchParams;
  const orders = await getStoreOrders({
    status: params.status,
    from: params.from,
    to: params.to,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/store"
          className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-surface-1 transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardDocumentListIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Loja</p>
          <h1 className="text-xl font-black text-white leading-tight">Pedidos</h1>
        </div>
      </div>

      <OrdersClient
        orders={orders}
        filters={{ status: params.status ?? "all", from: params.from ?? "", to: params.to ?? "" }}
      />
    </div>
  );
}
