"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

type Props = {
  onCapture: (file: File) => void;
  onClear: () => void;
};

type CameraState = "idle" | "streaming" | "captured" | "error";

export function WebcamCapture({ onCapture, onClear }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [cameraState,   setCameraState]   = useState<CameraState>("idle");
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);
  const [errorMessage,  setErrorMessage]  = useState<string>("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopStream]);

  async function startCamera() {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("video ref não disponível");

      video.srcObject = stream;

      // Wait for metadata so videoWidth/Height are populated before we allow capture
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          // Explicitly sync the element dimensions to the actual track resolution
          video.width  = video.videoWidth;
          video.height = video.videoHeight;
          console.log("[WebcamCapture] stream ready:", video.videoWidth, "×", video.videoHeight);
          resolve();
        };
      });

      // Explicitly start playback — some browsers don't auto-play even with autoplay attr
      await video.play();
      setCameraState("streaming");
    } catch (err) {
      console.error("[WebcamCapture] startCamera error:", err);
      setErrorMessage(
        "Não foi possível acessar a câmera. Verifique as permissões do navegador."
      );
      setCameraState("error");
    }
  }

  function capturePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;

    console.log("[WebcamCapture] capturePhoto called — video:", video, "canvas:", canvas);
    if (!video || !canvas) {
      console.error("[WebcamCapture] ref(s) missing — cannot capture");
      return;
    }

    // Explicitly match canvas dimensions to the live video track resolution
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log("[WebcamCapture] canvas sized:", canvas.width, "×", canvas.height);

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log("[WebcamCapture] drawImage complete");
    } catch (err) {
      console.error("[WebcamCapture] drawImage error:", err);
      return;
    }

    try {
      canvas.toBlob(
        (blob) => {
          console.log("[WebcamCapture] toBlob result:", blob);
          if (!blob) {
            console.error("[WebcamCapture] toBlob returned null — canvas may be empty or tainted");
            return;
          }

          stopStream();

          const filename = `student-${Date.now()}.jpg`;
          const file = new File([blob], filename, { type: "image/jpeg" });
          console.log("[WebcamCapture] File created:", file.name, file.size, "bytes");

          // Revoke previous preview URL before creating a new one
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });

          setCameraState("captured");
          onCapture(file);
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("[WebcamCapture] toBlob threw:", err);
    }
  }

  function retake() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onClear();
    setCameraState("idle");
    // Short delay so idle state renders (and videoRef is still mounted) before restarting
    setTimeout(startCamera, 50);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Foto do Aluno
      </p>

      {/* Video / Preview area */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-surface-2 border border-white/10 flex items-center justify-center">
        {/* Canvas: always mounted (hidden), used only for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/*
          Video: always mounted so videoRef is valid when startCamera assigns srcObject.
          Conditional rendering would cause the ref to be null at assignment time.
        */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraState === "streaming" ? "block" : "hidden"}`}
        />

        {cameraState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-4">
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

        {cameraState === "captured" && previewUrl && (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Foto capturada"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-primary rounded-full p-1">
              <CheckCircleIcon className="w-5 h-5 text-black" />
            </div>
          </div>
        )}

        {cameraState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-4">
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
