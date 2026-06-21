"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  PlusIcon,
  ArrowRightOnRectangleIcon,
  UsersIcon,
  KeyIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { TrophyIcon } from "@heroicons/react/24/solid";
import { createSquad, joinSquad, type SquadWithMeta } from "@/app/app/gymconnect-actions";

// ── Avatar ────────────────────────────────────────────────────────────────────

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const init = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
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
      className="block bg-surface-1 border border-white/5 rounded-2xl p-4 hover:border-white/15 transition-colors active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <Initials name={squad.name} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-snug">{squad.name}</p>
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
              className="flex items-center gap-1 hover:text-zinc-400 transition-colors"
            >
              {copied ? <CheckIcon className="w-3 h-3 text-primary" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
              {copied ? "Copiado!" : squad.invite_code}
            </button>
          </div>
        </div>
        <TrophyIcon className="w-4 h-4 text-zinc-700 flex-shrink-0 mt-0.5" />
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
          <h2 className="text-base font-black text-white">Criar Squad</h2>
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
          className="w-full min-h-[44px] bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
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
          <h2 className="text-base font-black text-white">Entrar em Squad</h2>
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
          className="w-full min-h-[44px] bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
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
      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 min-h-[48px] bg-primary text-black font-bold rounded-2xl text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          Criar Squad
        </button>
        <button
          type="button"
          onClick={() => setShowJoin(true)}
          className="flex items-center justify-center gap-2 min-h-[48px] bg-surface-1 border border-white/10 text-zinc-300 font-semibold rounded-2xl text-sm hover:border-white/25 transition-colors"
        >
          <KeyIcon className="w-4 h-4" />
          Entrar com Código
        </button>
      </div>

      {/* Squad list */}
      {squads.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto mb-4">
            <UsersIcon className="w-8 h-8 text-zinc-700" />
          </div>
          <p className="text-sm font-semibold text-zinc-500">Nenhum squad ainda</p>
          <p className="text-xs text-zinc-600 mt-1">
            Crie um grupo ou entre com um código de convite.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
