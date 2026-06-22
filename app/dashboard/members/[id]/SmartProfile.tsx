"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UserCircleIcon,
  ScaleIcon,
  ArrowsUpDownIcon,
  HeartIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  PlusIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  FireIcon,
  FilmIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  updateHealthData,
  updateMemberProfile,
  updateMemberStatus,
  resetMemberPassword,
  createPhysicalAssessment,
  searchExercises,
  saveCustomWorkoutSheet,
  type MemberStatus,
  type ExerciseSearchResult,
} from "@/app/dashboard/members/actions";
import { MemberWorkoutPanel } from "@/app/components/members/MemberWorkoutPanel";
import { AuditTimeline, type AuditLogEntry } from "@/app/components/members/AuditTimeline";
import type { StudentDetail, PhysicalAssessment, OccupancyLog, GymOption } from "./page";
import {
  ANAMNESIS_FIELDS,
  PLAN_OPTIONS,
  formatCPF,
  formatPhone,
  parseAnamnesisData,
  type AnamnesisData,
  type AnamnesisKey,
  type PlanType,
} from "@/lib/member-utils";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-primary/10 text-primary border border-primary/20",
  inactive: "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50",
  banned:   "bg-danger/10 text-danger border border-danger/20",
};

const STATUS_LABELS: Record<string, string> = {
  active:   "Ativo",
  inactive: "Inativo",
  banned:   "Banido",
};

const PLAN_LABELS: Record<string, string> = {
  basic:   "Básico",
  premium: "Premium",
  vip:     "VIP",
};

// ── Input class ───────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

const labelCls = "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5";

// ── Tab: Dados Pessoais ───────────────────────────────────────────────────────

