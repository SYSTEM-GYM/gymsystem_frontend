import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentBottomNav } from "@/app/components/app/StudentBottomNav";
import { StoreCartProvider } from "@/lib/store-cart";

/**
 * Best active coupon of the student's gym for the flash badge on the store
 * tab. Uses the admin client because customers deliberately have no SELECT
 * policy on store_coupons — only the label is exposed, never the code list.
 */
async function getFlashCouponLabel(gymId: string | null): Promise<string | null> {
  if (!gymId) return null;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("store_coupons")
    .select("discount_type, discount_value, expires_at, max_uses, used_count")
    .eq("gym_id", gymId)
    .eq("active", true)
    .lte("starts_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("discount_value", { ascending: false })
    .limit(5);

  const usable = (data ?? []).find(
    (c) => c.max_uses === null || c.used_count < c.max_uses,
  );
  if (!usable) return null;

  const off =
    usable.discount_type === "percentage"
      ? `${Number(usable.discount_value)}% OFF`
      : `R$ ${Number(usable.discount_value).toFixed(0)} OFF`;

  return usable.expires_at ? `Cupom Relâmpago: ${off}!` : `Cupom Ativo: ${off}`;
}

export default async function StudentAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, first_name, full_name, photo_url, home_gym_id")
    .eq("id", user.id)
    .single();

  // Non-customers should be in /dashboard
  if (profile && profile.role !== "customer") {
    redirect("/dashboard");
  }

  const flashCoupon = await getFlashCouponLabel(profile?.home_gym_id ?? null);

  return (
    <StoreCartProvider>
      {/* Full-height viewport; content scrolls above the fixed bottom nav */}
      <div className="min-h-screen bg-base flex flex-col">
        {/* Scrollable content area — pb-20 leaves room for the 80px bottom nav */}
        <main className="flex-1 overflow-y-auto pb-20">
          <div className="max-w-lg mx-auto w-full px-4 pt-6">
            {children}
          </div>
        </main>

        {/* Fixed bottom navigation — mobile-first */}
        <StudentBottomNav flashCoupon={flashCoupon} />
      </div>
    </StoreCartProvider>
  );
}
