"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin as requireAdminRole } from "@/lib/auth-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult = { ok: true } | { ok: false; message: string };

export type BranchPricing = {
  id: string;
  gym_id: string;
  monthly_price: number;
  active: boolean;
};

export type GymPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  active: boolean;
  branch_pricings: BranchPricing[];
};

export type GymBranch = {
  id: string;
  name: string;
};

export type SubscriptionKpis = {
  mrr: number;
  activeCount: number;
  overdueInvoiceTotal: number;
  overdueInvoiceCount: number;
  defaultRate: number;
};

export type InvoiceRow = {
  id: string;
  student_id: string;
  student_name: string;
  student_phone: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: "paid" | "pending" | "overdue";
  plan_name: string;
  days_overdue: number;
};

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await requireAdminRole();
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true };
}

// ── KPI fetch ─────────────────────────────────────────────────────────────────

export async function getSubscriptionKpis(): Promise<SubscriptionKpis> {
  const admin = createAdminClient();

  // Active subscriptions with their plan prices
  const { data: activeSubs } = await admin
    .from("gym_subscriptions")
    .select("id, plan_id, gym_plans(price, billing_cycle)")
    .eq("status", "active");

  let mrr = 0;
  const activeCount = (activeSubs ?? []).length;

  for (const sub of activeSubs ?? []) {
    const plan = Array.isArray(sub.gym_plans) ? sub.gym_plans[0] : sub.gym_plans;
    if (!plan) continue;
    const price = Number(plan.price);
    if (plan.billing_cycle === "monthly") mrr += price;
    else if (plan.billing_cycle === "quarterly") mrr += price / 3;
    else if (plan.billing_cycle === "yearly") mrr += price / 12;
  }

  // Overdue invoices
  const { data: overdueInvoices } = await admin
    .from("gym_invoices")
    .select("amount")
    .eq("status", "overdue");

  const overdueInvoiceTotal = (overdueInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );
  const overdueInvoiceCount = (overdueInvoices ?? []).length;
  const totalInvoiced = overdueInvoiceTotal + (activeSubs ?? []).length * (mrr || 1);
  const defaultRate = activeCount > 0
    ? (overdueInvoiceCount / Math.max(activeCount, 1)) * 100
    : 0;

  return { mrr, activeCount, overdueInvoiceTotal, overdueInvoiceCount, defaultRate };
}

// ── Invoice list ──────────────────────────────────────────────────────────────

export async function getInvoices(
  statusFilter?: "paid" | "pending" | "overdue" | "all",
  limit = 50
): Promise<InvoiceRow[]> {
  const admin = createAdminClient();

  let query = admin
    .from("gym_invoices")
    .select(`
      id, student_id, amount, due_date, paid_date, status,
      gym_subscriptions!inner(
        gym_plans(name)
      ),
      users!gym_invoices_student_id_fkey(full_name, phone)
    `)
    .order("due_date", { ascending: false })
    .limit(limit);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;

  const today = new Date();
  return (data ?? []).map((row: any) => {
    const sub = Array.isArray(row.gym_subscriptions)
      ? row.gym_subscriptions[0]
      : row.gym_subscriptions;
    const plan = sub ? (Array.isArray(sub.gym_plans) ? sub.gym_plans[0] : sub.gym_plans) : null;
    const user = Array.isArray(row.users) ? row.users[0] : row.users;

    const dueDate = new Date(row.due_date);
    const daysOverdue = row.status === "overdue"
      ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      id: row.id,
      student_id: row.student_id,
      student_name: user?.full_name ?? "—",
      student_phone: user?.phone ?? null,
      amount: Number(row.amount),
      due_date: row.due_date,
      paid_date: row.paid_date,
      status: row.status,
      plan_name: plan?.name ?? "—",
      days_overdue: Math.max(0, daysOverdue),
    };
  });
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getGyms(): Promise<GymBranch[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gyms")
    .select("id, name")
    .order("name", { ascending: true });
  return (data ?? []) as GymBranch[];
}

