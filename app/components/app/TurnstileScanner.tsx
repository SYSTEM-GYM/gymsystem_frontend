"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { XMarkIcon, CameraIcon } from "@heroicons/react/24/outline";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function TurnstileScanner() {
  const [open, setOpen] = useState(false);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processedRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    setOpen(false);
    setScan({ status: "idle" });
    processedRef.current = false;
  }, [stopCamera]);

  const submitToken = useCallback(async (gymToken: string) => {
    if (processedRef.current) return;
    processedRef.current = true;
    stopCamera();
    setScan({ status: "loading" });

    try {
      const res = await fetch("/api/turnstile/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymToken }),
      });
      const json = await res.json() as { ok: boolean; message?: string };
      if (json.ok) {
        setScan({ status: "success", message: json.message ?? "Acesso liberado! ✅" });
      } else {
        setScan({ status: "error", message: json.message ?? "Acesso negado." });
      }
    } catch {
      setScan({ status: "error", message: "Erro de conexão. Tente novamente." });
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScan({ status: "scanning" });
        tick();
      } catch {
        setScan({ status: "error", message: "Câmera não disponível ou permissão negada." });
      }
    }

    async function tick() {
      if (cancelled || processedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const jsQR = (await import("jsqr")).default;
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        submitToken(code.data);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();
    return () => { cancelled = true; stopCamera(); };
  }, [open, stopCamera, submitToken]);

  return (
    <>
      <button
        onClick={() => { setOpen(true); processedRef.current = false; }}
        className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-primary text-black text-sm font-black rounded-2xl shadow-[0_0_24px_rgba(193,244,41,0.4)] hover:shadow-[0_0_32px_rgba(193,244,41,0.6)] transition-shadow"
        aria-label="Ler catraca"
      >
        <CameraIcon className="w-5 h-5" />
        <span>Ler Catraca</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 gap-6">
          <div className="w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Escanear Catraca</h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-surface-1 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {scan.status === "scanning" && (
              <>
                <p className="text-xs text-zinc-500 text-center">
                  Aponte a câmera para o QR Code da catraca
                </p>
                <div className="relative rounded-2xl overflow-hidden aspect-square bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Scanning frame overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-primary rounded-2xl" />
                  </div>
                </div>
              </>
            )}

            {scan.status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-zinc-400">Validando acesso...</p>
              </div>
            )}

            {scan.status === "success" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl">
                  ✅
                </div>
                <p className="text-base font-black text-white text-center">{scan.message}</p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-primary text-black text-sm font-black rounded-xl"
                >
                  Fechar
                </button>
              </div>
            )}

            {scan.status === "error" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center text-3xl">
                  ❌
                </div>
                <p className="text-sm font-semibold text-danger text-center">{scan.message}</p>
                <button
                  onClick={() => {
                    processedRef.current = false;
                    setOpen(false);
                    setTimeout(() => setOpen(true), 50);
                  }}
                  className="px-6 py-2.5 bg-surface-1 border border-white/10 text-white text-sm font-semibold rounded-xl"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {scan.status === "idle" && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
