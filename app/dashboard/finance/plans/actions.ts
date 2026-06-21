"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult = { ok: true } | { ok: false; message: string };

export type Coupon = {
  id: string;
  code: string;
  discount_percentage: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  active: boolean;
};

export type StudentOption = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
};

export type ManualSaleInput = {
  student_id: string;
  product_type: "plan" | "daily_pass";
  plan_id?: string;
  daily_pass_quantity?: number;
  coupon_code?: string;
  payment_method: "cash_pix" | "stripe";
  base_amount: number;
  notes?: string;
};

export type ManualSaleResult =
  | { ok: true; message: string; stripe_url?: string }
  | { ok: false; message: string };

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, message: "Não autorizado." };

  const { data: profile } = await authClient
    .from("users").select("role").eq("id", user.id).single();

  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Permissão insuficiente." };
  }
  return { ok: true, userId: user.id };
}

// ── Stripe helper ─────────────────────────────────────────────────────────────

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === "sk_test_your_key_here") return null;
  return new Stripe(key);
}

// ── Coupons ───────────────────────────────────────────────────────────────────

export async function getCoupons(): Promise<Coupon[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gym_coupons")
    .select("id, code, discount_percentage, max_uses, current_uses, expires_at, active")
    .order("created_at", { ascending: false });
  return (data ?? []) as Coupon[];
}

