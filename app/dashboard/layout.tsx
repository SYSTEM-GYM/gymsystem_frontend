import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { MobileHeader } from "@/components/nav/MobileHeader";

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
    .select("role")
    .eq("id", user.id)
    .single();

  const role: UserRole = (profile?.role as UserRole) ?? "customer";

  return (
    <div className="min-h-screen bg-base flex">
      {/* Desktop icon-rail sidebar — 72px wide */}
      <aside className="hidden lg:flex lg:flex-col w-[72px] bg-surface-1 border-r border-white/5 fixed inset-y-0 left-0 z-20">
        <SidebarNav role={role} />
      </aside>

      {/* Main area offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col lg:pl-[72px]">
        <MobileHeader role={role} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
