import { redirect } from "next/navigation";
import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { getTeamMessages } from "./actions";
import { TeamChatClient } from "./TeamChatClient";

export const revalidate = 0;

export default async function TeamChatPage() {
  const auth = await requireRole([...ADMIN_ROLES, "receptionist", "trainer"]);
  if (!auth.ok) redirect("/dashboard");

  const messages = await getTeamMessages();

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
            Equipe
          </p>
          <h1 className="text-xl font-black text-white leading-tight">Chat da Equipe</h1>
        </div>
      </div>

      <TeamChatClient
        initialMessages={messages}
        currentUserId={auth.userId}
        gymId={auth.gymId}
        isAdmin={ADMIN_ROLES.includes(auth.role)}
      />
    </div>
  );
}
