"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  XMarkIcon,
  ScaleIcon,
  ArrowsUpDownIcon,
  LockClosedIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  updateMedicalNotes,
  resetMemberPassword,
  updateMemberStatus,
  type MemberStatus,
} from "@/app/dashboard/members/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberProfile = {
  id: string;
  full_name: string;
  first_name: string | null;
  photo_url: string | null;
  birth_date: string | null;
  weight: number | null;
  height: number | null;
  status: string;
  plan_type: string;
  medical_notes: string | null;
  cpf: string | null;
  phone: string | null;
  experience_points: number;
};

type Props = {
  member: MemberProfile | null;
  onClose: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

const STATUS_LABELS: Record<string, string> = {
  active:   "Ativo",
  inactive: "Inativo",
  banned:   "Banido",
};

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-primary/10 text-primary border border-primary/20",
  inactive: "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50",
  banned:   "bg-danger/10 text-danger border border-danger/20",
};

const PLAN_LABELS: Record<string, string> = {
  basic:   "Básico",
  premium: "Premium",
  vip:     "VIP",
};

// ── Medical Notes Block ───────────────────────────────────────────────────────

function MedicalNotesBlock({ memberId, initial }: { memberId: string; initial: string | null }) {
  const [notes, setNotes]       = useState(initial ?? "");
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateMedicalNotes(memberId, notes);
      if (result.ok) {
        setSaved(true);
        timerRef.current = setTimeout(() => setSaved(false), 2500);
      } else {
        setError(result.error);
      }
    });
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Observações Médicas
        <span className="ml-1 text-zinc-600 normal-case font-normal">
          (lesões, doenças, restrições)
        </span>
      </label>
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        rows={4}
        placeholder="Ex: Hérnia de disco L4-L5, evitar exercícios de impacto..."
        className="w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-none"
      />
      <div className="flex items-center justify-between">
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        {saved && !error && (
          <p className="text-xs text-primary flex items-center gap-1">
            <CheckIcon className="w-3.5 h-3.5" /> Salvo
          </p>
        )}
        {!saved && !error && <span />}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ── Password Reset Block ──────────────────────────────────────────────────────

function PasswordResetBlock({ memberId }: { memberId: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm]         = useState("");
  const [message, setMessage]         = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition]    = useTransition();

  function handleReset() {
    setMessage(null);
    if (newPassword.length < 8) {
      setMessage({ ok: false, text: "A senha deve ter ao menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirm) {
      setMessage({ ok: false, text: "As senhas não coincidem." });
      return;
    }
    startTransition(async () => {
      const result = await resetMemberPassword(memberId, newPassword);
      if (result.ok) {
        setMessage({ ok: true, text: "Senha redefinida com sucesso." });
        setNewPassword("");
        setConfirm("");
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  const inputClass =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Redefinir Senha
      </label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Nova senha (mín. 8 caracteres)"
        autoComplete="new-password"
        className={inputClass}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirmar nova senha"
        autoComplete="new-password"
        className={inputClass}
      />
      {message && (
        <p className={`text-xs ${message.ok ? "text-primary" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={handleReset}
        disabled={pending || !newPassword}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold bg-surface-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
      >
        <LockClosedIcon className="w-4 h-4" />
        {pending ? "Redefinindo..." : "Redefinir Senha"}
      </button>
    </div>
  );
}

// ── Status Block ──────────────────────────────────────────────────────────────

function StatusBlock({ memberId, currentStatus }: { memberId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(currentStatus);

  function setStatus(status: MemberStatus) {
    startTransition(async () => {
      const result = await updateMemberStatus(memberId, status);
      if (result.ok) setLocalStatus(status);
    });
  }

  const options: { value: MemberStatus; label: string; className: string }[] = [
    { value: "active",   label: "Ativo",    className: "border-primary/30 text-primary hover:bg-primary/10" },
    { value: "inactive", label: "Inativo",  className: "border-white/10 text-zinc-400 hover:bg-surface-2" },
    { value: "banned",   label: "Banido",   className: "border-danger/30 text-danger hover:bg-danger/10" },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Status de Acesso
      </label>
      <div className="flex gap-2 flex-wrap">
        {options.map(({ value, label, className }) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            disabled={pending || localStatus === value}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
              localStatus === value
                ? value === "active"
                  ? "bg-primary/10 border-primary text-primary"
                  : value === "banned"
                  ? "bg-danger/10 border-danger text-danger"
                  : "bg-zinc-700/50 border-white/20 text-zinc-300"
                : className
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function StudentProfileDrawer({ member, onClose }: Props) {
  const age = member ? calculateAge(member.birth_date) : null;

  return (
    <>
      {/* Backdrop */}
      {member && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface-1 border-l border-white/5 flex flex-col transform transition-transform duration-300 ease-in-out ${
          member ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {member && (
          <>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start gap-4 px-6 py-5 border-b border-white/5 flex-shrink-0">
              {/* Photo */}
              {member.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photo_url}
                  alt={member.full_name}
                  className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-zinc-500">
                  {member.full_name?.charAt(0).toUpperCase() ?? "?"}
                </div>
              )}

              {/* Name / meta */}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">{member.full_name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[member.status] ?? STATUS_STYLES.inactive
                    }`}
                  >
                    {STATUS_LABELS[member.status] ?? member.status}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {PLAN_LABELS[member.plan_type] ?? member.plan_type}
                  </span>
                  {age !== null && (
                    <span className="text-xs text-zinc-500">{age} anos</span>
                  )}
                </div>
                {member.cpf && (
                  <p className="text-xs text-zinc-600 mt-0.5 tabular-nums">
                    CPF: {member.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors flex-shrink-0"
                aria-label="Fechar"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* ── Scrollable body ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">

              {/* Physical data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-2xl px-4 py-4 flex items-center gap-3">
                  <ScaleIcon className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-500">Peso</p>
                    <p className="text-sm font-semibold text-white">
                      {member.weight != null ? `${member.weight} kg` : "—"}
                    </p>
                  </div>
                </div>
                <div className="bg-surface-2 rounded-2xl px-4 py-4 flex items-center gap-3">
                  <ArrowsUpDownIcon className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-500">Altura</p>
                    <p className="text-sm font-semibold text-white">
                      {member.height != null ? `${member.height} cm` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* XP */}
              <div className="bg-surface-2 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500">Pontos de Experiência (XP)</span>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {member.experience_points.toLocaleString("pt-BR")}
                </span>
              </div>

              <div className="h-px bg-white/5" />

              {/* Medical notes */}
              <MedicalNotesBlock memberId={member.id} initial={member.medical_notes} />

              <div className="h-px bg-white/5" />

              {/* Status control */}
              <StatusBlock memberId={member.id} currentStatus={member.status} />

              <div className="h-px bg-white/5" />

              {/* Password reset */}
              <PasswordResetBlock memberId={member.id} />

              {/* Danger zone hint for banned */}
              {member.status === "banned" && (
                <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-2xl">
                  <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">
                    Aluno banido não consegue acessar a plataforma nem a catraca.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
