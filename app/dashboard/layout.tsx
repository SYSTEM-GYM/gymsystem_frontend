import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MobileHeader } from "@/components/nav/MobileHeader";
import { GymSelector } from "@/app/components/layout/GymSelector";
import { getTenantBranding } from "@/lib/tenant-utils";

export type UserRole = "admin" | "trainer" | "customer";

export default async function DashboardLayout({
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
    .select("role, home_gym_id")
    .eq("id", user.id)
    .single();

  const role: UserRole = (profile?.role as UserRole) ?? "customer";
  const homeGymId: string | null = profile?.home_gym_id ?? null;

  let ownedGyms: { id: string; name: string; city: string }[] = [];
  if (role === "admin") {
    const { data: gyms } = await supabase
      .from("gyms")
      .select("id, name, city")
      .eq("owner_id", user.id)
      .order("name");
    ownedGyms = gyms ?? [];
  }

  // White-label branding — resolved from the subdomain slug the middleware
  // injects. No slug (Master platform) falls back to the default "SIMP" name/logo.
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");
  const branding = tenantSlug ? await getTenantBranding(tenantSlug) : null;
  const gymName = branding?.name ?? "SIMP";
  const logoUrl = branding?.logoUrl ?? null;

  const header = (
    <>
      {/* Mobile slide-in drawer header */}
      <MobileHeader
        role={role}
        gyms={ownedGyms}
        currentGymId={homeGymId}
        gymName={gymName}
        logoUrl={logoUrl}
      />

      {/* Desktop topbar — gym selector for admins */}
      {role === "admin" && ownedGyms.length > 0 && (
        <div className="hidden lg:flex items-center justify-end px-8 py-3 border-b border-white/5 bg-surface-1/50">
          <GymSelector gyms={ownedGyms} currentGymId={homeGymId} />
        </div>
      )}
    </>
  );

  return (
    <DashboardShell role={role} header={header} gymName={gymName} logoUrl={logoUrl}>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto w-full">{children}</div>
      </main>
    </DashboardShell>
  );
}
