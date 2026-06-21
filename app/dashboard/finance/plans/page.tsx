import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlans } from "@/app/dashboard/finance/subscription-actions";
import { getCoupons } from "./actions";
import { PlansClient } from "./PlansClient";
import { ArrowLeftIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";

export const revalidate = 0;

export type DailyPassRow = {
  id: string;
  student_name: string;
  valid_for_date: string;
  purchased_at: string;
  status: "available" | "used" | "expired";
};

async function getDailyPasses(): Promise<DailyPassRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("daily_passes")
    .select(
      "id, valid_for_date, purchased_at, status, users!daily_passes_student_id_fkey(full_name)"
    )
    .order("valid_for_date", { ascending: false })
    .limit(100);

  return (data ?? []).map((row: any) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      id: row.id,
      student_name: user?.full_name ?? "—",
      valid_for_date: row.valid_for_date,
      purchased_at: row.purchased_at,
      status: row.status as DailyPassRow["status"],
    };
  });
}

export default async function PlansPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [plans, coupons, dailyPasses] = await Promise.all([
    getPlans(),
    getCoupons(),
    getDailyPasses(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div>
          <Link
            href="/dashboard/finance"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Financeiro
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <ShoppingCartIcon className="w-6 h-6 text-primary" />
            Balcão & Planos
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            POS manual, planos de assinatura, cupons e passes avulsos.
          </p>
        </div>
      </div>

      <PlansClient
        initialPlans={plans}
        initialCoupons={coupons}
        initialPasses={dailyPasses}
      />
    </div>
  );
}
