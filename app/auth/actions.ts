"use server";

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
    return { error: "E-mail ou senha inválidos. Tente novamente." };
  }

  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: "Não foi possível criar sua conta. Tente novamente." };
  }

  // Insert profile into public.users (mirrors auth.users via DB trigger as primary path;
  // this is a fallback for when email confirmation is disabled)
  if (data.user) {
    await supabase.from("users").upsert({
      id: data.user.id,
      full_name: fullName,
    });
  }

  return {
    success:
      "Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
