"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "react-qr-code";
import {
  generateAccessPayload,
  type AccessPayload,
} from "@/app/dashboard/actions";
import {
  ArrowPathIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const QR_VALIDITY_SECONDS = 10;

type ComponentStatus = "loading" | "active" | "refreshing" | "blocked" | "error";

export function QRCodeGenerator() {
  const [componentStatus, setComponentStatus] = useState<ComponentStatus>("loading");
  const [qrPayload, setQrPayload] = useState<AccessPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_VALIDITY_SECONDS);

  // Ref prevents the countdown useEffect from capturing a stale fetchToken
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const fetchToken = useCallback(async () => {
    setComponentStatus((prev) =>
      prev === "active" ? "refreshing" : "loading"
    );

    const result = await generateAccessPayload();

    if (!result.ok) {
      setComponentStatus(
        result.reason === "inactive_user" ? "blocked" : "error"
      );
      return;
    }

    setQrPayload(result.payload);
    setSecondsLeft(QR_VALIDITY_SECONDS);
    setComponentStatus("active");
  }, []);

  fetchRef.current = fetchToken;

  // Initial fetch
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Countdown — auto-refetch at zero
  useEffect(() => {
    if (componentStatus !== "active") return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          fetchRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [componentStatus]);

  const progressPercent = (secondsLeft / QR_VALIDITY_SECONDS) * 100;
  const isExpiring = secondsLeft <= 3;
  const isRunning = componentStatus === "active" || componentStatus === "refreshing";

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* ── Header ─────────────────────────────── */}
      <div className="text-center">
        {componentStatus === "blocked" ? (
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <LockClosedIcon className="w-4 h-4 text-danger" />
            <p className="text-xs font-semibold text-danger uppercase tracking-widest">
              Acesso Bloqueado
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ShieldCheckIcon className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">
              Passe de Acesso
            </p>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          {componentStatus === "blocked"
            ? "Consulte a recepção para regularizar sua situação."
            : "Apresente na catraca para liberar a entrada."}
        </p>
      </div>

      {/* ── QR / State area ────────────────────── */}
      <div className="relative">
        {/* Ambient glow — changes color per state */}
        <div
          className={`absolute inset-0 rounded-3xl blur-xl transition-colors duration-700 ${
            componentStatus === "blocked"
              ? "bg-danger/15"
              : isExpiring
                ? "bg-danger/20"
                : "bg-primary/15"
          }`}
        />

        <div className="relative bg-white rounded-3xl p-5 w-52 h-52 flex items-center justify-center shadow-2xl overflow-hidden">

          {/* Loading skeleton */}
          {componentStatus === "loading" && (
            <div className="flex flex-col items-center gap-2">
              <ArrowPathIcon className="w-8 h-8 text-zinc-300 animate-spin" />
              <p className="text-xs text-zinc-400">Gerando...</p>
            </div>
          )}

          {/* Refreshing — dim existing QR + spinner overlay */}
          {componentStatus === "refreshing" && qrPayload && (
            <>
              <QRCode
                value={qrPayload.token}
                size={168}
                bgColor="#ffffff"
                fgColor="#09090B"
                level="H"
                className="opacity-20"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <ArrowPathIcon className="w-8 h-8 text-zinc-400 animate-spin" />
              </div>
            </>
          )}

          {/* Active QR */}
          {componentStatus === "active" && qrPayload && (
            <QRCode
              value={qrPayload.token}
              size={168}
              bgColor="#ffffff"
              fgColor="#09090B"
              level="H"
            />
          )}

          {/* Blocked state — lock icon over red-tinted white card */}
          {componentStatus === "blocked" && (
            <div className="absolute inset-0 bg-danger/5 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
                <LockClosedIcon className="w-7 h-7 text-danger" />
              </div>
              <p className="text-xs font-semibold text-danger leading-snug">
                Acesso Bloqueado.{"\n"}Consulte a recepção.
              </p>
            </div>
          )}

          {/* Generic error */}
          {componentStatus === "error" && (
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <p className="text-xs text-zinc-500 font-medium">
                Não foi possível gerar o passe.
              </p>
              <button
                onClick={fetchToken}
                className="text-xs text-primary underline underline-offset-2"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Countdown bar (only when QR is running) ── */}
      {isRunning && (
        <div className="w-52 space-y-1.5">
          <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                isExpiring ? "bg-danger" : "bg-primary"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p
            className={`text-center text-xs font-medium transition-colors duration-300 ${
              isExpiring ? "text-danger" : "text-zinc-500"
            }`}
          >
            {componentStatus === "refreshing"
              ? "Atualizando..."
              : `Atualiza em ${secondsLeft} segundo${secondsLeft !== 1 ? "s" : ""}`}
          </p>
        </div>
      )}
    </div>
  );
}
