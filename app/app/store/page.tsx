import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildingStorefrontIcon, ClockIcon } from "@heroicons/react/24/outline";
import { StorefrontClient, type StorefrontProduct } from "./StorefrontClient";
import { CartFab } from "./CartFab";

export const revalidate = 0;

export default async function StorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes everything to the student's gym + active rows
  const [{ data: products }, { data: categories }, { data: wishlist }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          `id, category_id, title, brand, base_price, media_urls,
           product_variants ( id, price_override, stock_quantity, active )`,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("store_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("student_id", user.id),
    ]);

  const likedIds = (wishlist ?? []).map((w) => w.product_id as string);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <BuildingStorefrontIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
              Loja
            </p>
            <h1 className="text-xl font-black text-white leading-tight">
              Vitrine da Academia
            </h1>
          </div>
        </div>
        <Link
          href="/app/store/orders"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-1 border border-white/8 text-xs font-semibold text-zinc-400 hover:text-white transition-colors shrink-0"
        >
          <ClockIcon className="w-3.5 h-3.5" />
          Meus Pedidos
        </Link>
      </div>

      <StorefrontClient
        products={(products ?? []) as StorefrontProduct[]}
        categories={(categories ?? []) as { id: string; name: string }[]}
        initialLiked={likedIds}
      />

      <CartFab />
    </div>
  );
}