export async function createCoupon(input: {
  code: string;
  discount_percentage: number;
  max_uses: number | null;
  expires_at: string | null;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (input.discount_percentage < 1 || input.discount_percentage > 100) {
    return { ok: false, message: "Desconto deve estar entre 1% e 100%." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("gym_coupons").insert({
    code: input.code.toUpperCase().trim(),
    discount_percentage: input.discount_percentage,
    max_uses: input.max_uses ?? null,
    expires_at: input.expires_at ?? null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Código já existe." };
    console.error("createCoupon:", error);
    return { ok: false, message: "Erro ao criar cupom." };
  }

  revalidatePath("/dashboard/finance/plans");
  return { ok: true };
}

export async function toggleCoupon(id: string, active: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("gym_coupons").update({ active }).eq("id", id);

  if (error) return { ok: false, message: "Erro ao atualizar cupom." };

  revalidatePath("/dashboard/finance/plans");
  return { ok: true };
}

// ── Student search ────────────────────────────────────────────────────────────

export async function searchStudents(query: string): Promise<StudentOption[]> {
  const auth = await requireAdmin();
  if (!auth.ok) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, full_name, email, phone")
    .eq("role", "customer")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .order("full_name")
    .limit(10);

  return (data ?? []) as StudentOption[];
}

// ── Coupon validation (shared) ─────────────────────────────────────────────────

export type CouponValidation =
  | { valid: true; discount_percentage: number; coupon_id: string; final_amount: number }
  | { valid: false; message: string };

export async function validateCoupon(
  code: string,
  base_amount: number
): Promise<CouponValidation> {
  const admin = createAdminClient();
  const { data: coupon } = await admin
    .from("gym_coupons")
    .select("id, discount_percentage, max_uses, current_uses, expires_at, active")
    .eq("active", true)
    .ilike("code", code.trim())
    .maybeSingle();

  if (!coupon) return { valid: false, message: "Cupom não encontrado ou inativo." };

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, message: "Cupom expirado." };
  }
  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
    return { valid: false, message: "Cupom esgotado." };
  }

  const final_amount = base_amount * (1 - coupon.discount_percentage / 100);
  return {
    valid: true,
    discount_percentage: coupon.discount_percentage,
    coupon_id: coupon.id,
    final_amount: Math.round(final_amount * 100) / 100,
  };
}

async function incrementCouponUse(coupon_id: string) {
  const admin = createAdminClient();
  await admin.rpc("increment_coupon_uses", { coupon_id });
}

// ── Manual Sale (O Balcão) ────────────────────────────────────────────────────

export async function processManualSale(
  input: ManualSaleInput
): Promise<ManualSaleResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, message: auth.message };

  const admin = createAdminClient();

  // Resolve coupon discount
  let finalAmount = input.base_amount;
  let couponId: string | null = null;

  if (input.coupon_code) {
    const validation = await validateCoupon(input.coupon_code, input.base_amount);
    if (!validation.valid) return { ok: false, message: validation.message };
    finalAmount = validation.final_amount;
    couponId = validation.coupon_id;
  }

  const today = new Date().toISOString().split("T")[0];

  // ── CASH / PIX PATH ──────────────────────────────────────────────────────────
  if (input.payment_method === "cash_pix" || finalAmount === 0) {

    if (input.product_type === "plan" && input.plan_id) {
      const { data: plan } = await admin
        .from("gym_plans")
        .select("billing_cycle")
        .eq("id", input.plan_id)
        .single();

      if (!plan) return { ok: false, message: "Plano não encontrado." };

      const nextBilling = new Date();
      if (plan.billing_cycle === "monthly") nextBilling.setMonth(nextBilling.getMonth() + 1);
      else if (plan.billing_cycle === "quarterly") nextBilling.setMonth(nextBilling.getMonth() + 3);
      else nextBilling.setFullYear(nextBilling.getFullYear() + 1);

      // Deactivate any existing active sub for this student
      await admin
        .from("gym_subscriptions")
        .update({ status: "canceled" })
        .eq("student_id", input.student_id)
        .eq("status", "active");

      const { data: newSub, error: subError } = await admin
        .from("gym_subscriptions")
        .insert({
          student_id: input.student_id,
          plan_id: input.plan_id,
          status: "active",
          start_date: today,
          next_billing_date: nextBilling.toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (subError || !newSub) {
        console.error("processManualSale sub:", subError);
        return { ok: false, message: "Erro ao criar assinatura." };
      }

      // Create paid invoice
      await admin.from("gym_invoices").insert({
        subscription_id: newSub.id,
        student_id: input.student_id,
        amount: finalAmount,
        due_date: today,
        paid_date: today,
        status: "paid",
      });

    } else if (input.product_type === "daily_pass") {
      const qty = input.daily_pass_quantity ?? 1;
      const passes = Array.from({ length: qty }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
          student_id: input.student_id,
          valid_for_date: d.toISOString().split("T")[0],
          status: "available" as const,
        };
      });

      const { error: passError } = await admin.from("daily_passes").insert(passes);
      if (passError) {
        console.error("processManualSale pass:", passError);
        return { ok: false, message: "Erro ao criar passes. Verifique conflitos de data." };
      }
    }

    if (couponId) await incrementCouponUse(couponId);

    revalidatePath("/dashboard/finance/plans");
    revalidatePath("/dashboard/finance/subscriptions");
    return {
      ok: true,
      message: input.product_type === "plan"
        ? "Assinatura ativada com sucesso!"
        : `${input.daily_pass_quantity ?? 1} passe(s) criado(s)!`,
    };
  }

  // ── STRIPE PATH ───────────────────────────────────────────────────────────────
  const stripe = getStripe();
  if (!stripe) {
    return {
      ok: false,
      message: "Stripe não configurado. Adicione STRIPE_SECRET_KEY ao .env.local.",
    };
  }

  // Fetch student email for Stripe
  const { data: student } = await admin
    .from("users")
    .select("email, full_name, stripe_customer_id")
    .eq("id", input.student_id)
    .single();

  if (!student) return { ok: false, message: "Aluno não encontrado." };

  // Resolve or create Stripe customer
  let customerId = student.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: student.email,
      name: student.full_name ?? undefined,
      metadata: { supabase_id: input.student_id },
    });
    customerId = customer.id;
    await admin
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", input.student_id);
  }

  const productLabel =
    input.product_type === "plan"
      ? "Assinatura — Plano"
      : `Passes Avulsos (${input.daily_pass_quantity ?? 1}x)`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card", "boleto"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: { name: productLabel },
          unit_amount: Math.round(finalAmount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/finance/plans?sale=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/finance/plans?sale=cancelled`,
    metadata: {
      student_id: input.student_id,
      product_type: input.product_type,
      plan_id: input.plan_id ?? "",
      daily_pass_quantity: String(input.daily_pass_quantity ?? 1),
      coupon_id: couponId ?? "",
    },
  });

  if (couponId) await incrementCouponUse(couponId);

  revalidatePath("/dashboard/finance/plans");
  return {
    ok: true,
    message: "Link de pagamento gerado!",
    stripe_url: session.url ?? undefined,
  };
}

// ── Student self-service checkout ─────────────────────────────────────────────

export type StudentCheckoutInput = {
  product_type: "plan" | "daily_pass";
  plan_id?: string;
  daily_pass_quantity?: number;
  coupon_code?: string;
  base_amount: number;
};

export type StudentCheckoutResult =
  | { ok: true; action: "activated"; message: string }
  | { ok: true; action: "stripe"; stripe_url: string }
  | { ok: false; message: string };

export async function processStudentCheckout(
  input: StudentCheckoutInput
): Promise<StudentCheckoutResult> {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, message: "Não autorizado." };

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  let finalAmount = input.base_amount;
  let couponId: string | null = null;

  if (input.coupon_code) {
    const validation = await validateCoupon(input.coupon_code, input.base_amount);
    if (!validation.valid) return { ok: false, message: validation.message };
    finalAmount = validation.final_amount;
    couponId = validation.coupon_id;
  }

  // 100% discount → instant activation
  if (finalAmount === 0) {
    if (input.product_type === "plan" && input.plan_id) {
      const { data: plan } = await admin
        .from("gym_plans")
        .select("billing_cycle")
        .eq("id", input.plan_id)
        .single();

      if (!plan) return { ok: false, message: "Plano não encontrado." };

      const nextBilling = new Date();
      if (plan.billing_cycle === "monthly") nextBilling.setMonth(nextBilling.getMonth() + 1);
      else if (plan.billing_cycle === "quarterly") nextBilling.setMonth(nextBilling.getMonth() + 3);
      else nextBilling.setFullYear(nextBilling.getFullYear() + 1);

      await admin
        .from("gym_subscriptions")
        .update({ status: "canceled" })
        .eq("student_id", user.id)
        .eq("status", "active");

      const { data: newSub, error } = await admin
        .from("gym_subscriptions")
        .insert({
          student_id: user.id,
          plan_id: input.plan_id,
          status: "active",
          start_date: today,
          next_billing_date: nextBilling.toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (error || !newSub) return { ok: false, message: "Erro ao ativar assinatura." };

      await admin.from("gym_invoices").insert({
        subscription_id: newSub.id,
        student_id: user.id,
        amount: 0,
        due_date: today,
        paid_date: today,
        status: "paid",
      });
    } else if (input.product_type === "daily_pass") {
      const qty = input.daily_pass_quantity ?? 1;
      const passes = Array.from({ length: qty }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
          student_id: user.id,
          valid_for_date: d.toISOString().split("T")[0],
          status: "available" as const,
        };
      });
      const { error } = await admin.from("daily_passes").insert(passes);
      if (error) return { ok: false, message: "Erro ao gerar passes." };
    }

    if (couponId) await incrementCouponUse(couponId);
    revalidatePath("/app/wallet");
    return { ok: true, action: "activated", message: "Ativado com sucesso! 🎉" };
  }

  // Stripe checkout
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, message: "Pagamento online indisponível no momento. Fale com a recepção." };
  }

  const { data: profile } = await admin
    .from("users")
    .select("email, full_name, stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { ok: false, message: "Perfil não encontrado." };

  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name ?? undefined,
      metadata: { supabase_id: user.id },
    });
    customerId = customer.id;
    await admin.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const productLabel =
    input.product_type === "plan"
      ? "Assinatura"
      : `Passe Avulso (${input.daily_pass_quantity ?? 1}x)`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card", "boleto"],
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: { name: productLabel },
          unit_amount: Math.round(finalAmount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/app/wallet?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/app/wallet`,
    metadata: {
      student_id: user.id,
      product_type: input.product_type,
      plan_id: input.plan_id ?? "",
      daily_pass_quantity: String(input.daily_pass_quantity ?? 1),
      coupon_id: couponId ?? "",
    },
  });

  if (couponId) await incrementCouponUse(couponId);
  return { ok: true, action: "stripe", stripe_url: session.url ?? "" };
}
