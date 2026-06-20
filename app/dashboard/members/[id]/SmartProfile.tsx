"use client";

import { useState, useTransition, useRef } from "react";
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
} from "@heroicons/react/24/outline";
import {
  updateMedicalNotes,
  updateMemberStatus,
  resetMemberPassword,
  createPhysicalAssessment,
  type MemberStatus,
} from "@/app/dashboard/members/actions";
import type { StudentDetail, PhysicalAssessment, OccupancyLog } from "./page";

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

function formatCPF(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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
}: {
  student: StudentDetail;
  gymName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<string>(student.status);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const statusOptions: { value: MemberStatus; label: string; activeClass: string; hoverClass: string }[] = [
    { value: "active",   label: "Ativo",   activeClass: "bg-primary/10 border-primary text-primary",         hoverClass: "hover:bg-primary/10 text-primary border-primary/30" },
    { value: "inactive", label: "Inativo", activeClass: "bg-zinc-700/50 border-white/20 text-zinc-300",       hoverClass: "hover:bg-surface-2 text-zinc-400 border-white/10" },
    { value: "banned",   label: "Banido",  activeClass: "bg-danger/10 border-danger text-danger",            hoverClass: "hover:bg-danger/10 text-danger border-danger/30" },
  ];

  function handleStatusChange(status: MemberStatus) {
    startTransition(async () => {
      const res = await updateMemberStatus(student.id, status);
      if (res.ok) setLocalStatus(status);
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

  const infoRows: { label: string; value: string | null }[] = [
    { label: "CPF",       value: student.cpf ? formatCPF(student.cpf) : null },
    { label: "Telefone",  value: student.phone ?? null },
    { label: "Plano",     value: PLAN_LABELS[student.plan_type] ?? student.plan_type },
    { label: "Filial",    value: gymName ?? "—" },
    { label: "Membro desde", value: formatDate(student.created_at) },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Info grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">
          Informações Cadastrais
        </h3>
        <dl className="space-y-3">
          {infoRows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
              <dt className="text-xs text-zinc-500 uppercase tracking-wide flex-shrink-0">{label}</dt>
              <dd className="text-sm text-white text-right">{value ?? <span className="text-zinc-600">—</span>}</dd>
            </div>
          ))}
        </dl>

        {/* XP */}
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

      {/* Status + password */}
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
          {localStatus === "banned" && (
            <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-2xl">
              <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger">Aluno banido não consegue acessar a plataforma nem a catraca.</p>
            </div>
          )}
        </div>

        {/* Password reset */}
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateMedicalNotes(student.id, notes);
      if (res.ok) {
        setSaved(true);
        timerRef.current = setTimeout(() => setSaved(false), 2500);
      } else {
        setError(res.error);
      }
    });
  }

  const anamnesisFields = [
    { label: "Doenças Cardíacas",           key: "cardiac" },
    { label: "Diabetes",                    key: "diabetes" },
    { label: "Hipertensão",                 key: "hypertension" },
    { label: "Problemas Respiratórios",     key: "respiratory" },
    { label: "Lesões Musculares / Ósseas",  key: "musculoskeletal" },
    { label: "Cirurgias Recentes",          key: "surgery" },
    { label: "Uso de Medicamentos",         key: "medication" },
    { label: "Gravidez / Pós-parto",        key: "pregnancy" },
  ];

  return (
    <div className="space-y-8">
      {/* Anamnese checklist — visual structure (decorative, notes is the source of truth) */}
      <div>
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
          Triagem de Saúde (Anamnese)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {anamnesisFields.map(({ label }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-2xl border border-white/5"
            >
              <span className="w-4 h-4 rounded-full border-2 border-white/20 flex-shrink-0" />
              <span className="text-sm text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Use o campo de observações abaixo para registrar condições confirmadas, restrições e detalhes relevantes.
        </p>
      </div>

      {/* Free-form medical notes */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">
          Observações Médicas & Restrições
        </h3>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
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
  // Group logs by date to build a simple calendar-style heatmap
  const byDate = logs.reduce<Record<string, number>>((acc, log) => {
    const d = log.entered_at.split("T")[0];
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
          <p className="text-xs text-zinc-500">Último treino</p>
          <p className="text-sm font-bold text-white mt-1">
            {logs[0] ? formatDate(logs[0].entered_at) : "—"}
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
            {logs.slice(0, 30).map((log) => {
              const durationMs = log.exited_at
                ? new Date(log.exited_at).getTime() - new Date(log.entered_at).getTime()
                : null;
              const durationMin = durationMs ? Math.round(durationMs / 60000) : null;
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between px-4 py-3 bg-surface-2 rounded-2xl border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDaysIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white font-medium">{formatDatetime(log.entered_at)}</p>
                      {log.exited_at && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Saída: {formatDatetime(log.exited_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  {durationMin !== null && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full tabular-nums">
                      {durationMin} min
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Workouts placeholder */}
      <div className="p-6 bg-surface-2 border border-dashed border-white/10 rounded-3xl text-center space-y-2">
        <ClipboardDocumentListIcon className="w-8 h-8 text-zinc-700 mx-auto" />
        <p className="text-sm font-semibold text-zinc-500">Histórico de Treinos</p>
        <p className="text-xs text-zinc-600">Módulo de treinos em construção.</p>
      </div>
    </div>
  );
}

// ── Smart Profile (root) ──────────────────────────────────────────────────────

type Tab = "personal" | "health" | "assessments" | "attendance";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "personal",    label: "Dados Pessoais",    icon: UserCircleIcon },
  { id: "health",      label: "Saúde & Lesões",    icon: HeartIcon },
  { id: "assessments", label: "Avaliação Física",  icon: ScaleIcon },
  { id: "attendance",  label: "Frequência",         icon: CalendarDaysIcon },
];

type Props = {
  student: StudentDetail;
  gymName: string | null;
  assessments: PhysicalAssessment[];
  logs: OccupancyLog[];
  initialTab: string;
};

export function SmartProfile({ student, gymName, assessments, logs, initialTab }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(
    (["personal", "health", "assessments", "attendance"].includes(initialTab)
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
        {activeTab === "personal"    && <TabPersonal    student={student} gymName={gymName} />}
        {activeTab === "health"      && <TabHealth      student={student} />}
        {activeTab === "assessments" && <TabAssessments student={student} assessments={assessments} />}
        {activeTab === "attendance"  && <TabAttendance  logs={logs} />}
      </div>
    </div>
  );
}
