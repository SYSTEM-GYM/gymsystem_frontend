import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppClient } from "./WhatsAppClient";
import { getContacts, getTemplates, getAutomations, getIntegration } from "./actions";

export const revalidate = 0;

export default async function WhatsAppPage() {
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

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [contacts, templates, automations, integration] = await Promise.all([
    getContacts(),
    getTemplates(),
    getAutomations(),
    getIntegration(),
  ]);

  return (
    <WhatsAppClient
      initialContacts={contacts}
      initialTemplates={templates}
      initialAutomations={automations}
      initialIntegration={integration}
    />
  );
}
