import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { getMyFeedbacks } from "./actions";
import { FeedbackClient } from "./FeedbackClient";

export const revalidate = 0;

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const feedbacks = await getMyFeedbacks();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
            Sua voz importa
          </p>
          <h1 className="text-xl font-black text-white leading-tight">Ouvidoria</h1>
        </div>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed">
        Envie sugestões, elogios ou reclamações diretamente à administração.
        Sua mensagem é <span className="text-white font-semibold">100% anônima</span> —
        nem mesmo o administrador consegue ver quem enviou.
      </p>

      <FeedbackClient initialFeedbacks={feedbacks} />
    </div>
  );
}
