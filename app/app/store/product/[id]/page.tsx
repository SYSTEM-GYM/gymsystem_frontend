import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductDetailClient, type ProductDetail } from "./ProductDetailClient";

export const revalidate = 0;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // RLS: only active products of the student's own gym resolve here
  const [{ data: product }, { data: wish }] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, title, description, brand, base_price, media_urls,
         product_variants ( id, size, color, model, sku, price_override, stock_quantity, active )`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("wishlist_items")
      .select("id")
      .eq("student_id", user.id)
      .eq("product_id", id)
      .maybeSingle(),
  ]);

  if (!product) notFound();

  return (
    <ProductDetailClient
      product={product as ProductDetail}
      initialLiked={!!wish}
    />
  );
}
