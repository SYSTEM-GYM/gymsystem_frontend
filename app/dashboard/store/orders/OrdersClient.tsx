"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { markOrderDelivered, refundOrder, type StoreOrder } from "../actions";

const STATUS_META: Record<StoreOrder["status"], { label: string; cls: string }> = {
  pending:   { label: "Pendente",  cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  paid:      { label: "Pago",      cls: "text-primary bg-primary/10 border-primary/20" },
  delivered: { label: "Entregue",  cls: "text-info bg-info/10 border-info/20" },
  canceled:  { label: "Cancelado", cls: "text-zinc-400 bg-zinc-700/30 border-zinc-700/40" },
  refunded:  { label: "Estornado", cls: "text-danger bg-danger/10 border-danger/20" },
};

const PAYMENT_LABELS: Record<StoreOrder["payment_method"], string> = {
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
  cash: "Dinheiro",
};

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function OrderCard({ order }: { order: StoreOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = STATUS_META[order.status];

  function handleDeliver() {
    startTransition(async () => {
      const res = await markOrderDelivered(order.id);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  function handleRefund() {
    if (!confirm("Estornar este pedido? O pagamento será devolvido e o estoque restaurado.")) return;
    startTransition(async () => {
      const res = await refundOrder(order.id);
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  }

  return (
    <div className="bg-surface-1 border border-white/5 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/30 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{order.buyer_display}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>
              {meta.label}
            </span>
            <span className="text-[10px] text-zinc-600 uppercase font-semibold">
              {order.origin === "pos" ? "PDV" : "App"} · {PAYMENT_LABELS[order.payment_method]}
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            #{order.id.slice(0, 8)} · {fmtDateTime(order.created_at)} · {order.order_items.length} ite{order.order_items.length !== 1 ? "ns" : "m"}
          </p>
        </div>
        <span className="text-sm font-black text-white tabular-nums shrink-0">{fmt(order.total_amount)}</span>
        <ChevronDownIcon className={`w-4 h-4 text-zinc-600 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300 truncate">
                  {item.quantity}× {item.title_snapshot}
                  {item.variant_snapshot && <span className="text-zinc-600"> ({item.variant_snapshot})</span>}
                </span>
                <span className="text-zinc-400 tabular-nums shrink-0">{fmt(item.total_price)}</span>
              </div>
            ))}
            {order.discount_amount > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-zinc-500">Desconto</span>
                <span className="text-danger tabular-nums">−{fmt(order.discount_amount)}</span>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            {order.status === "paid" && (
              <button type="button" onClick={handleDeliver} disabled={pending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black hover:opacity-90 disabled:opacity-40 transition-opacity">
                {pending ? "..." : "Marcar Entregue"}
              </button>
            )}
            {(order.status === "paid" || order.status === "delivered") && (
              <button type="button" onClick={handleRefund} disabled={pending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-danger/10 border border-danger/25 text-danger hover:bg-danger/20 disabled:opacity-40 transition-colors">
                Estornar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrdersClient({
  orders,
  filters,
}: {
  orders: StoreOrder[];
  filters: { status: string; from: string; to: string };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(filters.status);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  function applyFilters(nextStatus = status) {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/dashboard/store/orders${params.size ? `?${params}` : ""}`);
  }

  const totalPaid = orders
    .filter((o) => o.status === "paid" || o.status === "delivered")
    .reduce((acc, o) => acc + o.total_amount, 0);

  const selectCls =
    "bg-surface-1 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/40";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "paid", "delivered", "canceled", "refunded"] as const).map((s) => (
          <button key={s} type="button"
            onClick={() => { setStatus(s); applyFilters(s); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              status === s ? "bg-primary text-black border-primary" : "bg-surface-1 border-white/10 text-zinc-500 hover:text-zinc-300"
            }`}>
            {s === "all" ? "Todos" : STATUS_META[s].label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
          <span className="text-zinc-600 text-xs">até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
          <button type="button" onClick={() => applyFilters()}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-surface-1 border border-white/10 text-zinc-300 hover:border-primary/40 transition-colors">
            Filtrar
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-1 border border-white/5 rounded-2xl">
        <span className="text-xs text-zinc-500">
          {orders.length} pedido{orders.length !== 1 ? "s" : ""} no período
        </span>
        <span className="text-sm font-black text-primary tabular-nums">{fmt(totalPaid)} faturado</span>
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-zinc-500">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
