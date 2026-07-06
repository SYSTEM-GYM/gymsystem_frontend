"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import {
  storeBackendFetch,
  type CheckoutItemPayload,
  type PosSaleApiResult,
} from "@/lib/store/backend";

const STORE_STAFF_ROLES = [...ADMIN_ROLES, "receptionist"];

export type ActionResult = { ok: true } | { ok: false; message: string };

// ── Types ─────────────────────────────────────────────────────────────────────

export type StoreCategory = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  model: string | null;
  sku: string | null;
  price_override: number | null;
  stock_quantity: number;
  active: boolean;
};

export type StoreProduct = {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  base_price: number;
  media_urls: string[];
  active: boolean;
  created_at: string;
  product_variants: ProductVariant[];
};

export type StoreCoupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
};

export type StoreOrder = {
  id: string;
  buyer_id: string | null;
  buyer_name: string | null;
  buyer_display: string;
  origin: "storefront" | "pos";
  status: "pending" | "paid" | "delivered" | "canceled" | "refunded";
  payment_method: "pix" | "credit" | "debit" | "cash";
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_at: string | null;
  created_at: string;
  order_items: {
    id: string;
    title_snapshot: string;
    variant_snapshot: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
};

// ── Staff/tenant resolution ───────────────────────────────────────────────────

type StaffContext =
  | { ok: true; userId: string; gymId: string; role: string }
  | { ok: false; message: string };

async function requireStoreStaff(): Promise<StaffContext> {
  const auth = await requireRole(STORE_STAFF_ROLES);
  if (!auth.ok) return auth;

  let gymId = auth.gymId;
  if (!gymId) {
    // Owners created before home_gym_id backfill: fall back to first owned gym
    const admin = createAdminClient();
    const { data: gym } = await admin
      .from("gyms")
      .select("id")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    gymId = gym?.id ?? null;
  }
  if (!gymId) {
    return { ok: false, message: "Nenhuma unidade vinculada ao seu usuário." };
  }
  return { ok: true, userId: auth.userId, gymId, role: auth.role };
}

// ── Read: full store payload for the dashboard ────────────────────────────────

export type StoreDashboardData = {
  categories: StoreCategory[];
  products: StoreProduct[];
  coupons: StoreCoupon[];
};

export async function getStoreDashboardData(): Promise<StoreDashboardData> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return { categories: [], products: [], coupons: [] };

  const admin = createAdminClient();
  const [catRes, prodRes, couponRes] = await Promise.all([
    admin
      .from("store_categories")
      .select("id, name, sort_order, active")
      .eq("gym_id", auth.gymId)
      .order("sort_order", { ascending: true }),
    admin
      .from("products")
      .select(
        `id, category_id, title, description, brand, base_price, media_urls, active, created_at,
         product_variants ( id, product_id, size, color, model, sku, price_override, stock_quantity, active )`,
      )
      .eq("gym_id", auth.gymId)
      .order("created_at", { ascending: false }),
    admin
      .from("store_coupons")
      .select(
        "id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, active",
      )
      .eq("gym_id", auth.gymId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    categories: (catRes.data ?? []) as StoreCategory[],
    products: (prodRes.data ?? []) as StoreProduct[],
    coupons: (couponRes.data ?? []) as StoreCoupon[],
  };
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function saveCategory(input: {
  id?: string;
  name: string;
  active?: boolean;
}): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, message: "Nome da categoria muito curto." };

  const admin = createAdminClient();
  const { error } = input.id
    ? await admin
        .from("store_categories")
        .update({ name, active: input.active ?? true })
        .eq("id", input.id)
        .eq("gym_id", auth.gymId)
    : await admin
        .from("store_categories")
        .insert({ gym_id: auth.gymId, name });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Já existe uma categoria com esse nome." };
    console.error("saveCategory:", error);
    return { ok: false, message: "Erro ao salvar a categoria." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("store_categories")
    .delete()
    .eq("id", id)
    .eq("gym_id", auth.gymId);

  if (error) {
    console.error("deleteCategory:", error);
    return { ok: false, message: "Erro ao excluir a categoria." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ── Products ──────────────────────────────────────────────────────────────────

export type ProductInput = {
  id?: string;
  title: string;
  description: string | null;
  brand: string | null;
  basePrice: number;
  categoryId: string | null;
  mediaUrls: string[];
  active: boolean;
};

export async function saveProduct(
  input: ProductInput,
): Promise<ActionResult & { productId?: string }> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const title = input.title.trim();
  if (title.length < 2) return { ok: false, message: "Título do produto é obrigatório." };
  if (!(input.basePrice >= 0)) return { ok: false, message: "Preço base inválido." };

  const admin = createAdminClient();
  const payload = {
    title,
    description: input.description?.trim() || null,
    brand: input.brand?.trim() || null,
    base_price: input.basePrice,
    category_id: input.categoryId,
    media_urls: input.mediaUrls,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await admin
      .from("products")
      .update(payload)
      .eq("id", input.id)
      .eq("gym_id", auth.gymId);
    if (error) {
      console.error("saveProduct update:", error);
      return { ok: false, message: "Erro ao atualizar o produto." };
    }
    revalidatePath("/dashboard/store");
    return { ok: true, productId: input.id };
  }

  const { data, error } = await admin
    .from("products")
    .insert({ ...payload, gym_id: auth.gymId, created_by: auth.userId })
    .select("id")
    .single();

  if (error || !data) {
    console.error("saveProduct insert:", error);
    return { ok: false, message: "Erro ao criar o produto." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true, productId: data.id };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .delete()
    .eq("id", id)
    .eq("gym_id", auth.gymId);

  if (error) {
    console.error("deleteProduct:", error);
    return { ok: false, message: "Erro ao excluir. Produtos com vendas devem ser inativados." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ── Variants ──────────────────────────────────────────────────────────────────

export type VariantInput = {
  id?: string;
  productId: string;
  size: string | null;
  color: string | null;
  model: string | null;
  sku: string | null;
  priceOverride: number | null;
  stockQuantity: number;
  active: boolean;
};

export async function saveVariant(input: VariantInput): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;
  if (input.stockQuantity < 0) return { ok: false, message: "Estoque não pode ser negativo." };

  const admin = createAdminClient();
  const payload = {
    size: input.size?.trim() || null,
    color: input.color?.trim() || null,
    model: input.model?.trim() || null,
    sku: input.sku?.trim() || null,
    price_override: input.priceOverride,
    stock_quantity: Math.round(input.stockQuantity),
    active: input.active,
  };

  const { error } = input.id
    ? await admin
        .from("product_variants")
        .update(payload)
        .eq("id", input.id)
        .eq("gym_id", auth.gymId)
    : await admin.from("product_variants").insert({
        ...payload,
        product_id: input.productId,
        gym_id: auth.gymId,
      });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Já existe uma variação com esse SKU." };
    console.error("saveVariant:", error);
    return { ok: false, message: "Erro ao salvar a variação." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function deleteVariant(id: string): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("product_variants")
    .delete()
    .eq("id", id)
    .eq("gym_id", auth.gymId);

  if (error) {
    console.error("deleteVariant:", error);
    return { ok: false, message: "Erro ao excluir. Variações vendidas devem ser inativadas." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ── Product image upload ──────────────────────────────────────────────────────
// Photos land in the public product-images bucket; URLs are opaque in
// products.media_urls, so swapping to Cloudflare R2 later only means
// changing this uploader.

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadProductImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const file = formData.get("image");
  if (!(file instanceof File)) return { ok: false, message: "Arquivo inválido." };
  const ext = IMAGE_MIME_EXT[file.type];
  if (!ext) return { ok: false, message: "Use imagens JPG, PNG ou WebP." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "Imagem muito grande (máx. 5 MB)." };

  const admin = createAdminClient();
  // Bucket is created lazily; ignore the duplicate error after the first run
  await admin.storage
    .createBucket("product-images", { public: true, fileSizeLimit: 5 * 1024 * 1024 })
    .catch(() => undefined);

  const path = `${auth.gymId}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type });

  if (error) {
    console.error("uploadProductImage:", error);
    return { ok: false, message: "Erro ao enviar a imagem." };
  }

  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

// ── Coupons ───────────────────────────────────────────────────────────────────

export async function saveCoupon(input: {
  id?: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  expiresAt: string | null;
  active: boolean;
}): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const code = input.code.trim().toUpperCase();
  if (code.length < 3) return { ok: false, message: "Código do cupom muito curto." };
  if (!(input.discountValue > 0)) return { ok: false, message: "Valor de desconto inválido." };
  if (input.discountType === "percentage" && input.discountValue > 100) {
    return { ok: false, message: "Desconto percentual máximo é 100%." };
  }

  const admin = createAdminClient();
  const payload = {
    code,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    min_order_amount: Math.max(0, input.minOrderAmount),
    max_uses: input.maxUses,
    expires_at: input.expiresAt,
    active: input.active,
  };

  const { error } = input.id
    ? await admin
        .from("store_coupons")
        .update(payload)
        .eq("id", input.id)
        .eq("gym_id", auth.gymId)
    : await admin.from("store_coupons").insert({
        ...payload,
        gym_id: auth.gymId,
        created_by: auth.userId,
      });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Já existe um cupom com esse código." };
    console.error("saveCoupon:", error);
    return { ok: false, message: "Erro ao salvar o cupom." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("store_coupons")
    .delete()
    .eq("id", id)
    .eq("gym_id", auth.gymId);

  if (error) {
    console.error("deleteCoupon:", error);
    return { ok: false, message: "Erro ao excluir o cupom." };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

// ── Orders dashboard ──────────────────────────────────────────────────────────

export async function getStoreOrders(filters: {
  status?: string;
  from?: string;
  to?: string;
}): Promise<StoreOrder[]> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return [];

  const admin = createAdminClient();
  let q = admin
    .from("orders")
    .select(
      `id, buyer_id, buyer_name, origin, status, payment_method,
       subtotal_amount, discount_amount, total_amount, paid_at, created_at,
       order_items ( id, title_snapshot, variant_snapshot, quantity, unit_price, total_price )`,
    )
    .eq("gym_id", auth.gymId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);

  const { data } = await q;
  const rows = (data ?? []) as (Omit<StoreOrder, "buyer_display"> & { buyer_id: string | null })[];

  // Resolve buyer names for registered students
  const buyerIds = [...new Set(rows.map((r) => r.buyer_id).filter((b): b is string => !!b))];
  const nameMap = new Map<string, string>();
  if (buyerIds.length > 0) {
    const { data: buyers } = await admin
      .from("users")
      .select("id, full_name")
      .in("id", buyerIds);
    for (const b of buyers ?? []) nameMap.set(b.id, b.full_name);
  }

  return rows.map((r) => ({
    ...r,
    buyer_display:
      (r.buyer_id ? nameMap.get(r.buyer_id) : null) ?? r.buyer_name ?? "Cliente",
  }));
}

export async function markOrderDelivered(orderId: string): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("gym_id", auth.gymId)
    .eq("status", "paid");

  if (error) {
    console.error("markOrderDelivered:", error);
    return { ok: false, message: "Erro ao marcar como entregue." };
  }
  revalidatePath("/dashboard/store/orders");
  return { ok: true };
}

export async function refundOrder(orderId: string): Promise<ActionResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  try {
    await storeBackendFetch(`/api/v1/store/orders/${orderId}/refund`, {
      method: "POST",
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro ao estornar." };
  }
  revalidatePath("/dashboard/store/orders");
  return { ok: true };
}

// ── POS ───────────────────────────────────────────────────────────────────────

export async function searchStudentsForPos(
  query: string,
): Promise<{ id: string; full_name: string }[]> {
  const auth = await requireStoreStaff();
  if (!auth.ok || query.trim().length < 2) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, full_name")
    .ilike("full_name", `%${query.trim()}%`)
    .eq("role", "customer")
    .limit(8);
  return (data ?? []) as { id: string; full_name: string }[];
}

export type PosSaleResult =
  | { ok: true; sale: PosSaleApiResult }
  | { ok: false; message: string };

export async function registerPosSale(input: {
  items: CheckoutItemPayload[];
  couponCode?: string;
  paymentMethod: "pix" | "credit" | "debit" | "cash";
  buyerId?: string;
  buyerName?: string;
  notes?: string;
}): Promise<PosSaleResult> {
  const auth = await requireStoreStaff();
  if (!auth.ok) return auth;

  try {
    const sale = await storeBackendFetch<PosSaleApiResult>("/api/v1/store/pos/sale", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/dashboard/store/orders");
    return { ok: true, sale };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao registrar a venda.",
    };
  }
}
