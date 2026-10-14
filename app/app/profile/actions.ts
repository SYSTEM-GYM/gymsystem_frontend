"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";

export type UpdateProfileResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateStudentProfile(input: {
  email: string;
  phone: string;
}): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "E-mail inválido." };
  }
  if (phone && phone.replace(/\D/g, "").length < 10) {
    return { ok: false, message: "Telefone inválido. Use DDD + número." };
  }

  // Phone lives in public.users — RLS (users_update_own) scopes this to the
  // caller's own row.
  const { error: phoneError } = await supabase
    .from("users")
    .update({ phone: phone || null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (phoneError) {
    console.error("updateStudentProfile users:", phoneError);
    return { ok: false, message: "Erro ao salvar o telefone." };
  }

  // Email lives in Supabase Auth; changing it triggers a confirmation email
  // whose link lands on /auth/confirm (type=email_change → back to profile).
  const emailChanged = email !== (user.email ?? "").toLowerCase();
  if (emailChanged) {
    const { error: emailError } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${await siteOrigin()}/auth/confirm?type=email_change` },
    );
    if (emailError) {
      console.error("updateStudentProfile auth email:", emailError);
      return {
        ok: false,
        message: "Telefone salvo, mas não foi possível alterar o e-mail.",
      };
    }
  }

  revalidatePath("/app/profile");
  return {
    ok: true,
    message: emailChanged
      ? "Dados salvos! Confirme o novo e-mail pelo link enviado à sua caixa de entrada."
      : "Alterações salvas com sucesso!",
  };
}
