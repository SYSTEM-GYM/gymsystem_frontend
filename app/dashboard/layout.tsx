import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { MobileHeader } from "@/components/nav/MobileHeader";
import { GymSelector } from "@/app/components/layout/GymSelector";

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

  // Only admins have gyms to select between
  let ownedGyms: { id: string; name: string; city: string }[] = [];
  if (role === "admin") {
    const { data: gyms } = await supabase
      .from("gyms")
      .select("id, name, city")
      .eq("owner_id", user.id)
      .order("name");
    ownedGyms = gyms ?? [];
  }

  return (
    <div className="min-h-screen bg-base flex">
      {/* Desktop icon-rail sidebar — 72px wide */}
      <aside className="hidden lg:flex lg:flex-col w-[72px] bg-surface-1 border-r border-white/5 fixed inset-y-0 left-0 z-20">
        <SidebarNav role={role} />
      </aside>

      {/* Main area offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col lg:pl-[72px]">
        <MobileHeader role={role} gyms={ownedGyms} currentGymId={homeGymId} />

        {/* Desktop topbar — shows gym selector for admins */}
        {role === "admin" && ownedGyms.length > 0 && (
          <div className="hidden lg:flex items-center justify-end px-8 py-3 border-b border-white/5 bg-surface-1/50">
            <GymSelector gyms={ownedGyms} currentGymId={homeGymId} />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
