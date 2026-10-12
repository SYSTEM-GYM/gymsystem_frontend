"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "react-qr-code";

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string; expiresAt: number; gymName: string }
  | { status: "error" };

export function DisplayClient({ gymId }: { gymId: string }) {
  const [state, setState] = useState<TokenState>({ status: "loading" });
  const [secondsLeft, setSecondsLeft] = useState(30);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/turnstile/gym-qr?gymId=${gymId}`, {
        cache: "no-store",
      });
      const json = await res.json() as {
        ok: boolean;
        token?: string;
        expiresAt?: number;
        gymName?: string;
      };
      if (json.ok && json.token && json.expiresAt) {
        setState({
          status: "ready",
          token: json.token,
          expiresAt: json.expiresAt,
          gymName: json.gymName ?? "Academia",
        });
        setSecondsLeft(30);
      } else {
        setState({ status: "error" });
      }
    } catch {
      setState({ status: "error" });
    }
  }, [gymId]);

  // Fetch on the next tick, then refresh every 28s (async fetch keeps the
  // setState calls out of the effect body itself)
  useEffect(() => {
    const initial = setTimeout(() => void fetchToken(), 0);
    const interval = setInterval(() => void fetchToken(), 28_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchToken]);

  // Countdown display
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 30 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-base">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-base gap-4">
        <p className="text-danger font-semibold">Erro ao gerar QR Code.</p>
        <button
          onClick={fetchToken}
          className="px-6 py-2 bg-primary text-black font-black rounded-xl"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-8 px-8">
      {/* Header */}
      <div className="text-center space-y-1">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
          Controle de Acesso
        </p>
        <h1 className="text-3xl font-black text-white">{state.gymName}</h1>
        <p className="text-sm text-zinc-400">
          Abra o app CM Gym Connect e escaneie este código para entrar
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-3xl p-8 shadow-[0_0_80px_rgba(193,244,41,0.15)]">
        <QRCode
          value={state.token}
          size={260}
          bgColor="#ffffff"
          fgColor="#09090b"
          level="M"
        />
      </div>

      {/* Countdown ring */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#27272a"
              strokeWidth="4"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#c1f429"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 26}`}
              strokeDashoffset={`${2 * Math.PI * 26 * (1 - secondsLeft / 30)}`}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white tabular-nums">
            {secondsLeft}
          </span>
        </div>
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
          Renovando em {secondsLeft}s
        </p>
      </div>

      {/* Footer */}
      <p className="text-xs text-zinc-700 text-center max-w-xs">
        Cada código expira em 30 segundos por segurança.
        Em caso de problemas, procure a recepção.
      </p>
    </div>
  );
}
