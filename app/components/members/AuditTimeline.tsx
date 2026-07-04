"use client";

import { ClockIcon } from "@heroicons/react/24/outline";

export type AuditLogEntry = {
  id: string;
  action: string;
  resource_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string | null; first_name: string | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  status_change: "Alteração de status",
  access_granted: "Acesso liberado",
  access_denied: "Acesso negado",
};

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actorName(entry: AuditLogEntry): string {
  const a = entry.actor;
  if (!a) return "Sistema";
  return a.first_name ?? a.full_name?.split(" ")[0] ?? "Admin";
}

export function AuditTimeline({ logs }: { logs: AuditLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-zinc-600 text-center py-4">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {logs.map((log) => (
        <li key={log.id} className="flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
            <ClockIcon className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0 pb-3 border-b border-white/5 last:border-0">
            <p className="text-sm text-white">
              <span className="font-semibold">{ACTION_LABELS[log.action] ?? log.action}</span>
              {log.resource_type && (
                <span className="text-zinc-500"> · {log.resource_type}</span>
              )}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {actorName(log)} · {formatDatetime(log.created_at)}
            </p>
            {log.metadata?.reason != null && (
              <p className="text-xs text-zinc-500 mt-1">{String(log.metadata.reason)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
