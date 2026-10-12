"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckBadgeIcon,
  ClockIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { submitFeedback, type MyFeedback } from "./actions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return "agora há pouco";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function FeedbackCard({ item }: { item: MyFeedback }) {
  return (
    <div className="bg-surface-1 border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <ClockIcon className="w-3 h-3" />
            {timeAgo(item.created_at)}
          </span>
          {item.is_resolved ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <CheckBadgeIcon className="w-3 h-3" />
              Resolvido
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-zinc-500 border border-white/8">
              Em análise
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
          {item.message}
        </p>
      </div>

      {item.admin_reply && (
        <div className="border-t border-white/5 bg-primary/5 px-4 py-3">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">
            Resposta da administração
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
            {item.admin_reply}
          </p>
        </div>
      )}
    </div>
  );
}

export function FeedbackClient({ initialFeedbacks }: { initialFeedbacks: MyFeedback[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await submitFeedback(message);
      if (res.ok) {
        setMessage("");
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <LockClosedIcon className="w-3.5 h-3.5" />
          Nova mensagem anônima
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Conte o que está pensando: sugestões de equipamento, elogios ao personal, algo que pode melhorar..."
          rows={4}
          maxLength={2000}
          className="w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-primary/40 transition-colors"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-zinc-600">{message.length}/2000</span>
          {error && <p className="text-xs text-danger flex-1 text-right">{error}</p>}
        </div>
        {success && (
          <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
            Mensagem enviada com sucesso! Acompanhe a resposta aqui.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || message.trim().length < 5}
          className="w-full min-h-12 rounded-2xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          {pending ? "Enviando..." : "Enviar Anonimamente"}
        </button>
      </div>

      {/* History */}
      {initialFeedbacks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Suas mensagens
          </p>
          <div className="space-y-2">
            {initialFeedbacks.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
