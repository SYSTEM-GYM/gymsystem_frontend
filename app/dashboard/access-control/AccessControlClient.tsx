"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftEndOnRectangleIcon,
  ArrowRightStartOnRectangleIcon,
  ClockIcon,
  CpuChipIcon,
  FaceSmileIcon,
  HandRaisedIcon,
  LockOpenIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getStudentAttendance,
  saveHardwareSettings,
  searchStudentsForAttendance,
  unlockTurnstile,
  type AccessAnalytics,
  type HardwareSettings,
  type StudentAttendance,
  type StudentOption,
  type TurnstileMode,
} from "./actions";

const MODE_OPTIONS: { value: TurnstileMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "qr",     label: "QR Code",  desc: "Leitor de QR do app",         icon: <QrCodeIcon className="w-5 h-5" /> },
  { value: "facial", label: "Facial",   desc: "Reconhecimento biométrico",   icon: <FaceSmileIcon className="w-5 h-5" /> },
  { value: "manual", label: "Manual",   desc: "Liberação pela recepção",     icon: <HandRaisedIcon className="w-5 h-5" /> },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDuration(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

// ── Hardware panel ────────────────────────────────────────────────────────────

function HardwarePanel({ settings }: { settings: HardwareSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState<TurnstileMode>(settings.turnstile_mode);
  const [ip, setIp] = useState(settings.ip_address ?? "");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [unlockMsg, setUnlockMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [unlocking, startUnlocking] = useTransition();

  function handleSave() {
    setSaveMsg(null);
    startSaving(async () => {
      const res = await saveHardwareSettings({ turnstileMode: mode, ipAddress: ip });
      setSaveMsg(res.ok ? { ok: true, text: "Configurações salvas." } : { ok: false, text: res.message });
      if (res.ok) router.refresh();
    });
  }

  function handleUnlock() {
    setUnlockMsg(null);
    startUnlocking(async () => {
      const res = await unlockTurnstile();
      setUnlockMsg({ ok: res.ok, text: res.message });
    });
  }

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <CpuChipIcon className="w-4 h-4 text-primary" />
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Hardware Local
        </h2>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value)}
            className={`flex flex-col items-center gap-1.5 px-2 py-3.5 rounded-2xl border text-center transition-all ${
              mode === opt.value
                ? "bg-primary/10 border-primary/50 text-primary"
                : "bg-surface-2 border-white/8 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {opt.icon}
            <span className="text-xs font-bold">{opt.label}</span>
            <span className="text-[9px] text-zinc-600 leading-tight">{opt.desc}</span>
          </button>
        ))}
      </div>

      {/* IP */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          IP do controlador (rede local)
        </label>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.0.50"
          className="w-full bg-surface-2 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      {saveMsg && (
        <p className={`text-xs ${saveMsg.ok ? "text-primary" : "text-danger"}`}>{saveMsg.text}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-2xl text-sm font-bold bg-surface-2 border border-white/10 text-zinc-200 hover:border-primary/40 transition-colors disabled:opacity-40"
      >
        {saving ? "Salvando..." : "Salvar Configurações"}
      </button>

      {/* Manual unlock */}
      <div className="border-t border-white/5 pt-4 space-y-2">
        <button
          type="button"
          onClick={handleUnlock}
          disabled={unlocking}
          className="relative w-full min-h-14 rounded-2xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 overflow-hidden"
        >
          {!unlocking && (
            <span className="absolute inset-0 rounded-2xl bg-primary/40 animate-pulse pointer-events-none" />
          )}
          <LockOpenIcon className="w-5 h-5 relative" />
          <span className="relative">{unlocking ? "Enviando comando..." : "Desbloquear Catraca"}</span>
        </button>
        {unlockMsg && (
          <p className={`text-xs text-center ${unlockMsg.ok ? "text-primary" : "text-danger"}`}>
            {unlockMsg.text}
          </p>
        )}
        <p className="text-[10px] text-zinc-600 text-center">
          Libera uma passagem única via controlador local.
        </p>
      </div>
    </div>
  );
}

// ── Attendance lookup ─────────────────────────────────────────────────────────

function AttendancePanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentOption[]>([]);
  const [selected, setSelected] = useState<StudentOption | null>(null);
  const [attendance, setAttendance] = useState<StudentAttendance | null>(null);
  const [loading, startLoading] = useTransition();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setResults(await searchStudentsForAttendance(q));
  }

  function handlePick(student: StudentOption) {
    setSelected(student);
    setResults([]);
    setQuery("");
    setAttendance(null);
    startLoading(async () => {
      setAttendance(await getStudentAttendance(student.id));
    });
  }

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl p-5 space-y-4">
      <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
        Frequência Individual
      </h2>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar aluno pelo nome..."
          className="w-full pl-11 pr-4 py-3 bg-surface-2 border border-white/8 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
        />
        {results.length > 0 && (
          <div className="absolute z-10 inset-x-0 top-full mt-1 bg-surface-2 border border-white/10 rounded-xl overflow-hidden shadow-xl">
            {results.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handlePick(s)}
                className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-surface-1 hover:text-white transition-colors"
              >
                {s.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">{selected.full_name}</p>
            <button
              type="button"
              onClick={() => { setSelected(null); setAttendance(null); }}
              className="p-1.5 text-zinc-600 hover:text-white transition-colors"
              aria-label="Fechar histórico"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {loading || !attendance ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-2/60 rounded-2xl p-3 text-center">
                  <p className="text-xl font-black text-primary tabular-nums">
                    {attendance.visitsLast30d}
                  </p>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wide">
                    Visitas (30 dias)
                  </p>
                </div>
                <div className="bg-surface-2/60 rounded-2xl p-3 text-center">
                  <p className="text-xl font-black text-white tabular-nums">
                    {fmtDuration(attendance.avgDurationMinutes)}
                  </p>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wide">
                    Permanência média
                  </p>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {attendance.entries.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center py-4">
                    Nenhum acesso registrado nos últimos 30 dias.
                  </p>
                )}
                {attendance.entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-xs bg-surface-2/40 rounded-xl px-3 py-2"
                  >
                    <span className="text-zinc-300">
                      {new Date(e.entry_time).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span className="text-zinc-500 tabular-nums">
                      {fmtDuration(e.duration_minutes)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AccessControlClient({
  settings,
  analytics,
}: {
  settings: HardwareSettings;
  analytics: AccessAnalytics;
}) {
  const stats = [
    {
      label: "Entradas hoje",
      value: String(analytics.entriesToday),
      icon: <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />,
    },
    {
      label: "Dentro agora",
      value: String(analytics.currentlyInside),
      icon: <UsersIcon className="w-4 h-4" />,
    },
    {
      label: "Permanência média",
      value: fmtDuration(analytics.avgStayMinutes),
      icon: <ClockIcon className="w-4 h-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
      {/* Left column: hardware + attendance */}
      <div className="space-y-5">
        <HardwarePanel settings={settings} />
        <AttendancePanel />
      </div>

      {/* Right column: analytics */}
      <div className="space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-1 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-primary">{s.icon}</div>
              <p className="text-2xl font-black text-white tabular-nums mt-2">{s.value}</p>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Peak hours */}
        <div className="bg-surface-1 border border-white/5 rounded-3xl p-5">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
            Horários de Pico (últimos 30 dias)
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.peakHours} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "#ffffff08" }}
                  contentStyle={{
                    background: "#141414",
                    border: "1px solid #ffffff1a",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e4e4e7" }}
                  itemStyle={{ color: "#C1F429" }}
                  formatter={(value) => [`${value} entradas`, "Acessos"]}
                />
                <Bar dataKey="count" fill="#C1F429" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live feed */}
        <div className="bg-surface-1 border border-white/5 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-primary" />
            </span>
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Movimentação Recente
            </h2>
          </div>

          {analytics.liveFeed.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">
              Nenhum acesso registrado ainda. As passagens da catraca aparecem aqui.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {analytics.liveFeed.map((entry) => {
                const inside = !entry.exit_time;
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-2.5">
                    {entry.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.photo_url}
                        alt={entry.student_name}
                        className="w-8 h-8 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                        {entry.student_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{entry.student_name}</p>
                      <p className="text-[10px] text-zinc-600">
                        Entrada {timeAgo(entry.entry_time)}
                        {entry.exit_time && ` · saída ${timeAgo(entry.exit_time)}`}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border shrink-0 ${
                        inside
                          ? "text-primary bg-primary/10 border-primary/20"
                          : "text-zinc-500 bg-surface-2 border-white/8"
                      }`}
                    >
                      {inside ? (
                        <ArrowLeftEndOnRectangleIcon className="w-3 h-3" />
                      ) : (
                        <ArrowRightStartOnRectangleIcon className="w-3 h-3" />
                      )}
                      {inside ? "Na academia" : "Saiu"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
