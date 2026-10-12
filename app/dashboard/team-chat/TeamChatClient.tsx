"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PaperAirplaneIcon, TrashIcon } from "@heroicons/react/24/outline";
import { deleteTeamMessage, sendTeamMessage, type TeamMessage } from "./actions";
import { useTeamChatRealtime } from "@/lib/team-chat/use-team-chat-realtime";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dateSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Hoje";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function TeamChatClient({
  initialMessages,
  currentUserId,
  gymId,
  isAdmin,
}: {
  initialMessages: TeamMessage[];
  currentUserId: string;
  gymId: string | null;
  isAdmin: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const nameCache = useRef(new Map(initialMessages.map((m) => [m.sender_id, m.sender_name])));
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleInsert = useCallback(
    (row: { id: string; sender_id: string; content: string; created_at: string }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [
          ...prev,
          {
            id: row.id,
            sender_id: row.sender_id,
            sender_name:
              row.sender_id === currentUserId
                ? "Você"
                : (nameCache.current.get(row.sender_id) ?? "Colega"),
            content: row.content,
            created_at: row.created_at,
          },
        ];
      });
    },
    [currentUserId],
  );

  const handleDelete = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  useTeamChatRealtime(gymId, handleInsert, handleDelete);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setError(null);
    setDraft("");
    startSending(async () => {
      const res = await sendTeamMessage(content);
      if (!res.ok) {
        setError(res.message);
        setDraft(content);
      }
    });
  }

  function handleDeleteClick(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    startSending(async () => {
      await deleteTeamMessage(id);
    });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-zinc-600 text-center">
              Nenhuma mensagem ainda.
              <br />
              Comece a conversa com a equipe!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId;
            const prev = messages[idx - 1];
            const showDateSeparator =
              !prev || dateSeparatorLabel(prev.created_at) !== dateSeparatorLabel(msg.created_at);
            const showSenderName = !isMe && (!prev || prev.sender_id !== msg.sender_id || showDateSeparator);
            const canDelete = isMe || isAdmin;

            return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">
                      {dateSeparatorLabel(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
                <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {showSenderName && (
                      <span className="text-[10px] font-semibold text-primary/80 px-1">
                        {msg.sender_name}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {canDelete && !isMe && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-700 hover:text-danger transition-opacity"
                          aria-label="Excluir mensagem"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      )}
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line break-words ${
                          isMe
                            ? "bg-primary text-black rounded-br-md"
                            : "bg-surface-2 text-zinc-100 rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {canDelete && isMe && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-700 hover:text-danger transition-opacity"
                          aria-label="Excluir mensagem"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <span className={`text-[9px] text-zinc-600 px-1 ${isMe ? "text-right" : ""}`}>
                      {timeLabel(msg.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-white/5 p-3 shrink-0 space-y-1.5">
        {error && <p className="text-xs text-danger px-1">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escreva para a equipe..."
            rows={1}
            maxLength={4000}
            className="flex-1 bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-none max-h-32 focus:outline-none focus:border-primary/40 transition-colors"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="shrink-0 w-11 h-11 rounded-2xl bg-primary text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
