"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth-utils";

export type ActionResult = { ok: true } | { ok: false; message: string };

export type MyFeedback = {
  id: string;
  message: string;
  admin_reply: string | null;
  is_resolved: boolean;
  created_at: string;
  replied_at: string | null;
};

/** Student's own submissions — RLS scopes this to auth.uid() automatically. */
export async function getMyFeedbacks(): Promise<MyFeedback[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("anonymous_feedbacks")
    .select("id, message, admin_reply, is_resolved, created_at, replied_at")
    .order("created_at", { ascending: false });

  return (data ?? []) as MyFeedback[];
}

export async function submitFeedback(message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const trimmed = message.trim();
  if (trimmed.length < 5) {
    return { ok: false, message: "Escreva uma mensagem com pelo menos 5 caracteres." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, message: "Mensagem muito longa (máx. 2000 caracteres)." };
  }

  const profile = await getSessionProfile();
  if (!profile?.gymId) {
    return { ok: false, message: "Sua conta não está vinculada a uma unidade." };
  }

  const { error } = await supabase.from("anonymous_feedbacks").insert({
    student_id: user.id,
    gym_id: profile.gymId,
    message: trimmed,
  });

  if (error) {
    console.error("submitFeedback:", error);
    return { ok: false, message: "Erro ao enviar sua mensagem. Tente novamente." };
  }

  revalidatePath("/app/feedback");
  return { ok: true };
}
