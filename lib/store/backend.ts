import { createClient } from "@/lib/supabase/server";

/**
 * Server-side fetch helper for the NestJS store API. Forwards the caller's
 * Supabase JWT so the backend resolves tenant (gym_id) and role from the
 * token — the frontend never sends prices or tenant ids.
 */

function backendUrl(): string {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3001"
  );
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function storeBackendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as T & {
    message?: string | string[];
  };

  if (!res.ok) {
    const msg = Array.isArray(json.message)
      ? json.message.join(", ")
      : json.message;
    throw new Error(msg ?? `Erro na API da Loja (${res.status})`);
  }

  return json;
}

// ── Shared payloads/results (mirror the NestJS DTOs) ──────────────────────────

export type CheckoutItemPayload = { variantId: string; quantity: number };

export type CheckoutApiResult =
  | { orderId: string; requiresPayment: true; checkoutUrl: string }
  | { orderId: string; requiresPayment: false };

export type PosSaleApiResult = {
  orderId: string;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  items: {
    title: string;
    variant: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
};
