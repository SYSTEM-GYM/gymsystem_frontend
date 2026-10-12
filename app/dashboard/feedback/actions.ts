"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";

const FEEDBACK_STAFF_ROLES = [...ADMIN_ROLES, "receptionist"];

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Admin-facing feedback shape — deliberately has NO student_id field.
 * anonymous_feedbacks has no staff SELECT policy in Postgres (see migration
 * 044), so this data can only be read via service_role; the sanitization
 * below is the second, application-level layer of the same guarantee.
 */
export type AdminFeedbackItem = {
  id: string;
  message: string;
  admin_reply: string | null;
  is_resolved: boolean;
  created_at: string;
  replied_at: string | null;
};

async function requireFeedbackStaff() {
  return requireRole(FEEDBACK_STAFF_ROLES);
}

export async function getGymFeedbacks(filter: {
  status?: "all" | "open" | "resolved";
}): Promise<AdminFeedbackItem[]> {
  const auth = await requireFeedbackStaff();
  if (!auth.ok || !auth.gymId) return [];

  const admin = createAdminClient();
  let q = admin
    .from("anonymous_feedbacks")
    // student_id intentionally excluded from the select — never leaves the DB
    .select("id, message, admin_reply, is_resolved, created_at, replied_at")
    .eq("gym_id", auth.gymId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter.status === "open") q = q.eq("is_resolved", false);
  if (filter.status === "resolved") q = q.eq("is_resolved", true);

  const { data } = await q;
  return (data ?? []) as AdminFeedbackItem[];
}

export async function replyToFeedback(input: {
  feedbackId: string;
  reply: string;
  markResolved: boolean;
}): Promise<ActionResult> {
  const auth = await requireFeedbackStaff();
  if (!auth.ok) return auth;
  if (!auth.gymId) return { ok: false, message: "Nenhuma unidade vinculada." };

  const reply = input.reply.trim();
  if (reply.length < 2) return { ok: false, message: "Escreva uma resposta." };

  const admin = createAdminClient();
  // gym_id filter on the WHERE clause prevents replying to another tenant's
  // feedback even with the service_role client.
  const { error } = await admin
    .from("anonymous_feedbacks")
    .update({
      admin_reply: reply,
      is_resolved: input.markResolved,
      replied_at: new Date().toISOString(),
    })
    .eq("id", input.feedbackId)
    .eq("gym_id", auth.gymId);

  if (error) {
    console.error("replyToFeedback:", error);
    return { ok: false, message: "Erro ao enviar a resposta." };
  }
  revalidatePath("/dashboard/feedback");
  return { ok: true };
}

export async function toggleFeedbackResolved(
  feedbackId: string,
  resolved: boolean,
): Promise<ActionResult> {
  const auth = await requireFeedbackStaff();
  if (!auth.ok) return auth;
  if (!auth.gymId) return { ok: false, message: "Nenhuma unidade vinculada." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("anonymous_feedbacks")
    .update({ is_resolved: resolved })
    .eq("id", feedbackId)
    .eq("gym_id", auth.gymId);

  if (error) return { ok: false, message: "Erro ao atualizar status." };
  revalidatePath("/dashboard/feedback");
  return { ok: true };
}
