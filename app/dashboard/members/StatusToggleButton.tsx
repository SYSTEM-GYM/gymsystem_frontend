"use client";

import { useTransition } from "react";
import { toggleUserStatus, type MemberStatus } from "./actions";

type Props = {
  userId: string;
  currentStatus: string;
};

const STATUS_CYCLE: MemberStatus[] = ["active", "inactive", "banned"];

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  banned: "Banido",
};

export function StatusToggleButton({ userId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const status = (STATUS_CYCLE.includes(currentStatus as MemberStatus)
    ? currentStatus
    : "inactive") as MemberStatus;

  const currentIndex = STATUS_CYCLE.indexOf(status);
  const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

  function handleClick() {
    if (nextStatus === "banned") {
      const ok = window.confirm("Banir este aluno? Ele perderá acesso à plataforma e à catraca.");
      if (!ok) return;
    }

    startTransition(async () => {
      await toggleUserStatus(userId, nextStatus);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={`Status: ${STATUS_LABELS[status]}. Clique para alterar.`}
      className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        status === "active"
          ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
          : status === "inactive"
            ? "bg-zinc-700/30 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/50"
            : "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20"
      }`}
    >
      {isPending ? "…" : STATUS_LABELS[status]}
    </button>
  );
}
