"use client";

import { useTransition } from "react";
import { toggleUserStatus } from "./actions";

type Props = {
  userId: string;
  currentStatus: string;
};

export function StatusToggleButton({ userId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const isActive = currentStatus === "active";

  function handleClick() {
    startTransition(async () => {
      await toggleUserStatus(userId, isActive ? "inactive" : "active");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20"
          : "bg-primary text-black hover:scale-105 active:scale-95"
      }`}
    >
      {isPending ? "…" : isActive ? "Bloquear" : "Ativar"}
    </button>
  );
}