export async function getPlans(): Promise<GymPlan[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gym_plans")
    .select("id, name, description, price, billing_cycle, active, plan_branch_pricing(id, gym_id, monthly_price, active)")
    .order("price", { ascending: true });

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    billing_cycle: row.billing_cycle,
    active: row.active,
    branch_pricings: (row.plan_branch_pricing ?? []).map((bp: any) => ({
      id: bp.id,
      gym_id: bp.gym_id,
      monthly_price: Number(bp.monthly_price),
      active: bp.active,
    })) as BranchPricing[],
  })) as GymPlan[];
}

export async function upsertPlanBranchPricing(
  planId: string,
  pricings: { gym_id: string; monthly_price: number; active: boolean }[]
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  // Delete removed branch pricings (gym_ids not in new list)
  const activeGymIds = pricings.map((p) => p.gym_id);
  if (activeGymIds.length > 0) {
    await admin
      .from("plan_branch_pricing")
      .delete()
      .eq("plan_id", planId)
      .not("gym_id", "in", `(${activeGymIds.map((id) => `"${id}"`).join(",")})`);
  } else {
    // No branches selected — remove all
    await admin.from("plan_branch_pricing").delete().eq("plan_id", planId);
  }

  if (pricings.length === 0) {
    revalidatePath("/dashboard/finance/plans");
    return { ok: true };
  }

  const { error } = await admin.from("plan_branch_pricing").upsert(
    pricings.map((p) => ({
      plan_id: planId,
      gym_id: p.gym_id,
      monthly_price: p.monthly_price,
      active: p.active,
    })),
    { onConflict: "plan_id,gym_id" }
  );

  if (error) {
    console.error("upsertPlanBranchPricing:", error);
    return { ok: false, message: "Erro ao salvar preços por filial." };
  }

  revalidatePath("/dashboard/finance/plans");
  revalidatePath("/app/wallet");
  return { ok: true };
}

export async function createPlan(input: {
  name: string;
  description?: string | null;
  price: number;
  billing_cycle: "monthly" | "quarterly" | "yearly";
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin.from("gym_plans").insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price: input.price,
    billing_cycle: input.billing_cycle,
  });

  if (error) {
    console.error("createPlan error:", error);
    return { ok: false, message: "Erro ao criar plano." };
  }

  revalidatePath("/dashboard/finance/plans");
  revalidatePath("/dashboard/finance/subscriptions");
  return { ok: true };
}

