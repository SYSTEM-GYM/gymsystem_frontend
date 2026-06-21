"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { WebcamCapture } from "./WebcamCapture";
import {
  registerStudent,
  type RegisterStudentState,
} from "@/app/dashboard/members/actions";
import {
  PLAN_OPTIONS,
  formatCPF,
  formatPhone,
  type PlanType,
} from "@/lib/member-utils";

export type GymOption = { id: string; name: string; city: string | null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      {pending ? "Matriculando..." : "Matricular Aluno"}
    </button>
  );
}

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

type Props = {
  onClose: () => void;
  gyms: GymOption[];
  defaultGymId: string | null;
};

const INITIAL_STATE: RegisterStudentState = { status: "idle" };

export function StudentForm({ onClose, gyms, defaultGymId }: Props) {
  const [state, formAction] = useActionState(registerStudent, INITIAL_STATE);
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [planType, setPlanType] = useState<PlanType>("basic");
  const [homeGymId, setHomeGymId] = useState(defaultGymId ?? "");
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const age = calculateAge(birthDate);

  useEffect(() => {
    if (!photoInputRef.current) return;
    const dt = new DataTransfer();
    if (capturedPhoto) dt.items.add(capturedPhoto);
    photoInputRef.current.files = dt.files;
  }, [capturedPhoto]);

  useEffect(() => {
    if (state.status !== "success") return;
    const t = setTimeout(onClose, 1400);
    return () => clearTimeout(t);
  }, [state.status, onClose]);

  const inputClass =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelClass =
    "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2";
  const sectionHeadClass =
    "text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2";

  return (
    <form action={formAction} className="flex flex-col flex-1 min-h-0">
      <input ref={photoInputRef} type="file" name="photo_file" accept="image/jpeg" className="hidden" aria-hidden />
      <input type="hidden" name="plan_type" value={planType} />
      <input type="hidden" name="home_gym_id" value={homeGymId} />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">
        <section className="space-y-4">
          <h3 className={sectionHeadClass}>Dados Pessoais</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-first-name" className={labelClass}>Nome *</label>
              <input id="sf-first-name" name="first_name" type="text" placeholder="João" autoComplete="given-name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="sf-last-name" className={labelClass}>Sobrenome *</label>
              <input id="sf-last-name" name="last_name" type="text" placeholder="Silva" autoComplete="family-name" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-birth-date" className={labelClass}>Data de Nascimento</label>
              <input
                id="sf-birth-date"
                name="birth_date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
            <div className="flex flex-col justify-end">
              {age !== null ? (
                <div className="flex items-end gap-1 px-4 py-3 bg-surface-2 border border-white/10 rounded-2xl">
                  <span className="text-2xl font-bold text-primary tabular-nums leading-none">{age}</span>
                  <span className="text-sm text-zinc-500 mb-0.5">anos</span>
                </div>
              ) : (
                <div className="px-4 py-3 bg-surface-2 border border-white/10 rounded-2xl">
                  <span className="text-sm text-zinc-600">Idade calculada</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-cpf" className={labelClass}>CPF *</label>
              <input
                id="sf-cpf"
                name="cpf"
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="sf-phone" className={labelClass}>
                Telefone <span className="text-zinc-600 normal-case font-normal">(opcional)</span>
              </label>
              <input
                id="sf-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(31) 99999-9999"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={sectionHeadClass}>Plano e Filial</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-plan" className={labelClass}>Plano *</label>
              <select
                id="sf-plan"
                value={planType}
                onChange={(e) => setPlanType(e.target.value as PlanType)}
                className={`${inputClass} cursor-pointer`}
              >
                {PLAN_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sf-gym" className={labelClass}>Filial *</label>
              <select
                id="sf-gym"
                value={homeGymId}
                onChange={(e) => setHomeGymId(e.target.value)}
                className={`${inputClass} cursor-pointer`}
                required
              >
                <option value="">Selecione a filial</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.city ? ` — ${g.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={sectionHeadClass}>Dados Físicos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-weight" className={labelClass}>Peso (kg)</label>
              <input id="sf-weight" name="weight" type="text" inputMode="decimal" placeholder="75,0" className={inputClass} />
            </div>
            <div>
              <label htmlFor="sf-height" className={labelClass}>Altura (cm)</label>
              <input id="sf-height" name="height" type="text" inputMode="decimal" placeholder="175,0" className={inputClass} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={sectionHeadClass}>Acesso à Plataforma</h3>
          <div>
            <label htmlFor="sf-email" className={labelClass}>E-mail *</label>
            <input id="sf-email" name="email" type="email" placeholder="joao@email.com" autoComplete="email" className={inputClass} />
          </div>
          <div>
            <label htmlFor="sf-temp-password" className={labelClass}>Senha Provisória *</label>
            <input id="sf-temp-password" name="temp_password" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" className={inputClass} />
            <p className="mt-1.5 text-xs text-zinc-600">O aluno poderá alterar após o primeiro acesso.</p>
          </div>
        </section>

        <section>
          <WebcamCapture onCapture={(file) => setCapturedPhoto(file)} onClear={() => setCapturedPhoto(null)} />
          {!capturedPhoto && (
            <p className="mt-2 text-xs text-zinc-600">Opcional, mas recomendada para reconhecimento facial.</p>
          )}
        </section>

        {state.status === "error" && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">
            {state.message}
          </div>
        )}
        {state.status === "success" && (
          <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
            ✓ {state.studentName} matriculado com sucesso!
          </div>
        )}
      </div>

      <div className="flex gap-3 px-6 py-5 border-t border-white/5 flex-shrink-0 bg-surface-1">
        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors">
          Cancelar
        </button>
        <SubmitButton />
      </div>
    </form>
  );
}
