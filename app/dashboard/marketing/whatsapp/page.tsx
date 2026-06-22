import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppClient } from "./WhatsAppClient";
import { getContacts, getTemplates, getAutomations } from "./actions";
import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";

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

  const [contacts, templates, automations] = await Promise.all([
    getContacts(),
    getTemplates(),
    getAutomations(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-[#25D366]" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#25D366] uppercase tracking-widest">
            Marketing
          </p>
          <h1 className="text-xl font-black text-white leading-tight">
            WhatsApp CRM
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20">
          <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
          <span className="text-xs font-semibold text-[#25D366]">
            {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <WhatsAppClient
        initialContacts={contacts}
        initialTemplates={templates}
        initialAutomations={automations}
      />
    </div>
  );
}
