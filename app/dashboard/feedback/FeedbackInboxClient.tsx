"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import {
  getGymFeedbacks,
  replyToFeedback,
  toggleFeedbackResolved,
  type AdminFeedbackItem,
} from "./actions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return "agora há pouco";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function FeedbackRow({
  item,
  onChanged,
}: {
  item: AdminFeedbackItem;
  onChanged: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [reply, setReply] = useState(item.admin_reply ?? "");
  const [markResolved, setMarkResolved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSendReply() {
    setError(null);
    startTransition(async () => {
      const res = await replyToFeedback({
        feedbackId: item.id,
        reply,
        markResolved,
      });
      if (res.ok) {
        setShowReply(false);
        onChanged();
      } else {
        setError(res.message);
      }
    });
  }

  function handleToggleResolved() {
    startTransition(async () => {
      const res = await toggleFeedbackResolved(item.id, !item.is_resolved);
      if (res.ok) onChanged();
    });
  }

  return (
    <div className={`bg-surface-1 border rounded-2xl overflow-hidden ${item.is_resolved ? "border-white/5" : "border-primary/15"}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <ClockIcon className="w-3 h-3" />
            {timeAgo(item.created_at)}
          </span>
          <button
            type="button"
            onClick={handleToggleResolved}
            disabled={pending}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors disabled:opacity-40 ${
              item.is_resolved
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-surface-2 text-zinc-500 border-white/8 hover:text-zinc-300"
            }`}
          >
            <CheckCircleIcon className="w-3 h-3" />
            {item.is_resolved ? "Resolvido" : "Marcar resolvido"}
          </button>
        </div>

        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
          {item.message}
        </p>

        {item.admin_reply && !showReply && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">
              Sua resposta
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
              {item.admin_reply}
            </p>
          </div>
        )}

        {showReply ? (
          <div className="space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Escreva sua resposta ao aluno..."
              className="w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-primary/40 transition-colors"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={markResolved}
                onChange={(e) => setMarkResolved(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-primary"
              />
              Marcar como resolvido ao enviar
            </label>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReply(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={pending || reply.trim().length < 2}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-black disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {pending ? "Enviando..." : "Enviar Resposta"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowReply(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-primary transition-colors"
          >
            <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
            {item.admin_reply ? "Editar resposta" : "Responder"}
          </button>
        )}
      </div>
    </div>
  );
}

type Filter = "all" | "open" | "resolved";

export function FeedbackInboxClient({
  initialFeedbacks,
}: {
  initialFeedbacks: AdminFeedbackItem[];
}) {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState(initialFeedbacks);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();

  function refresh(nextFilter: Filter = filter) {
    startTransition(async () => {
      setFeedbacks(await getGymFeedbacks({ status: nextFilter }));
      router.refresh();
    });
  }

  const openCount = feedbacks.filter((f) => !f.is_resolved).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); refresh(f); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              filter === f
                ? "bg-primary text-black border-primary"
                : "bg-surface-1 border-white/10 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f === "all" ? "Todas" : f === "open" ? `Em análise (${openCount})` : "Resolvidas"}
          </button>
        ))}
      </div>

      {feedbacks.length === 0 ? (
        <div className="py-16 text-center">
          <ChatBubbleLeftIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Nenhuma mensagem por aqui ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((item) => (
            <FeedbackRow key={item.id} item={item} onChanged={() => refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}
