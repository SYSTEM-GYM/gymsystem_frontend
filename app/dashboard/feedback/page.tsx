import { redirect } from "next/navigation";
import { ChatBubbleLeftRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { getGymFeedbacks } from "./actions";
import { FeedbackInboxClient } from "./FeedbackInboxClient";

export const revalidate = 0;

export default async function FeedbackInboxPage() {
  const auth = await requireRole([...ADMIN_ROLES, "receptionist"]);
  if (!auth.ok) redirect("/dashboard");

  const feedbacks = await getGymFeedbacks({ status: "all" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
            Comunidade
          </p>
          <h1 className="text-xl font-black text-white leading-tight">Ouvidoria</h1>
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-info/5 border border-info/15 rounded-2xl">
        <ShieldCheckIcon className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          Estas mensagens são <span className="text-white font-semibold">100% anônimas por design</span>:
          nem o banco de dados permite identificar quem enviou. Responda com
          empatia — sua resposta é vista pelo aluno que escreveu.
        </p>
      </div>

      <FeedbackInboxClient initialFeedbacks={feedbacks} />
    </div>
  );
}
