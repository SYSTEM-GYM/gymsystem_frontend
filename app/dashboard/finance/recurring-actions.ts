"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin as requireAdminRole } from "@/lib/auth-utils";

export type RecurringActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

const VALID_CATEGORIES = [
  "rent", "energy", "water", "payroll",
  "maintenance", "supplies", "equipment", "other",
] as const;

// ── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  const result = await requireAdminRole();
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true };
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createRecurringExpense(
  _prev: RecurringActionState,
  formData: FormData
): Promise<RecurringActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const name = (formData.get("name") as string).trim();
  const category = formData.get("category") as string;
  const amountRaw = (formData.get("amount") as string).replace(",", ".");
  const dayRaw = formData.get("day_of_month") as string;

  if (!name) return { status: "error", message: "Nome é obrigatório." };

  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return { status: "error", message: "Categoria inválida." };
  }

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    return { status: "error", message: "Valor inválido. Informe um número maior que zero." };
  }

  const day = parseInt(dayRaw, 10);
  if (isNaN(day) || day < 1 || day > 28) {
    return { status: "error", message: "Dia do vencimento deve ser entre 1 e 28." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("recurring_expenses").insert({
    name,
    category,
    amount,
    day_of_month: day,
  });

  if (error) {
    console.error("createRecurringExpense error:", error);
    return { status: "error", message: "Erro ao criar despesa fixa. Tente novamente." };
  }

  revalidatePath("/dashboard/finance");
  return { status: "success" };
}

// ── Toggle active ────────────────────────────────────────────────────────────

export async function toggleRecurringExpense(
  id: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("recurring_expenses")
    .update({ is_active: !isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("toggleRecurringExpense error:", error);
    return { ok: false, error: "Erro ao alterar status." };
  }

  revalidatePath("/dashboard/finance");
  return { ok: true };
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteRecurringExpense(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("recurring_expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteRecurringExpense error:", error);
    return { ok: false, error: "Erro ao excluir despesa fixa." };
  }

  revalidatePath("/dashboard/finance");
  return { ok: true };
}
