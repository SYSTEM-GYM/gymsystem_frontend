"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth-utils";
import {
  storeBackendFetch,
  type CheckoutApiResult,
  type CheckoutItemPayload,
} from "@/lib/store/backend";

export type ActionResult = { ok: true } | { ok: false; message: string };

// ── Wishlist ──────────────────────────────────────────────────────────────────

export async function toggleWishlist(
  productId: string,
): Promise<ActionResult & { liked?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("student_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, message: "Erro ao remover dos favoritos." };
    revalidatePath("/app/store");
    return { ok: true, liked: false };
  }

  const profile = await getSessionProfile();
  if (!profile?.gymId) {
    return { ok: false, message: "Sua conta não está vinculada a uma unidade." };
  }

  const { error } = await supabase.from("wishlist_items").insert({
    student_id: user.id,
    product_id: productId,
    gym_id: profile.gymId,
  });
  if (error) return { ok: false, message: "Erro ao favoritar." };
  revalidatePath("/app/store");
  return { ok: true, liked: true };
}

// ── Coupon preview (display only — o backend revalida no checkout) ────────────

export type CouponPreview =
  | { ok: true; code: string; discount: number; total: number }
  | { ok: false; message: string };

export async function previewCoupon(
  code: string,
  subtotal: number,
): Promise<CouponPreview> {
  const profile = await getSessionProfile();
  if (!profile?.gymId) return { ok: false, message: "Conta sem unidade vinculada." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("store_coupons")
    .select(
      "code, discount_type, discount_value, min_order_amount, max_uses, used_count, starts_at, expires_at, active",
    )
    .eq("gym_id", profile.gymId)
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!data || !data.active) return { ok: false, message: "Cupom inválido." };
  const now = Date.now();
  if (new Date(data.starts_at).getTime() > now) {
    return { ok: false, message: "Este cupom ainda não está ativo." };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < now) {
    return { ok: false, message: "Este cupom expirou." };
  }
  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    return { ok: false, message: "Este cupom atingiu o limite de usos." };
  }
  if (subtotal < data.min_order_amount) {
    return {
      ok: false,
      message: `Pedido mínimo de R$ ${data.min_order_amount.toFixed(2).replace(".", ",")}.`,
    };
  }

  const discount =
    data.discount_type === "percentage"
      ? Math.round(subtotal * data.discount_value) / 100
      : Math.min(subtotal, data.discount_value);

  return {
    ok: true,
    code: data.code,
    discount,
    total: Math.max(0, Math.round((subtotal - discount) * 100) / 100),
  };
}

// ── Checkout (proxy to the NestJS store API) ──────────────────────────────────

export type StoreCheckoutResult =
  | { ok: true; requiresPayment: true; checkoutUrl: string }
  | { ok: true; requiresPayment: false }
  | { ok: false; message: string };

export async function createStoreCheckout(input: {
  items: CheckoutItemPayload[];
  couponCode?: string;
}): Promise<StoreCheckoutResult> {
  if (input.items.length === 0) {
    return { ok: false, message: "Seu carrinho está vazio." };
  }

  try {
    const result = await storeBackendFetch<CheckoutApiResult>(
      "/api/v1/store/checkout",
      { method: "POST", body: JSON.stringify(input) },
    );
    if (result.requiresPayment) {
      return { ok: true, requiresPayment: true, checkoutUrl: result.checkoutUrl };
    }
    revalidatePath("/app/store/orders");
    return { ok: true, requiresPayment: false };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erro ao iniciar o pagamento.",
    };
  }
}
