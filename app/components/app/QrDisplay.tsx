"use client";

import QRCode from "react-qr-code";
import {
  BuildingStorefrontIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

type Props = {
  userId: string;
  firstName: string;
  isActive: boolean;
  gymName: string | null;
};

export function QrDisplay({ userId, firstName, isActive, gymName }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-black text-white">Meu Acesso</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Apresente este código na catraca
        </p>
      </div>

      {/* Status banner */}
      {isActive ? (
        <div className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl">
          <CheckCircleIcon className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">Plano Ativo</p>
            <p className="text-xs text-zinc-400">{firstName}, seu acesso está liberado.</p>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center gap-3 px-4 py-3 bg-danger/10 border border-danger/20 rounded-2xl">
          <ExclamationTriangleIcon className="w-5 h-5 text-danger shrink-0" />
          <div>
            <p className="text-sm font-semibold text-danger">Plano Inativo</p>
            <p className="text-xs text-zinc-400">Regularize sua situação na recepção.</p>
          </div>
        </div>
      )}

      {/* QR Code card */}
      <div className={`w-full bg-white rounded-3xl p-6 flex flex-col items-center gap-4 ${!isActive ? "opacity-40" : ""}`}>
        <QRCode
          value={userId}
          size={220}
          bgColor="#ffffff"
          fgColor="#09090b"
          level="M"
        />
        <p className="text-[10px] text-zinc-400 font-mono text-center break-all px-2">
          {userId}
        </p>
      </div>

      {/* Gym info */}
      {gymName ? (
        <div className="w-full flex items-center gap-3 px-4 py-3 bg-surface-1 border border-white/5 rounded-2xl">
          <BuildingStorefrontIcon className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Sua filial</p>
            <p className="text-sm font-semibold text-white">{gymName}</p>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center gap-3 px-4 py-3 bg-surface-1 border border-white/5 rounded-2xl">
          <BuildingStorefrontIcon className="w-4 h-4 text-zinc-600 shrink-0" />
          <p className="text-sm text-zinc-600">Nenhuma filial vinculada ao seu perfil.</p>
        </div>
      )}

      <p className="text-xs text-zinc-600 text-center px-4">
        O QR Code contém o seu ID de membro e é lido diretamente pelo sistema de controle de acesso da academia.
      </p>
    </div>
  );
}
