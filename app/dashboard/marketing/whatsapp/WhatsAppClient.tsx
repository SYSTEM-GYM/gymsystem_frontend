"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react";
import {
  ChatBubbleLeftEllipsisIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  BoltIcon,
  MegaphoneIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  LinkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon as CheckSolidIcon } from "@heroicons/react/24/solid";
import type {
  WaContact,
  WaMessage,
  WaTemplate,
  WaAutomation,
  BroadcastGroup,
  WaIntegrationPublic,
} from "./actions";
import {
  getContacts,
  getMessages,
  markMessagesRead,
  sendMessage,
  deleteMessage,
  clearChat,
  toggleAutomation,
  setAutomationTemplate,
  upsertTemplate,
  sendBroadcast,
  connectWhatsApp,
  disconnectWhatsApp,
  syncContactsFromStudents,
  syncContactsFromWhatsApp,
  importContacts,
  addContact,
  getBroadcastContactCount,
  getIntegration,
} from "./actions";
import { useWaInboxRealtime } from "@/lib/whatsapp/use-wa-realtime";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = today.getDate() - d.getDate();
  if (diff === 0 && d.getMonth() === today.getMonth()) return "Hoje";
  if (diff === 1 && d.getMonth() === today.getMonth()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function contactLabel(c: WaContact) {
  return c.student_name ?? c.name ?? c.phone;
}

function upsertMessageList(prev: WaMessage[], next: WaMessage): WaMessage[] {
  const byId = prev.findIndex((m) => m.id === next.id);
  if (byId >= 0) {
    const copy = [...prev];
    copy[byId] = next;
    return copy;
  }
  const optIdx = prev.findIndex(
    (m) =>
      m.id.startsWith("opt-") &&
      m.direction === next.direction &&
      m.content === next.content,
  );
  if (optIdx >= 0) {
    const copy = [...prev];
    copy[optIdx] = next;
    return copy;
  }
  return [...prev, next].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

const STATUS_ICON: Record<string, string> = {
  pending: "🕐",
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
  failed: "✗",
};

const AUTOMATION_LABELS: Record<string, { label: string; desc: string }> = {
  renewal_3d: {
    label: "Renovação em 3 dias",
    desc: "Avisa o aluno 3 dias antes do vencimento do plano.",
  },
  renewal_1d: {
    label: "Renovação amanhã",
    desc: "Lembrete final 1 dia antes do vencimento.",
  },
  birthday: {
    label: "Parabéns!",
    desc: "Mensagem de aniversário automática no dia do aluno.",
  },
  welcome: {
    label: "Boas-vindas",
    desc: "Enviado quando um novo aluno é cadastrado.",
  },
  overdue: {
    label: "Inadimplência",
    desc: "Notifica alunos com fatura vencida.",
  },
};

const GROUP_LABELS: Record<BroadcastGroup, string> = {
  all: "Todos os contatos",
  active: "Assinantes ativos",
  overdue: "Inadimplentes",
  opted_in: "Opt-in confirmado",
};

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "inbox" | "automations" | "broadcast" | "connection";

// ── Root component ────────────────────────────────────────────────────────────

type Props = {
  initialContacts: WaContact[];
  initialTemplates: WaTemplate[];
  initialAutomations: WaAutomation[];
  initialIntegration: WaIntegrationPublic;
};

export function WhatsAppClient({
  initialContacts,
  initialTemplates,
  initialAutomations,
  initialIntegration,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    initialIntegration.connected ? "inbox" : "connection",
  );
  const [contacts, setContacts] = useState(initialContacts);
  const [integration, setIntegration] = useState(initialIntegration);

  const refreshContacts = useCallback(async () => {
    const fresh = await getContacts();
    setContacts(fresh);
  }, []);

  // Sincroniza status da conexão (restaura sessão salva sem clicar em QR)
  useEffect(() => {
    let active = true;
    const sync = async () => {
      const status = await getIntegration();
      if (active) setIntegration(status);
    };
    void sync();
    const interval = setInterval(sync, integration.connected ? 12000 : 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [integration.connected]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "connection",
      label: "Conexão",
      icon: <LinkIcon className="w-4 h-4" />,
    },
    {
      id: "inbox",
      label: "Caixa de Entrada",
      icon: <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />,
    },
    {
      id: "automations",
      label: "Automações",
      icon: <BoltIcon className="w-4 h-4" />,
    },
    {
      id: "broadcast",
      label: "Disparos",
      icon: <MegaphoneIcon className="w-4 h-4" />,
    },
  ];

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
        <div
          className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            integration.connected
              ? "bg-[#25D366]/10 border-[#25D366]/20"
              : integration.status === "connecting"
                ? "bg-blue-500/10 border-blue-500/20"
                : "bg-amber-500/10 border-amber-500/20"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              integration.connected
                ? "bg-[#25D366] animate-pulse"
                : integration.status === "connecting"
                  ? "bg-blue-400 animate-pulse"
                  : "bg-amber-500"
            }`}
          />
          <span
            className={`text-xs font-semibold ${
              integration.connected
                ? "text-[#25D366]"
                : integration.status === "connecting"
                  ? "text-blue-400"
                  : "text-amber-400"
            }`}
          >
            {integration.connected
              ? integration.display_phone ?? "Conectado"
              : integration.status === "connecting"
                ? "Reconectando..."
                : integration.status === "qr_pending"
                  ? "Aguardando QR Code"
                  : "Não conectado"}
          </span>
        </div>
      </div>

      <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-surface-1 border border-white/5 rounded-2xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-primary text-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <InboxPane
          contacts={contacts}
          integration={integration}
          onContactsRefresh={refreshContacts}
        />
      )}
      {tab === "automations" && (
        <AutomationsTab
          automations={initialAutomations}
          templates={initialTemplates}
        />
      )}
      {tab === "broadcast" && (
        <BroadcastTab templates={initialTemplates} contactCount={contacts.length} />
      )}
      {tab === "connection" && (
        <ConnectionTab
          integration={integration}
          onIntegrationChange={setIntegration}
          onContactsImported={refreshContacts}
        />
      )}
      </div>
    </div>
  );
}

// ── Inbox Pane ────────────────────────────────────────────────────────────────

function InboxPane({
  contacts,
  integration,
  onContactsRefresh,
}: {
  contacts: WaContact[];
  integration: WaIntegrationPublic;
  onContactsRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WaContact | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const [showChat, setShowChat] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const loadMessages = useCallback(async (contactId: string) => {
    setLoadingMsgs(true);
    const msgs = await getMessages(contactId);
    setMessages(msgs);
    setLoadingMsgs(false);
    await markMessagesRead(contactId);
    void onContactsRefresh();
  }, [onContactsRefresh]);

  const handleMessageInsert = useCallback(
    (msg: WaMessage) => {
      setMessages((prev) => upsertMessageList(prev, msg));
      if (msg.direction === "inbound" && selected?.id === msg.contact_id) {
        void markMessagesRead(msg.contact_id);
      }
    },
    [selected?.id],
  );

  const handleMessageUpdate = useCallback((msg: WaMessage) => {
    setMessages((prev) => upsertMessageList(prev, msg));
  }, []);

  useWaInboxRealtime(
    selected?.id ?? null,
    onContactsRefresh,
    handleMessageInsert,
    handleMessageUpdate,
  );

  // Fallback leve se Realtime não estiver habilitado no Supabase
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(async () => {
      const msgs = await getMessages(selected.id);
      setMessages((prev) => {
        const same =
          prev.length === msgs.length &&
          prev.every(
            (m, i) =>
              m.id === msgs[i]?.id &&
              m.status === msgs[i]?.status &&
              m.content === msgs[i]?.content,
          );
        return same ? prev : msgs;
      });
    }, 8000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    const id = setInterval(() => {
      void onContactsRefresh();
    }, 15000);
    return () => clearInterval(id);
  }, [onContactsRefresh]);

  function selectContact(c: WaContact) {
    setSelected(c);
    setShowChat(true);
    void loadMessages(c.id);
  }

  // Mantém contato selecionado sincronizado com a lista (preview / não lidas)
  useEffect(() => {
    if (!selected) return;
    const updated = contacts.find((c) => c.id === selected.id);
    if (updated) setSelected(updated);
  }, [contacts, selected]);

  // Auto-scroll só quando chegam mensagens novas
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      contactLabel(c).toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  return (
    <div className="flex flex-col flex-1 gap-3 overflow-hidden">
      {showImport && (
        <ImportContactsPanel
          connected={integration.connected}
          onClose={() => setShowImport(false)}
          onImported={onContactsRefresh}
        />
      )}
    <div className="flex flex-1 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
      {/* Left pane: contact list */}
      <div
        className={`${
          showChat ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 border-r border-white/5 flex-shrink-0`}
      >
        {/* Search + import */}
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30"
            />
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-surface-2 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:border-primary/30 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Importar contatos
          </button>
        </div>

        {/* Contact rows */}
        <ul className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-zinc-600 space-y-3">
              <p>Nenhum contato encontrado.</p>
              <button
                onClick={() => setShowImport(true)}
                className="text-primary font-semibold hover:underline"
              >
                Importar contatos agora
              </button>
            </li>
          )}
          {filtered.map((c) => (
            <li
              key={c.id}
              onClick={() => selectContact(c)}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-white/5 transition-colors ${
                selected?.id === c.id
                  ? "bg-primary/10"
                  : "hover:bg-surface-2"
              }`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-black text-primary uppercase">
                  {contactLabel(c).charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white truncate">
                    {contactLabel(c)}
                  </p>
                  {c.last_message_at && (
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">
                      {fmtDate(c.last_message_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-zinc-500 truncate">
                    {c.last_message ?? c.phone}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-black text-[10px] font-black flex items-center justify-center">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right pane: message thread */}
      <div
        className={`${
          showChat ? "flex" : "hidden md:flex"
        } flex-col flex-1 overflow-hidden`}
      >
        {selected ? (
          <MessageThread
            contact={selected}
            messages={messages}
            loading={loadingMsgs}
            bottomRef={bottomRef}
            onBack={() => setShowChat(false)}
            onRefresh={() => loadMessages(selected.id)}
            onSent={(msg) => setMessages((prev) => [...prev, msg])}
            onMessageConfirmed={(msg) =>
              setMessages((prev) => upsertMessageList(prev, msg))
            }
            onMessageDeleted={(id) =>
              setMessages((prev) => prev.filter((m) => m.id !== id))
            }
            onChatCleared={() => setMessages([])}
            startTransition={startTransition}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <ChatBubbleLeftEllipsisIcon className="w-12 h-12 text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-500">
              Selecione um contato para ver o histórico de mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ── Message Thread ────────────────────────────────────────────────────────────

function MessageThread({
  contact,
  messages,
  loading,
  bottomRef,
  onBack,
  onRefresh,
  onSent,
  onMessageConfirmed,
  onMessageDeleted,
  onChatCleared,
  startTransition,
}: {
  contact: WaContact;
  messages: WaMessage[];
  loading: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onRefresh: () => void;
  onSent: (msg: WaMessage) => void;
  onMessageConfirmed: (msg: WaMessage) => void;
  onMessageDeleted: (id: string) => void;
  onChatCleared: () => void;
  startTransition: (fn: () => void) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDeleteMessage(messageId: string) {
    if (messageId.startsWith("opt-")) return;
    if (!confirm("Apagar esta mensagem?")) return;
    startTransition(async () => {
      const res = await deleteMessage(messageId);
      if (res.ok) onMessageDeleted(messageId);
      else setErr(res.message);
    });
  }

  async function handleClearChat() {
    setShowMenu(false);
    if (!confirm("Apagar todas as mensagens desta conversa?")) return;
    startTransition(async () => {
      const res = await clearChat(contact.id);
      if (res.ok) onChatCleared();
      else setErr(res.message);
    });
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    setErr(null);
    const optimistic: WaMessage = {
      id: `opt-${Date.now()}`,
      contact_id: contact.id,
      direction: "outbound",
      content: text.trim(),
      status: "pending",
      wa_message_id: null,
      sent_by: null,
      created_at: new Date().toISOString(),
    };
    onSent(optimistic);
    setText("");
    startTransition(async () => {
      const res = await sendMessage(contact.id, optimistic.content);
      if (!res.ok) {
        setErr(res.message);
        onMessageDeleted(optimistic.id);
      } else {
        onMessageConfirmed(res.message);
      }
      setSending(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  const grouped: { date: string; msgs: WaMessage[] }[] = [];
  for (const m of messages) {
    const d = fmtDate(m.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== d) {
      grouped.push({ date: d, msgs: [m] });
    } else {
      last.msgs.push(m);
    }
  }

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-surface-2"
        >
          ←
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-black text-primary uppercase">
            {contactLabel(contact).charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {contactLabel(contact)}
          </p>
          <p className="text-xs text-zinc-500">{contact.phone}</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-surface-2"
          title="Atualizar mensagens"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-surface-2"
            title="Opções da conversa"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-white/10 bg-surface-2 shadow-xl py-1">
              <button
                onClick={handleClearChat}
                className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-white/5"
              >
                Limpar conversa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {loading && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-zinc-600 py-8">
            Nenhuma mensagem ainda. Inicie a conversa!
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.date} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-zinc-600 font-semibold px-2">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            {group.msgs.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onDelete={
                  msg.id.startsWith("opt-")
                    ? undefined
                    : () => handleDeleteMessage(msg.id)
                }
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      {err && (
        <p className="px-4 py-2 text-xs text-danger bg-danger/10 border-t border-danger/20">
          {err}
        </p>
      )}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-white/5 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem... (Enter para enviar)"
          rows={1}
          className="flex-1 resize-none bg-surface-2 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30 max-h-32 overflow-y-auto leading-relaxed"
          style={{ minHeight: 44 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex-shrink-0 w-11 h-11 rounded-2xl bg-primary text-black flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

function MessageBubble({
  msg,
  onDelete,
}: {
  msg: WaMessage;
  onDelete?: () => void;
}) {
  const out = msg.direction === "outbound";
  return (
    <div className={`flex group ${out ? "justify-end" : "justify-start"}`}>
      <div className="flex items-end gap-1 max-w-[80%]">
        {onDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-danger hover:bg-surface-2 transition-opacity flex-shrink-0"
            title="Apagar mensagem"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            out
              ? "bg-primary text-black rounded-br-sm"
              : "bg-surface-2 text-white rounded-bl-sm"
          }`}
        >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <div
          className={`flex items-center justify-end gap-1 mt-1 ${
            out ? "text-black/60" : "text-zinc-500"
          }`}
        >
          <span className="text-[10px]">{fmtTime(msg.created_at)}</span>
          {out && (
            <span className="text-[10px]">
              {msg.status === "read" ? (
                <span className="text-blue-400">✓✓</span>
              ) : (
                STATUS_ICON[msg.status]
              )}
            </span>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Automations Tab ───────────────────────────────────────────────────────────

function AutomationsTab({
  automations,
  templates,
}: {
  automations: WaAutomation[];
  templates: WaTemplate[];
}) {
  const [items, setItems] = useState(automations);
  const [, startTransition] = useTransition();
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  function handleToggle(id: string, active: boolean) {
    setItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active } : a)),
    );
    startTransition(async () => {
      await toggleAutomation(id, active);
    });
  }

  function handleTemplate(id: string, templateId: string) {
    setItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, template_id: templateId } : a)),
    );
    startTransition(async () => {
      await setAutomationTemplate(id, templateId);
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">
            Configure mensagens automáticas via WhatsApp para seus alunos.
          </p>
        </div>
        <button
          onClick={() => setShowTemplateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black text-sm font-black rounded-xl hover:opacity-90"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Template
        </button>
      </div>

      {showTemplateForm && (
        <TemplateForm
          templates={templates}
          onClose={() => setShowTemplateForm(false)}
        />
      )}

      <div className="space-y-3">
        {items.map((automation) => {
          const info = AUTOMATION_LABELS[automation.trigger_type];
          const linkedTemplate = templates.find(
            (t) => t.id === automation.template_id,
          );

          return (
            <div
              key={automation.id}
              className={`bg-surface-1 border rounded-2xl p-4 space-y-3 transition-colors ${
                automation.active
                  ? "border-primary/20 bg-primary/5"
                  : "border-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      automation.active ? "bg-primary/20" : "bg-surface-2"
                    }`}
                  >
                    <BoltIcon
                      className={`w-4 h-4 ${
                        automation.active ? "text-primary" : "text-zinc-500"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{info?.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{info?.desc}</p>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(automation.id, !automation.active)}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                    automation.active ? "bg-primary" : "bg-zinc-700"
                  }`}
                  aria-label={automation.active ? "Desativar" : "Ativar"}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      automation.active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Template selector */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold w-16 flex-shrink-0">
                  Template
                </label>
                <div className="relative flex-1">
                  <select
                    value={automation.template_id ?? ""}
                    onChange={(e) =>
                      e.target.value && handleTemplate(automation.id, e.target.value)
                    }
                    className="w-full appearance-none bg-surface-2 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/30 pr-8"
                  >
                    <option value="">— Selecionar template —</option>
                    {templates
                      .filter((t) => t.active)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.type})
                        </option>
                      ))}
                  </select>
                  <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                </div>
                {linkedTemplate && (
                  <CheckSolidIcon className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Template Form ─────────────────────────────────────────────────────────────

function TemplateForm({
  templates,
  onClose,
}: {
  templates: WaTemplate[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<WaTemplate["type"]>("reminder");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Extract variables like {{1}}, {{2}} from content
  const vars = Array.from(content.matchAll(/\{\{(\d+)\}\}/g)).map(
    (m) => `variável ${m[1]}`,
  );

  async function handleSave() {
    if (!name.trim() || !content.trim()) {
      setErr("Nome e conteúdo são obrigatórios.");
      return;
    }
    setSaving(true);
    const res = await upsertTemplate({ name, content_template: content, type, variables: vars });
    setSaving(false);
    if (!res.ok) setErr(res.message);
    else onClose();
  }

  const TYPE_OPTS: { v: WaTemplate["type"]; l: string }[] = [
    { v: "billing", l: "Cobrança" },
    { v: "reminder", l: "Lembrete" },
    { v: "promo", l: "Promoção" },
    { v: "welcome", l: "Boas-vindas" },
  ];

  return (
    <div className="bg-surface-1 border border-primary/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">Novo Template</p>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: lembrete_renovacao"
            className="w-full px-3 py-2 text-sm bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Tipo</label>
          <div className="relative">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WaTemplate["type"])}
              className="w-full appearance-none px-3 py-2 text-sm bg-surface-2 border border-white/5 rounded-xl text-white focus:outline-none focus:border-primary/30 pr-8"
            >
              {TYPE_OPTS.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Conteúdo — use {`{{1}}`}, {`{{2}}`} para variáveis
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder={`Olá {{1}}, sua assinatura vence em {{2}} dias...`}
          className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30 resize-none leading-relaxed"
        />
        {vars.length > 0 && (
          <p className="text-[10px] text-zinc-600">
            Variáveis detectadas: {vars.join(", ")}
          </p>
        )}
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500 hover:text-white">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-primary text-black text-sm font-black rounded-xl disabled:opacity-50 hover:opacity-90"
        >
          {saving ? "Salvando…" : "Salvar Template"}
        </button>
      </div>
    </div>
  );
}

// ── Broadcast Tab ─────────────────────────────────────────────────────────────

function BroadcastTab({
  templates,
  contactCount,
}: {
  templates: WaTemplate[];
  contactCount: number;
}) {
  const [templateId, setTemplateId] = useState("");
  const [group, setGroup] = useState<BroadcastGroup>("all");
  const [varValues, setVarValues] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [groupCount, setGroupCount] = useState<number | null>(null);
  const [result, setResult] = useState<
    | null
    | { ok: true; sent: number }
    | { ok: false; message: string }
  >(null);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (selectedTemplate) {
      setVarValues(new Array(selectedTemplate.variables.length).fill(""));
    }
  }, [templateId, selectedTemplate]);

  useEffect(() => {
    let active = true;
    void getBroadcastContactCount(group).then((count) => {
      if (active) setGroupCount(count);
    });
    return () => {
      active = false;
    };
  }, [group, contactCount]);

  // Live preview
  const preview = selectedTemplate
    ? (() => {
        let p = selectedTemplate.content_template;
        varValues.forEach((v, i) => {
          p = p.replace(`{{${i + 1}}}`, v || `{{${i + 1}}}`);
        });
        return p;
      })()
    : null;

  async function handleSend() {
    if (!templateId) return;
    setSending(true);
    setResult(null);
    const res = await sendBroadcast({ templateId, group, variableValues: varValues });
    setSending(false);
    setResult(res);
  }

  const GROUPS: BroadcastGroup[] = ["all", "active", "overdue", "opted_in"];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <p className="text-sm text-zinc-400">
        Envie uma mensagem em massa para grupos de contatos via WhatsApp.
        {contactCount === 0 && (
          <span className="block mt-2 text-amber-400">
            Nenhum contato cadastrado — importe na aba Conexão ou Caixa de Entrada antes de disparar.
          </span>
        )}
      </p>

      {templates.filter((t) => t.active).length === 0 && (
        <div className="px-4 py-3 rounded-xl text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Crie um template na aba Automações antes de fazer disparos.
        </div>
      )}

      <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 space-y-5">
        {/* Template select */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            Template da mensagem
          </label>
          <div className="relative">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full appearance-none px-4 py-3 text-sm bg-surface-2 border border-white/5 rounded-xl text-white focus:outline-none focus:border-primary/30 pr-10"
            >
              <option value="">— Selecionar template —</option>
              {templates
                .filter((t) => t.active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.type}
                  </option>
                ))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        {/* Variable values */}
        {selectedTemplate && selectedTemplate.variables.length > 0 && (
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Preencher variáveis
            </label>
            <div className="grid grid-cols-2 gap-2">
              {selectedTemplate.variables.map((v, i) => (
                <div key={i} className="space-y-1">
                  <label className="text-[10px] text-zinc-600">
                    {`{{${i + 1}}}`} — {v}
                  </label>
                  <input
                    value={varValues[i] ?? ""}
                    onChange={(e) =>
                      setVarValues((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Pré-visualização
            </label>
            <div className="bg-surface-2 border border-white/5 rounded-xl p-4">
              <div className="inline-block max-w-xs bg-primary text-black text-sm px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed whitespace-pre-wrap">
                {preview}
              </div>
            </div>
          </div>
        )}

        {/* Group select */}
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            Grupo de destinatários
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  group === g
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/5 text-zinc-500 hover:text-white hover:border-white/10"
                }`}
              >
                {group === g && <CheckIcon className="w-4 h-4 flex-shrink-0" />}
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {groupCount !== null && (
          <p className="text-xs text-zinc-500">
            <span className="font-semibold text-white">{groupCount}</span>{" "}
            {groupCount === 1 ? "contato válido" : "contatos válidos"} neste grupo
          </p>
        )}

        {/* Result */}
        {result && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
              result.ok
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-danger/10 text-danger border border-danger/20"
            }`}
          >
            {result.ok ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Disparo enviado para {result.sent}{" "}
                {result.sent === 1 ? "contato" : "contatos"}.
              </>
            ) : (
              <>
                <XMarkIcon className="w-4 h-4" />
                {result.message}
              </>
            )}
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!templateId || sending || groupCount === 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-black font-black rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {sending ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <MegaphoneIcon className="w-4 h-4" />
              Iniciar Disparo
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Import Contacts Panel ─────────────────────────────────────────────────────

function parseCsvContacts(text: string): { phone: string; name?: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const rows: { phone: string; name?: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((p) => p.trim().replace(/^"|"$/g, ""));
    const lower = parts.join(" ").toLowerCase();
    if (
      i === 0 &&
      (lower.includes("telefone") ||
        lower.includes("phone") ||
        lower.includes("nome") ||
        lower.includes("name"))
    ) {
      continue;
    }
    if (parts.length >= 2) {
      rows.push({ name: parts[0], phone: parts[1] });
    } else if (parts.length === 1) {
      rows.push({ phone: parts[0] });
    }
  }

  return rows;
}

function ImportContactsPanel({
  connected,
  onClose,
  onImported,
  embedded,
}: {
  connected: boolean;
  onClose?: () => void;
  onImported: () => void | Promise<void>;
  embedded?: boolean;
}) {
  const [mode, setMode] = useState<"manual" | "csv">("manual");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(
    label: string,
    fn: () => Promise<{ ok: boolean; message?: string; imported?: number; skipped?: number }>,
  ) {
    setBusy(label);
    setMsg(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      setMsg({ type: "err", text: res.message ?? "Erro ao importar." });
      return;
    }
    const extra =
      res.skipped && res.skipped > 0
        ? ` (${res.skipped} ignorado(s) por telefone inválido)`
        : "";
    setMsg({
      type: "ok",
      text: `${res.imported ?? 0} contato(s) importado(s)${extra}.`,
    });
    await onImported();
  }

  return (
    <div
      className={
        embedded
          ? "space-y-4"
          : "bg-surface-1 border border-primary/20 rounded-2xl p-5 space-y-4"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Importar contatos</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Alunos, conversas do WhatsApp, CSV ou cadastro manual.
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          disabled={!!busy}
          onClick={() =>
            run("alunos", async () => {
              const res = await syncContactsFromStudents();
              return res.ok
                ? { ok: true, imported: res.imported }
                : { ok: false, message: res.message };
            })
          }
          className="px-4 py-2 text-xs font-semibold bg-surface-2 border border-white/10 rounded-xl text-white hover:border-primary/30 disabled:opacity-40"
        >
          {busy === "alunos" ? "Importando…" : "Dos alunos cadastrados"}
        </button>
        <button
          disabled={!!busy || !connected}
          onClick={() =>
            run("wa", async () => {
              const res = await syncContactsFromWhatsApp();
              return res.ok
                ? { ok: true, imported: res.imported }
                : { ok: false, message: res.message };
            })
          }
          className="px-4 py-2 text-xs font-semibold bg-surface-2 border border-white/10 rounded-xl text-white hover:border-primary/30 disabled:opacity-40"
          title={connected ? undefined : "Conecte o WhatsApp primeiro"}
        >
          {busy === "wa" ? "Sincronizando…" : "Das conversas do WhatsApp"}
        </button>
      </div>

      <div className="flex gap-1 bg-surface-2 border border-white/5 rounded-xl p-1 w-fit">
        {(["manual", "csv"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === m ? "bg-primary text-black" : "text-zinc-500 hover:text-white"
            }`}
          >
            {m === "manual" ? "Manual" : "CSV / Arquivo"}
          </button>
        ))}
      </div>

      {mode === "manual" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              className="w-full px-3 py-2 text-sm bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              className="w-full px-3 py-2 text-sm bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30"
            />
          </div>
          <button
            disabled={!!busy || !phone.trim()}
            onClick={() =>
              run("manual", async () => {
                const res = await addContact({ phone, name: name || undefined });
                if (!res.ok) return { ok: false, message: res.message };
                setName("");
                setPhone("");
                return { ok: true, imported: 1 };
              })
            }
            className="col-span-2 py-2.5 bg-primary text-black text-sm font-black rounded-xl disabled:opacity-40"
          >
            {busy === "manual" ? "Salvando…" : "Adicionar contato"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setCsvText(String(reader.result ?? ""));
              reader.readAsText(file);
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold bg-surface-2 border border-white/10 rounded-xl text-white hover:border-primary/30"
            >
              Escolher arquivo
            </button>
            <span className="text-xs text-zinc-600 self-center">
              Formato: nome, telefone (uma linha por contato)
            </span>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={5}
            placeholder={`nome,telefone\nJoão Silva,11999999999\nMaria,21988887777`}
            className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30 resize-none font-mono"
          />
          <button
            disabled={!!busy || !csvText.trim()}
            onClick={() =>
              run("csv", async () => {
                const rows = parseCsvContacts(csvText);
                const res = await importContacts(rows);
                if (!res.ok) return { ok: false, message: res.message };
                setCsvText("");
                return {
                  ok: true,
                  imported: res.imported,
                  skipped: res.skipped,
                };
              })
            }
            className="w-full py-2.5 bg-primary text-black text-sm font-black rounded-xl disabled:opacity-40"
          >
            {busy === "csv" ? "Importando…" : "Importar do CSV"}
          </button>
        </div>
      )}

      {msg && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-semibold ${
            msg.type === "ok"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-danger/10 text-danger border border-danger/20"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Connection Tab ────────────────────────────────────────────────────────────

function ConnectionTab({
  integration,
  onIntegrationChange,
  onContactsImported,
}: {
  integration: WaIntegrationPublic;
  onIntegrationChange: (i: WaIntegrationPublic) => void;
  onContactsImported: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (
      integration.status !== "qr_pending" &&
      integration.status !== "connecting" &&
      integration.connected
    ) {
      return;
    }

    const poll = setInterval(async () => {
      const status = await getIntegration();
      onIntegrationChange(status);
    }, 2000);

    return () => clearInterval(poll);
  }, [integration.status, integration.connected, onIntegrationChange]);

  async function handleConnect() {
    setConnecting(true);
    setMsg(null);
    const res = await connectWhatsApp();
    setConnecting(false);
    if ("ok" in res && res.ok === false) {
      setMsg({ type: "err", text: res.message });
      return;
    }
    if ("status" in res) {
      onIntegrationChange(res);
      setMsg({
        type: "ok",
        text:
          res.status === "connected"
            ? "WhatsApp conectado!"
            : "Escaneie o QR Code com seu celular.",
      });
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setMsg(null);
    const res = await disconnectWhatsApp();
    setDisconnecting(false);
    if ("ok" in res && res.ok === false) {
      setMsg({ type: "err", text: res.message });
      return;
    }
    if ("status" in res) {
      onIntegrationChange(res);
      setMsg({ type: "ok", text: "WhatsApp desconectado." });
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 space-y-5">
        <div>
          <p className="text-sm font-bold text-white">Conectar WhatsApp</p>
          <p className="text-xs text-zinc-500 mt-1">
            Conexão via{" "}
            <a
              href="https://wwebjs.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              whatsapp-web.js
            </a>
            {" "}— igual ao WhatsApp Web. Escaneie o QR Code com o app no celular.
          </p>
        </div>

        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            integration.connected
              ? "bg-[#25D366]/10 border-[#25D366]/20"
              : "bg-amber-500/10 border-amber-500/20"
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              integration.connected
                ? "bg-[#25D366] animate-pulse"
                : "bg-amber-500"
            }`}
          />
          <div>
            <p
              className={`text-sm font-bold ${
                integration.connected ? "text-[#25D366]" : "text-amber-400"
              }`}
            >
              {integration.connected
                ? "Conectado"
                : integration.status === "qr_pending"
                  ? "Aguardando leitura do QR Code"
                  : integration.status === "connecting"
                    ? "Conectando…"
                    : "Desconectado"}
            </p>
            {integration.display_phone && (
              <p className="text-xs text-zinc-500">{integration.display_phone}</p>
            )}
          </div>
        </div>

        {integration.qr_code && !integration.connected && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="p-4 bg-white rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={integration.qr_code}
                alt="QR Code WhatsApp"
                width={256}
                height={256}
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-zinc-500 text-center max-w-xs">
              Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
            </p>
          </div>
        )}

        {msg && (
          <div
            className={`px-4 py-3 rounded-xl text-sm font-semibold ${
              msg.type === "ok"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-danger/10 text-danger border border-danger/20"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!integration.connected ? (
            <button
              onClick={handleConnect}
              disabled={connecting || integration.status === "connecting"}
              className="px-5 py-2.5 bg-[#25D366] text-black text-sm font-black rounded-xl disabled:opacity-40 hover:opacity-90"
            >
              {connecting || integration.status === "connecting"
                ? "Iniciando…"
                : integration.status === "qr_pending"
                  ? "Gerar novo QR Code"
                  : "Conectar WhatsApp"}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-5 py-2.5 bg-danger/20 border border-danger/30 text-danger text-sm font-semibold rounded-xl hover:bg-danger/30 disabled:opacity-40"
            >
              {disconnecting ? "Desconectando…" : "Desconectar"}
            </button>
          )}
        </div>
      </div>

      <ImportContactsPanel
        embedded
        connected={integration.connected}
        onImported={onContactsImported}
      />

      <div className="bg-surface-1 border border-white/5 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-white">Como funciona</p>
        <ol className="text-xs text-zinc-500 space-y-2 list-decimal list-inside">
          <li>Certifique-se de que o backend está rodando (<code className="text-zinc-400">npm run start:dev</code> na pasta backend).</li>
          <li>Clique em &quot;Conectar WhatsApp&quot; e escaneie o QR Code.</li>
          <li>Importe contatos (alunos, conversas do WhatsApp ou CSV).</li>
          <li>Use a Caixa de Entrada para conversar — mensagens enviadas pelo celular também aparecem aqui.</li>
          <li>Use Disparos para mensagens em massa com templates.</li>
        </ol>
        <p className="text-[10px] text-zinc-600 pt-1">
          A sessão fica salva no servidor. Se o backend reiniciar, pode ser necessário escanear o QR novamente.
        </p>
      </div>
    </div>
  );
}
