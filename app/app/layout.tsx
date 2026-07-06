import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentBottomNav } from "@/app/components/app/StudentBottomNav";
import { StoreCartProvider } from "@/lib/store-cart";

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
        <StudentBottomNav />
      </div>
    </StoreCartProvider>
  );
}
