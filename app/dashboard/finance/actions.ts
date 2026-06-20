"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TransactionActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function createManualTransaction(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  // Auth guard
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { status: "error", message: "Não autorizado." };

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "trainer")) {
    return { status: "error", message: "Permissão insuficiente." };
  }

  // Parse and validate fields
  const type = formData.get("type") as string;
  const category = formData.get("category") as string;
  const amountRaw = formData.get("amount") as string;
  const description = (formData.get("description") as string).trim() || null;
  const due_date = (formData.get("due_date") as string) || null;
  const status = formData.get("status") as string;
  const linked_user_id = (formData.get("linked_user_id") as string) || null;

  if (!["income", "expense"].includes(type)) {
    return { status: "error", message: "Tipo de lançamento inválido." };
  }

  const validCategories = ["subscription", "rent", "energy", "payroll", "ecommerce", "other"];
  if (!validCategories.includes(category)) {
    return { status: "error", message: "Categoria inválida." };
  }

  const amount = parseFloat(amountRaw.replace(",", "."));
  if (isNaN(amount) || amount <= 0) {
    return { status: "error", message: "Valor inválido. Informe um número maior que zero." };
  }

  if (!["pending", "paid", "overdue"].includes(status)) {
    return { status: "error", message: "Status inválido." };
  }

  // The user_id on the transaction: for income/subscription linked to a member, use linked_user_id.
  // For everything else, use the admin's own id as the actor.
  const isLinkedSubscription =
    type === "income" && category === "subscription" && !!linked_user_id;

  const transaction_user_id = isLinkedSubscription ? linked_user_id : user.id;

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("financial_transactions").insert({
    user_id: transaction_user_id,
    amount,
    type,
    category,
    status,
    description,
    due_date: due_date || null,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  });

  if (insertError) {
    console.error("createManualTransaction insert error:", insertError);
    return { status: "error", message: "Erro ao salvar lançamento. Tente novamente." };
  }

  // Side effect: a paid subscription activates the linked member (unlocks turnstile)
  if (isLinkedSubscription && status === "paid") {
    const { error: activateError } = await admin
      .from("users")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", linked_user_id);

    if (activateError) {
      console.error("createManualTransaction activate user error:", activateError);
      // Non-fatal: transaction was saved; surface a warning but still return success
      revalidatePath("/dashboard/finance");
      return {
        status: "error",
        message: "Lançamento salvo, mas não foi possível ativar o aluno automaticamente.",
      };
    }

    revalidatePath("/dashboard/members");
  }

  revalidatePath("/dashboard/finance");
  return { status: "success" };
}
