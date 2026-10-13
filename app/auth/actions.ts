"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backendUrl } from "@/lib/backend-url";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signIn(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha inválidos. Tente novamente." };
  }

  redirect("/dashboard");
}

export type SignUpState = AuthActionState & {
  /** Echoed back on error so the form keeps what the user typed (never passwords). */
  values?: { full_name: string; email: string; phone: string };
};

/** Gym of the white-label subdomain the user is signing up on, if any. */
async function resolveTenantGymId(): Promise<string | null> {
  const slug = (await headers()).get("x-tenant-slug");
  if (!slug) return null;

  const { data } = await createAdminClient()
    .from("gyms")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * This request reaches the backend from the Next server, so the backend would
 * see the same IP for every user. Forward the real client IP for its per-IP
 * rate limit; the backend only trusts it alongside the shared internal key.
 */
async function clientIpHeaders(): Promise<Record<string, string>> {
  const key = process.env.INTERNAL_API_KEY;
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return key && ip ? { "X-Internal-Api-Key": key, "X-Client-IP": ip } : {};
}

/**
 * Self-service sign-up through the NestJS backend (POST /api/auth/register),
 * which creates an already-confirmed account via the Supabase Admin API — no
 * confirmation e-mail. On success the user is signed in and sent to /app.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const values = { full_name: fullName, email, phone };

  if (!fullName || !email || !password) {
    return { error: "Preencha nome, e-mail e senha.", values };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres.", values };
  }
  if (password !== passwordConfirm) {
    return { error: "As senhas não conferem. Digite a mesma senha nos dois campos.", values };
  }
  if (formData.get("terms") !== "on") {
    return { error: "Aceite os termos de uso para criar sua conta.", values };
  }

  const gymId = await resolveTenantGymId();

  let res: Response;
  try {
    res = await fetch(`${backendUrl()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeaders()) },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        ...(phone && { phone }),
        ...(gymId && { gym_id: gymId }),
      }),
      cache: "no-store",
    });
  } catch {
    return {
      error: "Não foi possível conectar ao servidor. Tente novamente em instantes.",
      values,
    };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    return {
      error:
        res.status < 500 && message
          ? message
          : "Não foi possível criar sua conta. Tente novamente.",
      values,
    };
  }

  // Account exists and is confirmed — sign in right away.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?registered=1");
  }

  redirect("/app");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
