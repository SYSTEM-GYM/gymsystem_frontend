"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  UserCircleIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { updateMemberStatus } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  weight: number | null;
  height: number | null;
  plan_type: string;
  status: string;
  experience_points: number;
  medical_notes: string | null;
  created_at: string;
};

type Props = { members: MemberRow[] };

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Row Action Dropdown ───────────────────────────────────────────────────────

// ── Row Action Dropdown ───────────────────────────────────────────────────────

function ActionDropdown({
  member,
  onStatusChange,
}: {
  member: MemberRow;
  onStatusChange: (status: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isBanned = member.status === "banned";

  function handleBanToggle() {
    setOpen(false);
    const next = isBanned ? "active" : "banned";
    if (next === "banned") {
      const ok = window.confirm("Banir este aluno? Ele perderá acesso à plataforma e à catraca.");
      if (!ok) return;
    }
    onStatusChange(next);
    startTransition(async () => {
      const res = await updateMemberStatus(
        member.id,
        next as "active" | "inactive" | "banned",
        member.status
      );
      if (!res.ok) onStatusChange(member.status);
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={pending}
        className="p-1.5 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors disabled:opacity-40"
        aria-label="Ações"
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface-1 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30">
          <button
            onMouseDown={() => { setOpen(false); router.push(`/dashboard/members/${member.id}`); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-surface-2 hover:text-white transition-colors text-left"
          >
            <UserCircleIcon className="w-4 h-4 flex-shrink-0" />
            Ver Ficha
          </button>

          <div className="h-px bg-white/5 mx-3" />

          <button
            onMouseDown={handleBanToggle}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-danger hover:bg-danger/10 transition-colors text-left"
          >
            <NoSymbolIcon className="w-4 h-4 flex-shrink-0" />
            {isBanned ? "Desbanir" : "Banir Aluno"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Table row (optimistic status) ─────────────────────────────────────────────

function MemberTableRow({ member }: { member: MemberRow }) {
  const router = useRouter();
  const [status, setStatus] = useState(member.status);

  useEffect(() => {
    setStatus(member.status);
  }, [member.status]);

  return (
    <tr
      onClick={() => router.push(`/dashboard/members/${member.id}`)}
      className="hover:bg-surface-2/50 transition-colors group cursor-pointer"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {member.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photo_url}
              alt={member.full_name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-400 group-hover:bg-zinc-700 transition-colors">
              {(member.full_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-white leading-tight">{member.full_name || "—"}</p>
            {member.phone && (
              <p className="text-xs text-zinc-600 mt-0.5">{member.phone}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-4 hidden sm:table-cell">
        <span className="text-zinc-300">
          {PLAN_LABELS[member.plan_type] ?? member.plan_type}
        </span>
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            STATUS_STYLES[status] ?? STATUS_STYLES.inactive
          }`}
        >
          {STATUS_LABELS[status] ?? status}
        </span>
      </td>

      <td className="px-4 py-4 text-right hidden md:table-cell">
        <span className="text-zinc-400 tabular-nums">
          {member.experience_points.toLocaleString("pt-BR")}
        </span>
      </td>

      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
        <ActionDropdown member={{ ...member, status }} onStatusChange={setStatus} />
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MembersTable({ members }: Props) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = query
    ? members.filter(
        (m) =>
          (m.full_name ?? "").toLowerCase().includes(query) ||
          (m.cpf ?? "").replace(/\D/g, "").includes(query.replace(/\D/g, ""))
      )
    : members;

  return (
    <>
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF..."
          className="w-full pl-11 pr-4 py-3 bg-surface-1 border border-white/5 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <MagnifyingGlassIcon className="w-10 h-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">
              {search ? `Nenhum resultado para "${search}".` : "Nenhum aluno matriculado ainda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Aluno
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                    Plano
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                    XP
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((member) => (
                  <MemberTableRow key={member.id} member={member} />
                ))}
              </tbody>
            </table>

            {/* Footer count */}
            <div className="px-6 py-3 border-t border-white/5">
              <span className="text-xs text-zinc-600">
                {filtered.length} de {members.length} aluno{members.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
