"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";

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

export type PasswordResetState = AuthActionState & {
  /** Echoed back on error so the form keeps the typed e-mail. */
  email?: string;
};

/**
 * Sends Supabase's password recovery e-mail. The link lands on /auth/confirm
 * (type=recovery), which verifies it and starts the session.
 */
export async function requestPasswordReset(
  _prev: PasswordResetState,
  formData: FormData
): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Informe o e-mail da sua conta.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?type=recovery`,
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return {
        error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
        email,
      };
    }
    if (error.code === "email_address_invalid") {
      return { error: "Informe um e-mail válido.", email };
    }
    return { error: "Não foi possível enviar o link agora. Tente novamente.", email };
  }

  // Same message whether or not the e-mail has an account — never reveal it.
  return {
    success: `Se houver uma conta para ${email}, enviamos um link para redefinir a senha. Confira sua caixa de entrada e o spam.`,
  };
}

/**
 * Sets the new password for the session opened by the recovery link
 * (/auth/confirm → /reset-password).
 */
export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 8) {
    return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }
  if (password !== passwordConfirm) {
    return { error: "As senhas não conferem. Digite a mesma senha nos dois campos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Seu link de redefinição expirou. Peça um novo link para continuar." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    switch (error.code) {
      case "same_password":
        return { error: "A nova senha precisa ser diferente da senha atual." };
      case "weak_password":
        return { error: "Senha muito fraca. Use letras, números e pelo menos 8 caracteres." };
      case "reauthentication_needed":
      case "session_expired":
      case "session_not_found":
        return { error: "Seu link de redefinição expirou. Peça um novo link para continuar." };
      default:
        return { error: "Não foi possível atualizar a senha. Tente novamente." };
    }
  }

  // Same landing as signIn: middleware sends customers on to /app
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
