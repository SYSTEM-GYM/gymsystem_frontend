"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  PlusIcon,
  UsersIcon,
  KeyIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { TrophyIcon, UserGroupIcon } from "@heroicons/react/24/solid";
import { createSquad, joinSquad, type SquadWithMeta } from "@/app/app/gymconnect-actions";

// ── Avatar ────────────────────────────────────────────────────────────────────

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
      <span className="text-xs font-black text-primary">{init.toUpperCase()}</span>
    </div>
  );
}

// ── Squad Card ────────────────────────────────────────────────────────────────

function SquadCard({ squad }: { squad: SquadWithMeta }) {
  const [copied, setCopied] = useState(false);

  function copyCode(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(squad.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Link
      href={`/app/gymconnect/${squad.id}`}
      className="block bg-surface-1 border border-white/8 rounded-3xl overflow-hidden hover:border-primary/25 transition-colors active:scale-[0.99]"
    >
      <div className="h-1 bg-linear-to-r from-primary/60 via-primary/20 to-transparent" />
      <div className="flex items-center gap-3 p-4">
        <Initials name={squad.name} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-snug truncate">{squad.name}</p>
          {squad.description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{squad.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <UsersIcon className="w-3 h-3" />
              {squad.member_count} membro{squad.member_count !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1 hover:text-zinc-400 transition-colors font-mono"
            >
              {copied ? <CheckIcon className="w-3 h-3 text-primary" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
              {copied ? "Copiado!" : squad.invite_code}
            </button>
          </div>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-zinc-600 shrink-0" />
      </div>
    </Link>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inputCls =
    "w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors";

  function handleCreate() {
    if (!name.trim()) { setError("Nome do squad é obrigatório."); return; }
    startTransition(async () => {
      const result = await createSquad({ name, description: desc || null });
      if (result.ok) {
        onClose();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-safe-bottom pb-6">
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-white">Criar Squad</h2>
          <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Nome do Squad *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Família Silva, Casal Fitness..."
              maxLength={80}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Descrição (opcional)</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Nosso grupo de treino..."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={pending}
          className="w-full min-h-11 bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {pending ? "Criando..." : "Criar Squad"}
        </button>
      </div>
    </div>
  );
}

// ── Join Modal ────────────────────────────────────────────────────────────────

function JoinModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleJoin() {
    if (!code.trim()) { setError("Digite o código do squad."); return; }
    startTransition(async () => {
      const result = await joinSquad(code);
      if (result.ok) {
        onClose();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-safe-bottom pb-6">
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-white">Entrar em Squad</h2>
          <button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">Código do Squad</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: A3F9BC"
            maxLength={8}
            className="w-full bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors font-mono tracking-widest text-center"
          />
          <p className="text-[10px] text-zinc-600 mt-1.5">
            Peça ao criador do squad para compartilhar o código de convite.
          </p>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleJoin}
          disabled={pending}
          className="w-full min-h-11 bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {pending ? "Entrando..." : "Entrar no Squad"}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function SquadListClient({ squads }: { squads: SquadWithMeta[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  return (
    <>
      {/* Hero CTA — first squad */}
      {squads.length === 0 && (
        <div className="relative overflow-hidden bg-surface-1 border border-white/8 rounded-3xl p-6 text-center bg-linear-to-br from-primary/12 via-surface-1 to-surface-1">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="font-black text-white">Monte seu Squad</p>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-60 mx-auto leading-relaxed">
            Convide amigos, dispute desafios com foto de prova e mantenha a ofensiva em grupo.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 min-h-12 bg-primary text-black font-bold rounded-2xl text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          Criar Squad
        </button>
        <button
          type="button"
          onClick={() => setShowJoin(true)}
          className="flex items-center justify-center gap-2 min-h-12 bg-surface-1 border border-white/10 text-zinc-300 font-semibold rounded-2xl text-sm hover:border-white/25 transition-colors"
        >
          <KeyIcon className="w-4 h-4" />
          Entrar com Código
        </button>
      </div>

      {/* Squad list */}
      {squads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <TrophyIcon className="w-3.5 h-3.5 text-primary" />
              Meus Squads
            </p>
            <span className="text-xs font-semibold text-zinc-600 tabular-nums">{squads.length}</span>
          </div>
          {squads.map((s) => (
            <SquadCard key={s.id} squad={s} />
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
    </>
  );
}
