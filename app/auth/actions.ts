"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirme seu e-mail antes de entrar. O link de ativação está na sua caixa de entrada.",
      };
    }
    return { error: "E-mail ou senha inválidos. Tente novamente." };
  }

  redirect("/dashboard");
}

export type SignUpState = AuthActionState & {
  /** E-mail the confirmation link was sent to (success screen). */
  sentTo?: string;
  /** Echoed back on error so the form keeps what the user typed (never passwords). */
  values?: { full_name: string; email: string; phone: string };
};

/** Absolute URL of this deployment, for the confirmation link redirect. */
async function siteOrigin(): Promise<string> {
  // Server Actions are POSTs, so browsers always send Origin (and Next.js
  // rejects actions whose Origin doesn't match the host).
  const origin = (await headers()).get("origin");
  return origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Self-service sign-up with Supabase Auth's native flow: the account is
 * created unconfirmed and Supabase e-mails a confirmation link (SMTP via
 * Resend). The link lands on /auth/confirm, which starts the session.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      // full_name is read by the handle_new_user trigger; phone is copied to
      // the profile only after the e-mail is confirmed (see /auth/confirm).
      data: { full_name: fullName, ...(phone && { phone }) },
    },
  });

  if (error) {
    return { error: signUpErrorMessage(error.code), values };
  }

  // Same response whether or not the e-mail was already registered —
  // Supabase doesn't reveal it, and neither do we.
  return { sentTo: email };
}

function signUpErrorMessage(code: string | undefined): string {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    case "weak_password":
      return "Senha muito fraca. Use letras, números e pelo menos 8 caracteres.";
    case "email_address_invalid":
      return "Informe um e-mail válido.";
    case "signup_disabled":
      return "O cadastro pelo app está desativado. Procure a recepção da sua academia.";
    default:
      return "Não foi possível criar sua conta. Tente novamente.";
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
