"use client";

import { useState, useTransition } from "react";
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { updateStudentProfile } from "./actions";

type Props = {
  initialEmail: string;
  initialPhone: string;
};

export function ProfileEditForm({ initialEmail, initialPhone }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = email !== initialEmail || phone !== initialPhone;

  const inputCls =
    "w-full min-h-12 bg-surface-2 border border-white/8 rounded-xl px-4 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await updateStudentProfile({ email, phone });
      setFeedback(result);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-4"
    >
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
        Dados de Contato
      </p>

      <div className="space-y-1.5">
        <label
          htmlFor="profile-email"
          className="flex items-center gap-1.5 text-xs text-zinc-500 uppercase tracking-wide"
        >
          <EnvelopeIcon className="w-3.5 h-3.5" />
          E-mail
        </label>
        <input
          id="profile-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFeedback(null); }}
          placeholder="seu@email.com"
          className={inputCls}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="profile-phone"
          className="flex items-center gap-1.5 text-xs text-zinc-500 uppercase tracking-wide"
        >
          <PhoneIcon className="w-3.5 h-3.5" />
          Telefone
        </label>
        <input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setFeedback(null); }}
          placeholder="(11) 99999-9999"
          className={inputCls}
        />
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 text-xs font-medium rounded-xl px-3 py-2.5 border ${
            feedback.ok
              ? "text-primary bg-primary/10 border-primary/20"
              : "text-danger bg-danger/10 border-danger/20"
          }`}
        >
          {feedback.ok ? (
            <CheckCircleIcon className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !dirty}
        className="w-full min-h-12 rounded-2xl bg-primary text-black font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
      >
        {isPending ? "Salvando..." : "Salvar Alterações"}
      </button>
    </form>
  );
}
