"use client";

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Voltar",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl shadow-2xl p-5 space-y-4">
        <p id="confirm-dialog-title" className="font-bold text-white">
          {title}
        </p>
        <p className="text-sm text-zinc-400">{message}</p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 min-h-12 rounded-2xl bg-surface-2 text-zinc-300 font-bold text-sm active:scale-95 transition-transform disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`flex-1 min-h-12 rounded-2xl font-black text-sm active:scale-95 transition-transform disabled:opacity-40 ${
              destructive ? "bg-danger text-black" : "bg-primary text-black"
            }`}
          >
            {pending ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