export async function updatePlan(input: {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  billing_cycle: "monthly" | "quarterly" | "yearly";
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("gym_plans")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: input.price,
      billing_cycle: input.billing_cycle,
    })
    .eq("id", input.id);

  if (error) {
    console.error("updatePlan error:", error);
    return { ok: false, message: "Erro ao atualizar plano." };
  }

  revalidatePath("/dashboard/finance/plans");
  revalidatePath("/dashboard/finance/subscriptions");
  return { ok: true };
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function createSubscription(input: {
  studentId: string;
  planId: string;
  startDate: string;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  const { data: plan } = await admin
    .from("gym_plans")
    .select("billing_cycle")
    .eq("id", input.planId)
    .single();

  if (!plan) return { ok: false, message: "Plano não encontrado." };

  const start = new Date(input.startDate);
  let nextBilling = new Date(start);
  if (plan.billing_cycle === "monthly") nextBilling.setMonth(nextBilling.getMonth() + 1);
  else if (plan.billing_cycle === "quarterly") nextBilling.setMonth(nextBilling.getMonth() + 3);
  else nextBilling.setFullYear(nextBilling.getFullYear() + 1);

  const { error } = await admin.from("gym_subscriptions").insert({
    student_id: input.studentId,
    plan_id: input.planId,
    start_date: input.startDate,
    next_billing_date: nextBilling.toISOString().split("T")[0],
    status: "active",
  });

  if (error) {
    console.error("createSubscription error:", error);
    return { ok: false, message: "Erro ao criar assinatura." };
  }

  revalidatePath("/dashboard/finance/subscriptions");
  return { ok: true };
}

// ── generateMonthlyInvoices ───────────────────────────────────────────────────
// Finds active subscriptions whose next_billing_date <= today + 3 days
// and creates 'pending' invoices for them (idempotent via conflict ignore).

export async function generateMonthlyInvoices(): Promise<
  { ok: true; created: number } | { ok: false; message: string; created: number }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message, created: 0 };

  const admin = createAdminClient();

  const lookahead = new Date();
  lookahead.setDate(lookahead.getDate() + 3);
  const cutoff = lookahead.toISOString().split("T")[0];

  const { data: subs } = await admin
    .from("gym_subscriptions")
    .select("id, student_id, plan_id, next_billing_date, gym_plans(price)")
    .eq("status", "active")
    .lte("next_billing_date", cutoff);

  if (!subs || subs.length === 0) return { ok: true, created: 0 };

  let created = 0;
  for (const sub of subs) {
    const plan = Array.isArray(sub.gym_plans) ? sub.gym_plans[0] : sub.gym_plans;
    if (!plan) continue;

    // Check if invoice already exists for this billing cycle
    const { data: existing } = await admin
      .from("gym_invoices")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("due_date", sub.next_billing_date)
      .maybeSingle();

    if (existing) continue;

    const { error } = await admin.from("gym_invoices").insert({
      subscription_id: sub.id,
      student_id: sub.student_id,
      amount: Number(plan.price),
      due_date: sub.next_billing_date,
      status: "pending",
    });

    if (!error) {
      created++;

      // Advance next_billing_date
      const { data: planFull } = await admin
        .from("gym_plans")
        .select("billing_cycle")
        .eq("id", sub.plan_id)
        .single();

      if (planFull) {
        const next = new Date(sub.next_billing_date);
        if (planFull.billing_cycle === "monthly") next.setMonth(next.getMonth() + 1);
        else if (planFull.billing_cycle === "quarterly") next.setMonth(next.getMonth() + 3);
        else next.setFullYear(next.getFullYear() + 1);

        await admin
          .from("gym_subscriptions")
          .update({ next_billing_date: next.toISOString().split("T")[0] })
          .eq("id", sub.id);
      }
    }
  }

  revalidatePath("/dashboard/finance/subscriptions");
  return { ok: true, created };
}

// ── markInvoiceAsPaid ─────────────────────────────────────────────────────────

export async function markInvoiceAsPaid(invoiceId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { error } = await admin
    .from("gym_invoices")
    .update({ status: "paid", paid_date: today })
    .eq("id", invoiceId);

  if (error) {
    console.error("markInvoiceAsPaid error:", error);
    return { ok: false, message: "Erro ao marcar como pago." };
  }

  // Also ensure subscription status is 'active'
  const { data: invoice } = await admin
    .from("gym_invoices")
    .select("subscription_id")
    .eq("id", invoiceId)
    .single();

  if (invoice) {
    await admin
      .from("gym_subscriptions")
      .update({ status: "active" })
      .eq("id", invoice.subscription_id);
  }

  revalidatePath("/dashboard/finance/subscriptions");
  return { ok: true };
}

// ── markOverdueInvoices ───────────────────────────────────────────────────────
// Promotes 'pending' invoices past their due_date to 'overdue'.

export async function markOverdueInvoices(): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { error } = await admin
    .from("gym_invoices")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", today);

  if (error) {
    console.error("markOverdueInvoices error:", error);
    return { ok: false, message: "Erro ao atualizar faturas vencidas." };
  }

  // Flip subscriptions with overdue invoices to 'past_due'
  const { data: overdueInvoices } = await admin
    .from("gym_invoices")
    .select("subscription_id")
    .eq("status", "overdue");

  const subIds = [...new Set((overdueInvoices ?? []).map((i) => i.subscription_id))];
  if (subIds.length > 0) {
    await admin
      .from("gym_subscriptions")
      .update({ status: "past_due" })
      .in("id", subIds);
  }

  revalidatePath("/dashboard/finance/subscriptions");
  return { ok: true };
}

