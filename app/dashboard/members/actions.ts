"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UserStatus = "active" | "inactive" | "blocked";

type ToggleResult =
  | { ok: true }
  | { ok: false; error: string };

export async function toggleUserStatus(
  userId: string,
  newStatus: UserStatus
): Promise<ToggleResult> {
  // Guard: only authenticated sessions can call this action
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return { ok: false, error: "Não autorizado" };

  // Mutation uses service-role to bypass RLS
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    return { ok: false, error: "Falha ao atualizar o status do usuário" };
  }

  revalidatePath("/dashboard/members");
  return { ok: true };
}
