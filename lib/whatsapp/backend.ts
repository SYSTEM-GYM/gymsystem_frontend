import { createClient } from "@/lib/supabase/server";

export type WaSessionStatus =
  | "disconnected"
  | "qr_pending"
  | "connecting"
  | "connected";

export type WaIntegrationPublic = {
  status: WaSessionStatus;
  connected: boolean;
  display_phone: string | null;
  qr_code: string | null;
  connected_at: string | null;
};

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

export async function waBackendFetch<T>(
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
    throw new Error(msg ?? `Erro na API WhatsApp (${res.status})`);
  }

  return json;
}
