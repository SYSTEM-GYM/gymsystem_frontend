"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

type Props = {
  onCapture: (file: File) => void;
  onClear: () => void;
};

type CameraState = "idle" | "streaming" | "captured" | "error";

export function WebcamCapture({ onCapture, onClear }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopStream, previewUrl]);

  async function startCamera() {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraState("streaming");
    } catch {
      setErrorMessage(
        "Não foi possível acessar a câmera. Verifique as permissões do navegador."
      );
      setCameraState("error");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();

        const filename = `student-${Date.now()}.jpg`;
        const file = new File([blob], filename, { type: "image/jpeg" });

        const url = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);

        setCameraState("captured");
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  }

  function retake() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onClear();
    setCameraState("idle");
    startCamera();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Foto do Aluno
      </p>

      {/* Video / Preview area */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-surface-2 border border-white/10 flex items-center justify-center">
        {/* Hidden canvas used only for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {cameraState === "idle" && (
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <CameraIcon className="w-7 h-7 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500">Câmera desligada</p>
            <button
              type="button"
              onClick={startCamera}
              className="px-5 py-2 rounded-full text-sm font-semibold bg-primary text-black hover:scale-105 transition-transform"
            >
              Ligar câmera
            </button>
          </div>
        )}

        {cameraState === "streaming" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {cameraState === "captured" && previewUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Foto capturada"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-primary rounded-full p-1">
              <CheckCircleIcon className="w-5 h-5 text-black" />
            </div>
          </>
        )}

        {cameraState === "error" && (
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <p className="text-sm text-danger">{errorMessage}</p>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-surface-2 text-zinc-300 border border-white/10 hover:bg-zinc-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {cameraState === "streaming" && (
        <button
          type="button"
          onClick={capturePhoto}
          className="w-full py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <CameraIcon className="w-4 h-4 inline mr-2 -mt-0.5" />
          Capturar Foto
        </button>
      )}

      {cameraState === "captured" && (
        <button
          type="button"
          onClick={retake}
          className="w-full py-2.5 rounded-full text-sm font-semibold bg-surface-2 text-zinc-300 border border-white/10 hover:bg-zinc-700 transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4 inline mr-2 -mt-0.5" />
          Tirar Novamente
        </button>
      )}
    </div>
  );
}
