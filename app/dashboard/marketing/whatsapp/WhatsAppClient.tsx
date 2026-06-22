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
} from "@heroicons/react/24/outline";
import { CheckIcon as CheckSolidIcon } from "@heroicons/react/24/solid";
import type {
  WaContact,
  WaMessage,
  WaTemplate,
  WaAutomation,
  BroadcastGroup,
} from "./actions";
import {
  getMessages,
  markMessagesRead,
  sendMessage,
  toggleAutomation,
  setAutomationTemplate,
  upsertTemplate,
  sendBroadcast,
} from "./actions";

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

type Tab = "inbox" | "automations" | "broadcast";

// ── Root component ────────────────────────────────────────────────────────────

type Props = {
  initialContacts: WaContact[];
  initialTemplates: WaTemplate[];
  initialAutomations: WaAutomation[];
};

export function WhatsAppClient({
  initialContacts,
  initialTemplates,
  initialAutomations,
}: Props) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [contacts] = useState(initialContacts);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
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
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-[600px]">
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

      {tab === "inbox" && <InboxPane contacts={contacts} />}
      {tab === "automations" && (
        <AutomationsTab
          automations={initialAutomations}
          templates={initialTemplates}
        />
      )}
      {tab === "broadcast" && (
        <BroadcastTab templates={initialTemplates} />
      )}
    </div>
  );
}

// ── Inbox Pane ────────────────────────────────────────────────────────────────

function InboxPane({ contacts }: { contacts: WaContact[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WaContact | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showChat, setShowChat] = useState(false); // mobile: show right pane

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      contactLabel(c).toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const loadMessages = useCallback(
    async (contactId: string, silent = false) => {
      if (!silent) setLoadingMsgs(true);
      const msgs = await getMessages(contactId);
      setMessages(msgs);
      if (!silent) setLoadingMsgs(false);
      await markMessagesRead(contactId);
    },
    [],
  );

  function selectContact(c: WaContact) {
    setSelected(c);
    setShowChat(true);
    loadMessages(c.id);
  }

  // Polling: refresh messages every 5s while a contact is selected
  useEffect(() => {
    if (!selected) return;
    pollRef.current = setInterval(() => {
      loadMessages(selected.id, true);
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selected, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-1 overflow-hidden rounded-2xl border border-white/5 bg-surface-1">
      {/* Left pane: contact list */}
      <div
        className={`${
          showChat ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 border-r border-white/5 flex-shrink-0`}
      >
        {/* Search */}
        <div className="p-3 border-b border-white/5">
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
        </div>

        {/* Contact rows */}
        <ul className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-zinc-600">
              Nenhum contato encontrado.
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
  startTransition,
}: {
  contact: WaContact;
  messages: WaMessage[];
  loading: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onRefresh: () => void;
  onSent: (msg: WaMessage) => void;
  startTransition: (fn: () => void) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      if (!res.ok) setErr(res.message);
      setSending(false);
      onRefresh();
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
              <MessageBubble key={msg.id} msg={msg} />
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

function MessageBubble({ msg }: { msg: WaMessage }) {
  const out = msg.direction === "outbound";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
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

function BroadcastTab({ templates }: { templates: WaTemplate[] }) {
  const [templateId, setTemplateId] = useState("");
  const [group, setGroup] = useState<BroadcastGroup>("active");
  const [varValues, setVarValues] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
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
      </p>

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
          disabled={!templateId || sending}
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