function TabPersonal({
  student,
  gymName,
  gyms,
}: {
  student: StudentDetail;
  gymName: string | null;
  gyms: GymOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<string>(student.status);
  const [cpf, setCpf] = useState(student.cpf ? formatCPF(student.cpf) : "");
  const [phone, setPhone] = useState(student.phone ? formatPhone(student.phone) : "");
  const [planType, setPlanType] = useState<PlanType>(
    (student.plan_type as PlanType) || "basic"
  );
  const [homeGymId, setHomeGymId] = useState(student.home_gym_id ?? "");
  const [fieldMsg, setFieldMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const statusOptions: { value: MemberStatus; label: string; activeClass: string; hoverClass: string }[] = [
    { value: "active",   label: "Ativo",   activeClass: "bg-primary/10 border-primary text-primary",         hoverClass: "hover:bg-primary/10 text-primary border-primary/30" },
    { value: "inactive", label: "Inativo", activeClass: "bg-zinc-700/50 border-white/20 text-zinc-300",       hoverClass: "hover:bg-surface-2 text-zinc-400 border-white/10" },
    { value: "banned",   label: "Banido",  activeClass: "bg-danger/10 border-danger text-danger",            hoverClass: "hover:bg-danger/10 text-danger border-danger/30" },
  ];

  function saveProfile(patch: Parameters<typeof updateMemberProfile>[1]) {
    setFieldMsg(null);
    startTransition(async () => {
      const res = await updateMemberProfile(student.id, patch);
      if (res.ok) {
        setFieldMsg({ ok: true, text: "Salvo automaticamente" });
        setTimeout(() => setFieldMsg(null), 2000);
      } else {
        setFieldMsg({ ok: false, text: res.error });
      }
    });
  }

  function handleStatusChange(status: MemberStatus) {
    if (status === "banned" && localStatus !== "banned") {
      const ok = window.confirm(
        "Banir este aluno? Ele perderá acesso à plataforma e à catraca."
      );
      if (!ok) return;
    }

    const previous = localStatus;
    setLocalStatus(status);
    startTransition(async () => {
      const res = await updateMemberStatus(student.id, status, previous);
      if (!res.ok) setLocalStatus(previous);
    });
  }

  function handlePasswordReset() {
    setPwMsg(null);
    if (pwNew.length < 8) { setPwMsg({ ok: false, text: "Mínimo 8 caracteres." }); return; }
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: "As senhas não coincidem." }); return; }
    startTransition(async () => {
      const res = await resetMemberPassword(student.id, pwNew);
      if (res.ok) { setPwMsg({ ok: true, text: "Senha redefinida com sucesso." }); setPwNew(""); setPwConfirm(""); }
      else setPwMsg({ ok: false, text: res.error });
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">
          Informações Cadastrais
        </h3>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>CPF</label>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              onBlur={() => saveProfile({ cpf })}
              placeholder="000.000.000-00"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onBlur={() => saveProfile({ phone: phone || null })}
              placeholder="(31) 99999-9999"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Plano</label>
            <select
              value={planType}
              onChange={(e) => {
                const next = e.target.value as PlanType;
                setPlanType(next);
                saveProfile({ plan_type: next });
              }}
              className={`${inputCls} cursor-pointer`}
            >
              {PLAN_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Filial</label>
            <select
              value={homeGymId}
              onChange={(e) => {
                setHomeGymId(e.target.value);
                saveProfile({ home_gym_id: e.target.value || null });
              }}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">— Selecione —</option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.city ? ` — ${g.city}` : ""}
                </option>
              ))}
            </select>
            {!homeGymId && gymName && (
              <p className="mt-1 text-xs text-zinc-600">Atual: {gymName}</p>
            )}
          </div>
          <div className="flex items-start justify-between gap-4 py-2 border-t border-white/5">
            <dt className="text-xs text-zinc-500 uppercase tracking-wide">Membro desde</dt>
            <dd className="text-sm text-white">{formatDate(student.created_at)}</dd>
          </div>
        </div>

        {fieldMsg && (
          <p className={`text-xs ${fieldMsg.ok ? "text-primary" : "text-danger"}`}>{fieldMsg.text}</p>
        )}

        <div className="flex items-center justify-between px-4 py-3 bg-surface-2 rounded-2xl">
          <div className="flex items-center gap-2">
            <FireIcon className="w-4 h-4 text-primary" />
            <span className="text-xs text-zinc-400">Pontos de Experiência</span>
          </div>
          <span className="text-sm font-bold text-primary tabular-nums">
            {student.experience_points.toLocaleString("pt-BR")} XP
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">
            Status de Acesso
          </h3>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map(({ value, label, activeClass, hoverClass }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleStatusChange(value)}
                disabled={pending || localStatus === value}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
                  localStatus === value ? activeClass : `border-white/10 text-zinc-500 ${hoverClass}`
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(localStatus === "banned" || localStatus === "inactive") && (
            <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-2xl">
              <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger">
                {localStatus === "banned"
                  ? "Aluno banido não consegue acessar a plataforma nem a catraca."
                  : "Aluno inativo não consegue acessar a plataforma nem a catraca."}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">
            Redefinir Senha
          </h3>
          <input
            type="password"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            type="password"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            className={inputCls}
          />
          {pwMsg && (
            <p className={`text-xs ${pwMsg.ok ? "text-primary" : "text-danger"}`}>{pwMsg.text}</p>
          )}
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={pending || !pwNew}
            className="w-full py-2.5 rounded-full text-sm font-semibold bg-surface-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            {pending ? "Salvando..." : "Redefinir Senha"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Saúde & Lesões ───────────────────────────────────────────────────────

function TabHealth({ student }: { student: StudentDetail }) {
  const [notes, setNotes] = useState(student.medical_notes ?? "");
  const [anamnesis, setAnamnesis] = useState<AnamnesisData>(
    () => parseAnamnesisData(student.anamnesis_data)
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anamnesisRef = useRef(anamnesis);
  const notesRef = useRef(notes);

  useEffect(() => {
    anamnesisRef.current = anamnesis;
  }, [anamnesis]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const persistHealth = useCallback(
    (nextAnamnesis: AnamnesisData, nextNotes: string) => {
      setError(null);
      setSaved(false);
      startTransition(async () => {
        const res = await updateHealthData(student.id, {
          anamnesis_data: nextAnamnesis,
          medical_notes: nextNotes,
        });
        if (res.ok) {
          setSaved(true);
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => setSaved(false), 2500);
        } else {
          setError(res.error);
        }
      });
    },
    [student.id, startTransition]
  );

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistHealth(anamnesisRef.current, notesRef.current);
    }, 600);
  }, [persistHealth]);

  function toggleAnamnesis(key: AnamnesisKey) {
    setAnamnesis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      anamnesisRef.current = next;
      scheduleAutoSave();
      return next;
    });
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    notesRef.current = value;
    setSaved(false);
    scheduleAutoSave();
  }

  function handleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    persistHealth(anamnesis, notes);
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
          Triagem de Saúde (Anamnese)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ANAMNESIS_FIELDS.map(({ label, key }) => {
            const checked = !!anamnesis[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleAnamnesis(key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-colors ${
                  checked
                    ? "bg-primary/10 border-primary/30 text-white"
                    : "bg-surface-2 border-white/5 text-zinc-400 hover:border-white/10"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                    checked ? "bg-primary border-primary" : "border-white/20"
                  }`}
                >
                  {checked && <CheckIcon className="w-3 h-3 text-black" />}
                </span>
                <span className="text-sm">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Marque as condições confirmadas. O salvamento é automático; use o botão abaixo se preferir salvar manualmente.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">
          Observações Médicas & Restrições
        </h3>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          onBlur={handleSave}
          rows={7}
          placeholder="Ex: Hérnia de disco L4-L5, evitar exercícios de impacto lombar. Uso de Losartana 50mg. Operação no joelho direito em 2023..."
          className="w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-none font-mono leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <span>
            {error && <p className="text-xs text-danger">{error}</p>}
            {saved && !error && (
              <p className="text-xs text-primary flex items-center gap-1">
                <CheckIcon className="w-3.5 h-3.5" /> Salvo
              </p>
            )}
            {pending && !saved && !error && (
              <p className="text-xs text-zinc-500">Salvando...</p>
            )}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {pending ? "Salvando..." : "Salvar Observações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Avaliação Física ─────────────────────────────────────────────────────

function TabAssessments({
  student,
  assessments,
}: {
  student: StudentDetail;
  assessments: PhysicalAssessment[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPhysicalAssessment(student.id, fd);
      if (res.ok) {
        setShowForm(false);
        formRef.current?.reset();
      } else {
        setFormError(res.error);
      }
    });
  }

  const fieldPairs = [
    { name: "weight",              label: "Peso (kg)",         placeholder: "75,5" },
    { name: "height",              label: "Altura (cm)",        placeholder: "175,0" },
    { name: "body_fat_percentage", label: "% Gordura",          placeholder: "18,5" },
    { name: "lean_mass",           label: "Massa Magra (kg)",   placeholder: "60,0" },
  ];

  return (
    <div className="space-y-6">
      {/* Add assessment */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
          Histórico de Avaliações
        </h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-primary text-black hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Nova Avaliação
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-surface-2 border border-white/10 rounded-3xl p-5 space-y-4"
        >
          <h4 className="text-sm font-semibold text-white">Nova Avaliação Física</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data</label>
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>
            {fieldPairs.map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className={labelCls}>{label}</label>
                <input
                  name={name}
                  type="text"
                  inputMode="decimal"
                  placeholder={placeholder}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div>
            <label className={labelCls}>Observações</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Composição corporal, impressões gerais..."
              className={`${inputCls} resize-none`}
            />
          </div>
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-full text-sm text-zinc-400 border border-white/10 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {pending ? "Salvando..." : "Salvar Avaliação"}
            </button>
          </div>
        </form>
      )}

      {/* History table */}
      {assessments.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <BeakerIcon className="w-10 h-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">Nenhuma avaliação física registrada ainda.</p>
          <p className="text-xs text-zinc-600">Clique em "Nova Avaliação" para começar o histórico.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-surface-1 border border-white/5 rounded-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Data", "Peso", "Altura", "% Gordura", "Massa Magra", "Observações"].map((h) => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assessments.map((a, i) => (
                <tr key={a.id} className={i === 0 ? "bg-primary/5" : "hover:bg-surface-2/30 transition-colors"}>
                  <td className="px-5 py-4 text-white font-medium whitespace-nowrap">
                    {formatDate(a.date)}
                    {i === 0 && (
                      <span className="ml-2 text-[10px] font-bold text-primary uppercase tracking-wider">Última</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-zinc-300 tabular-nums whitespace-nowrap">
                    {a.weight != null ? `${a.weight} kg` : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-300 tabular-nums whitespace-nowrap">
                    {a.height != null ? `${a.height} cm` : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-300 tabular-nums whitespace-nowrap">
                    {a.body_fat_percentage != null ? `${a.body_fat_percentage}%` : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-300 tabular-nums whitespace-nowrap">
                    {a.lean_mass != null ? `${a.lean_mass} kg` : "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-500 max-w-xs truncate">
                    {a.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Frequência ───────────────────────────────────────────────────────────

function TabAttendance({ logs }: { logs: OccupancyLog[] }) {
  const byDate = logs.reduce<Record<string, number>>((acc, log) => {
    const d = log.validated_at.split("T")[0];
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

  const totalThisMonth = Object.entries(byDate).filter(([d]) =>
    d.startsWith(new Date().toISOString().slice(0, 7))
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-surface-2 rounded-2xl px-4 py-4">
          <p className="text-xs text-zinc-500">Check-ins este mês</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{totalThisMonth}</p>
        </div>
        <div className="bg-surface-2 rounded-2xl px-4 py-4">
          <p className="text-xs text-zinc-500">Total de check-ins</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{logs.length}</p>
        </div>
        <div className="bg-surface-2 rounded-2xl px-4 py-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-zinc-500">Último acesso</p>
          <p className="text-sm font-bold text-white mt-1">
            {logs[0] ? formatDate(logs[0].validated_at) : "—"}
          </p>
        </div>
      </div>

      {/* Recent log list */}
      <div>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
          Histórico Recente de Presença
        </h3>
        {logs.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <CalendarDaysIcon className="w-10 h-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhum check-in registrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 30).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between px-4 py-3 bg-surface-2 rounded-2xl border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">{formatDatetime(log.validated_at)}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 capitalize">{log.event_type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Custom Workout Editor ─────────────────────────────────────────────────────

const SESSION_LABELS = ["A", "B", "C", "D", "E", "F"] as const;

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function extractYtId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

type SheetRow = {
  uid: string;
  exercise_id: string;
  exercise_title: string;
  youtube_url: string | null;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  notes: string;
};

type CustomSession = {
  label: string;
  rows: SheetRow[];
};

function ExerciseSearchPopover({
  onSelect,
  onClose,
}: {
  onSelect: (ex: ExerciseSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseSearchResult[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await searchExercises(query);
        if (res.ok) setResults(res.exercises);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-1">
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar exercício pelo nome..."
          className="flex-1 bg-surface-1 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
        />
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-zinc-500 hover:text-white transition-colors flex-shrink-0"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-surface-1 border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto">
          {results.map((ex) => {
            const ytId = extractYtId(ex.youtube_url);
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => { onSelect(ex); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
              >
                {ytId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/default.jpg`}
                    alt={ex.title}
                    className="w-10 h-10 object-cover rounded-lg flex-shrink-0 bg-zinc-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                    <FilmIcon className="w-4 h-4 text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {ex.translated_name || ex.title}
                  </p>
                  {ex.translated_name && (
                    <p className="text-xs text-zinc-600 truncate">{ex.title}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {searching && query.length >= 2 && (
        <p className="text-xs text-zinc-600 px-1 py-2">Buscando...</p>
      )}
      {!searching && query.length >= 2 && results.length === 0 && (
        <p className="text-xs text-zinc-600 px-1 py-2">Nenhum exercício encontrado para &ldquo;{query}&rdquo;.</p>
      )}
    </div>
  );
}

function CustomWorkoutEditor({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [sessions, setSessions] = useState<CustomSession[]>([
    { label: "A", rows: [] },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const activeSession = sessions[activeIdx];

  const cellInput =
    "w-full bg-transparent border-0 text-sm text-white text-center tabular-nums focus:outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/20 rounded-lg px-1 py-1.5 transition-colors min-h-[36px]";

  function addSession() {
    if (sessions.length >= SESSION_LABELS.length) return;
    const nextLabel = SESSION_LABELS[sessions.length];
    setSessions((prev) => [...prev, { label: nextLabel, rows: [] }]);
    setActiveIdx(sessions.length);
  }

  function removeSession(idx: number) {
    if (sessions.length === 1) return;
    setSessions((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.min(prev, sessions.length - 2));
  }

  function updateRow(rowUid: string, patch: Partial<SheetRow>) {
    setSessions((prev) =>
      prev.map((s, i) =>
        i !== activeIdx
          ? s
          : { ...s, rows: s.rows.map((r) => (r.uid === rowUid ? { ...r, ...patch } : r)) },
      ),
    );
  }

  function removeRow(rowUid: string) {
    setSessions((prev) =>
      prev.map((s, i) =>
        i !== activeIdx ? s : { ...s, rows: s.rows.filter((r) => r.uid !== rowUid) },
      ),
    );
  }

  function addExercise(ex: ExerciseSearchResult) {
    const newRow: SheetRow = {
      uid: genId(),
      exercise_id: ex.id,
      exercise_title: ex.translated_name || ex.title,
      youtube_url: ex.youtube_url,
      sets: "3",
      reps: "12",
      weight: "",
      rest: "60",
      notes: "",
    };
    setSessions((prev) =>
      prev.map((s, i) =>
        i !== activeIdx ? s : { ...s, rows: [...s.rows, newRow] },
      ),
    );
  }

  function handleSave() {
    setSaveMsg(null);
    startSave(async () => {
      const payload = sessions
        .filter((s) => s.rows.length > 0)
        .map((s) => ({
          label: s.label,
          exercises: s.rows
            .filter((r) => r.exercise_id)
            .map((r) => ({
              exercise_id: r.exercise_id,
              sets: Math.max(1, parseInt(r.sets) || 3),
              reps: Math.max(1, parseInt(r.reps) || 12),
              weight_kg: r.weight ? parseFloat(r.weight) : null,
              rest_seconds: Math.max(0, parseInt(r.rest) || 60),
              notes: r.notes.trim() || null,
            })),
        }));
      const res = await saveCustomWorkoutSheet(studentId, studentName, payload);
      setSaveMsg(
        res.ok
          ? { ok: true, text: "Ficha salva e atribuída ao aluno com sucesso!" }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <div className="space-y-4 border-b border-white/5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-white">Editor de Ficha Personalizada</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Monte a ficha A/B/C e clique em &ldquo;Salvar&rdquo; para criar e atribuir ao aluno.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-primary text-black hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
        >
          <CheckIcon className="w-3.5 h-3.5" />
          {saving ? "Salvando..." : "Salvar Ficha no Perfil"}
        </button>
      </div>

      {saveMsg && (
        <p className={`text-xs font-medium ${saveMsg.ok ? "text-primary" : "text-danger"}`}>
          {saveMsg.text}
        </p>
      )}

      {/* Session tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sessions.map((s, i) => (
          <div key={s.label} className="relative flex items-center">
            <button
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                activeIdx === i
                  ? "bg-primary text-black border-primary"
                  : "bg-surface-2 text-zinc-400 border-white/10 hover:text-white hover:border-white/20"
              } ${sessions.length > 1 ? "pr-7" : ""}`}
            >
              Sessão {s.label}
              <span
                className={`ml-1.5 text-[10px] ${
                  activeIdx === i ? "text-black/50" : "text-zinc-600"
                }`}
              >
                {s.rows.length}
              </span>
            </button>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={() => removeSession(i)}
                title="Remover sessão"
                className={`absolute right-1.5 p-0.5 rounded transition-colors ${
                  activeIdx === i
                    ? "text-black/40 hover:text-black/70"
                    : "text-zinc-700 hover:text-danger"
                }`}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {sessions.length < SESSION_LABELS.length && (
          <button
            type="button"
            onClick={addSession}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 border border-dashed border-white/15 hover:text-white hover:border-white/30 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Sessão
          </button>
        )}
      </div>

      {/* Spreadsheet */}
      <div className="bg-surface-2/40 border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-surface-2/60">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-8">#</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Exercício</th>
                <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-16 text-center">Séries</th>
                <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-16 text-center">Reps</th>
                <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-24 text-center">Carga (kg)</th>
                <th className="px-2 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-24 text-center">Descanso (s)</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider min-w-[140px]">Observações</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeSession.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-zinc-600">
                    Nenhum exercício nesta sessão. Clique em &ldquo;+ Adicionar Exercício&rdquo; abaixo.
                  </td>
                </tr>
              ) : (
                activeSession.rows.map((row, idx) => {
                  const ytId = extractYtId(row.youtube_url);
                  return (
                    <tr key={row.uid} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-4 py-1.5 text-xs text-zinc-600 tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {ytId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://img.youtube.com/vi/${ytId}/default.jpg`}
                              alt={row.exercise_title}
                              className="w-8 h-8 object-cover rounded-lg flex-shrink-0 bg-zinc-800"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-surface-1 flex items-center justify-center flex-shrink-0">
                              <FilmIcon className="w-3.5 h-3.5 text-zinc-700" />
                            </div>
                          )}
                          <span className="text-sm text-white truncate max-w-[160px]">
                            {row.exercise_title}
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={row.sets}
                          onChange={(e) => updateRow(row.uid, { sets: e.target.value })}
                          className={cellInput}
                          min="1"
                          max="20"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={row.reps}
                          onChange={(e) => updateRow(row.uid, { reps: e.target.value })}
                          className={cellInput}
                          min="1"
                          max="100"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={row.weight}
                          onChange={(e) => updateRow(row.uid, { weight: e.target.value })}
                          placeholder="—"
                          className={`${cellInput} placeholder-zinc-700`}
                          min="0"
                          step="0.5"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={row.rest}
                          onChange={(e) => updateRow(row.uid, { rest: e.target.value })}
                          className={cellInput}
                          min="0"
                          step="5"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateRow(row.uid, { notes: e.target.value })}
                          placeholder="..."
                          className={`${cellInput} text-left text-zinc-400 placeholder-zinc-700`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => removeRow(row.uid)}
                          className="p-1.5 rounded-lg text-zinc-700 hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add exercise */}
        <div className="border-t border-white/8 p-3">
          {showSearch ? (
            <ExerciseSearchPopover
              onSelect={(ex) => {
                addExercise(ex);
                setShowSearch(false);
              }}
              onClose={() => setShowSearch(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 border border-dashed border-white/10 hover:text-white hover:border-white/25 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Adicionar Exercício
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Treinos ──────────────────────────────────────────────────────────────

type WorkoutCollectionExercise = {
  sort_order: number;
  default_sets: number;
  default_reps: number;
  exercise: { id: string; title: string; translated_name: string | null } | null;
};
type WorkoutCollection = {
  id: string;
  name: string;
  description: string | null;
  estimated_duration_minutes: number;
  exercises: WorkoutCollectionExercise[];
};
type WorkoutSchedule = {
  id: string;
  schedule_type: string;
  day_of_week: number | null;
  session_label: string | null;
  created_at: string | null;
  collection: { name: string } | null;
};
type ExecutionLog = {
  id: string;
  logged_at: string;
  weight_kg: number | null;
  reps_done: number | null;
  sets_completed: number | null;
  exercise: { title: string } | null;
};

function TabWorkout({
  studentId,
  studentName,
  collections,
  schedules,
  executionLogs,
  auditLogs,
}: {
  studentId: string;
  studentName: string;
  collections: WorkoutCollection[];
  schedules: WorkoutSchedule[];
  executionLogs: ExecutionLog[];
  auditLogs: AuditLogEntry[];
}) {
  return (
    <div className="space-y-6">
      <CustomWorkoutEditor studentId={studentId} studentName={studentName} />
      <MemberWorkoutPanel
        userId={studentId}
        collections={collections}
        schedules={schedules}
        executionLogs={executionLogs}
      />
      <div className="pt-4 border-t border-white/5">
        <h3 className="text-sm font-bold text-white mb-3">Histórico de Auditoria</h3>
        <AuditTimeline logs={auditLogs} />
      </div>
    </div>
  );
}

// ── Smart Profile (root) ──────────────────────────────────────────────────────

type Tab = "personal" | "health" | "assessments" | "attendance" | "workout";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "personal", label: "Dados Pessoais", icon: UserCircleIcon },
  { id: "health", label: "Saúde & Lesões", icon: HeartIcon },
  { id: "assessments", label: "Avaliação Física", icon: ScaleIcon },
  { id: "attendance", label: "Frequência", icon: CalendarDaysIcon },
  { id: "workout", label: "Treinos", icon: ClipboardDocumentListIcon },
];

type Props = {
  student: StudentDetail;
  gymName: string | null;
  gyms: GymOption[];
  assessments: PhysicalAssessment[];
  logs: OccupancyLog[];
  collections: WorkoutCollection[];
  schedules: WorkoutSchedule[];
  executionLogs: ExecutionLog[];
  auditLogs: AuditLogEntry[];
  initialTab: string;
};

export function SmartProfile({
  student,
  gymName,
  gyms,
  assessments,
  logs,
  collections,
  schedules,
  executionLogs,
  auditLogs,
  initialTab,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(
    (["personal", "health", "assessments", "attendance", "workout"].includes(initialTab)
      ? initialTab
      : "personal") as Tab
  );

  const age = calculateAge(student.birth_date);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/dashboard/members/${student.id}?tab=${tab}`, { scroll: false });
  }

  const lastAssessment = assessments[0] ?? null;

  return (
    <div className="space-y-6">
      {/* ── Hero Header ──────────────────────────────────────────────────────── */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Photo */}
        {student.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={student.photo_url}
            alt={student.full_name}
            className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 ring-2 ring-white/10"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-surface-2 flex items-center justify-center text-3xl font-black text-zinc-500 flex-shrink-0 ring-2 ring-white/10">
            {(student.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white truncate">{student.full_name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                STATUS_STYLES[student.status] ?? STATUS_STYLES.inactive
              }`}
            >
              {STATUS_LABELS[student.status] ?? student.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-sm text-zinc-400">
              {PLAN_LABELS[student.plan_type] ?? student.plan_type}
            </span>
            {age !== null && (
              <span className="text-sm text-zinc-500">{age} anos</span>
            )}
            <span className="text-sm text-zinc-600">
              Membro desde {formatDate(student.created_at)}
            </span>
          </div>
        </div>

        {/* Quick physical stats from latest assessment */}
        {lastAssessment && (
          <div className="flex gap-4 flex-shrink-0">
            {lastAssessment.weight != null && (
              <div className="flex flex-col items-center gap-0.5">
                <ScaleIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-lg font-bold text-white tabular-nums">{lastAssessment.weight}</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-wide">kg</span>
              </div>
            )}
            {lastAssessment.height != null && (
              <div className="flex flex-col items-center gap-0.5">
                <ArrowsUpDownIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-lg font-bold text-white tabular-nums">{lastAssessment.height}</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-wide">cm</span>
              </div>
            )}
            {lastAssessment.body_fat_percentage != null && (
              <div className="flex flex-col items-center gap-0.5">
                <BeakerIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-lg font-bold text-white tabular-nums">{lastAssessment.body_fat_percentage}</span>
                <span className="text-[10px] text-zinc-600 uppercase tracking-wide">% gord.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-surface-1 border border-white/5 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === id
                ? "bg-primary text-black shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl p-6">
        {activeTab === "personal"    && <TabPersonal    student={student} gymName={gymName} gyms={gyms} />}
        {activeTab === "health"      && <TabHealth      student={student} />}
        {activeTab === "assessments" && <TabAssessments student={student} assessments={assessments} />}
        {activeTab === "attendance" && <TabAttendance logs={logs} />}
        {activeTab === "workout" && (
          <TabWorkout
            studentId={student.id}
            studentName={student.full_name}
            collections={collections}
            schedules={schedules}
            executionLogs={executionLogs}
            auditLogs={auditLogs}
          />
        )}
      </div>
    </div>
  );
}
