import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Nova senha | CM Gym Connect",
};

// Reached from the recovery e-mail via /auth/confirm, which opens the session.
// Without a session there is nothing to update — ask for a fresh link.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/forgot-password?link=expired");

  return <ResetPasswordForm email={user.email ?? null} />;
}
