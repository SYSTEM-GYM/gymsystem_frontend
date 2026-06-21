"use server";

import { createClient } from "@/lib/supabase/server";

export type StudentSubscription = {
  id: string;
  status: "active" | "canceled" | "past_due";
  start_date: string;
  next_billing_date: string;
  plan_name: string;
  plan_price: number;
  billing_cycle: "monthly" | "quarterly" | "yearly";
};

export type DailyPass = {
  id: string;
  valid_for_date: string;
  status: "available" | "used" | "expired";
  purchased_at: string;
};

export type WalletData = {
  subscription: StudentSubscription | null;
  dailyPasses: DailyPass[];
  hasAccess: boolean;
};

export async function getStudentWalletData(): Promise<WalletData> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { subscription: null, dailyPasses: [], hasAccess: false };
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch active/past_due subscription with plan details
  const [subResult, passResult] = await Promise.all([
    supabase
      .from("gym_subscriptions")
      .select("id, status, start_date, next_billing_date, gym_plans(name, price, billing_cycle)")
      .eq("student_id", user.id)
      .in("status", ["active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("daily_passes")
      .select("id, valid_for_date, status, purchased_at")
      .eq("student_id", user.id)
      .gte("valid_for_date", today)
      .order("valid_for_date", { ascending: true })
      .limit(10),
  ]);

  const subRow = subResult.data;
  const plan = subRow
    ? Array.isArray(subRow.gym_plans)
      ? subRow.gym_plans[0]
      : subRow.gym_plans
    : null;

  const subscription: StudentSubscription | null =
    subRow && plan
      ? {
          id: subRow.id,
          status: subRow.status as StudentSubscription["status"],
          start_date: subRow.start_date,
          next_billing_date: subRow.next_billing_date,
          plan_name: plan.name,
          plan_price: Number(plan.price),
          billing_cycle: plan.billing_cycle as StudentSubscription["billing_cycle"],
        }
      : null;

  const dailyPasses: DailyPass[] = (passResult.data ?? []).map((p) => ({
    id: p.id,
    valid_for_date: p.valid_for_date,
    status: p.status as DailyPass["status"],
    purchased_at: p.purchased_at,
  }));

  const hasActiveSubscription = subscription?.status === "active";
  const hasTodayPass = dailyPasses.some(
    (p) => p.valid_for_date === today && p.status === "available"
  );

  return {
    subscription,
    dailyPasses,
    hasAccess: hasActiveSubscription || hasTodayPass,
  };
}

