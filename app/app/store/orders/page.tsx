import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";

export const revalidate = 0;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Aguardando pagamento", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  paid:      { label: "Pago — retire na recepção", cls: "text-primary bg-primary/10 border-primary/20" },
  delivered: { label: "Entregue", cls: "text-info bg-info/10 border-info/20" },
  canceled:  { label: "Cancelado", cls: "text-zinc-400 bg-zinc-700/30 border-zinc-700/40" },
  refunded:  { label: "Estornado", cls: "text-danger bg-danger/10 border-danger/20" },
};

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { checkout } = await searchParams;

  // RLS: buyer reads only their own orders
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, status, payment_method, total_amount, discount_amount, created_at, paid_at,
       order_items ( id, title_snapshot, variant_snapshot, quantity, total_price )`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/app/store"
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors min-h-11 min-w-11 flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Loja</p>
          <h1 className="text-xl font-black text-white leading-tight">Meus Pedidos</h1>
        </div>
      </div>

      {checkout === "success" && (
        <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/25 rounded-2xl">
          <CheckCircleIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">Pagamento recebido!</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Assim que o gateway confirmar, o pedido aparece como pago aqui.
              Pagamentos PIX podem levar alguns instantes.
            </p>
          </div>
        </div>
      )}

      {(orders ?? []).length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto">
            <ShoppingBagIcon className="w-8 h-8 text-zinc-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-500">Nenhum pedido ainda</p>
            <p className="text-xs text-zinc-600 mt-1">Suas compras na loja aparecem aqui.</p>
          </div>
          <Link
            href="/app/store"
            className="inline-block px-6 py-3 rounded-2xl bg-primary text-black font-bold text-sm active:scale-95 transition-transform"
          >
            Explorar a Loja
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(orders ?? []).map((order) => {
            const meta = STATUS_META[order.status] ?? STATUS_META.pending;
            return (
              <div
                key={order.id}
                className="bg-surface-1 border border-white/5 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-zinc-600 font-mono">
                      #{order.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <ClockIcon className="w-3 h-3" />
                      {new Date(order.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border shrink-0 ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="space-y-1 border-t border-white/5 pt-2.5">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-300 truncate">
                        {item.quantity}× {item.title_snapshot}
                        {item.variant_snapshot && (
                          <span className="text-zinc-600"> ({item.variant_snapshot})</span>
                        )}
                      </span>
                      <span className="text-zinc-400 tabular-nums shrink-0">
                        {fmt(item.total_price)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                  {order.discount_amount > 0 ? (
                    <span className="text-[10px] text-zinc-600">
                      Desconto de {fmt(order.discount_amount)} aplicado
                    </span>
                  ) : <span />}
                  <span className="text-sm font-black text-white tabular-nums">
                    {fmt(order.total_amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
