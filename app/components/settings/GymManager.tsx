"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { PlusIcon, XMarkIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { createGym, type SettingsActionState } from "@/app/dashboard/settings/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

import { GymHoursEditor, type OperatingHour } from "./GymHoursEditor";

export type Gym = {
  id: string;
  name: string;
  city: string;
  created_at: string;
};

type Props = {
  initialGyms: Gym[];
  gymHours: Record<string, OperatingHour[]>;
};

const INITIAL_STATE: SettingsActionState = { status: "idle" };

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateGymModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createGym, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const inputClass =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";
  const labelClass =
    "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div>
              <h3 className="font-bold text-white">Nova Filial</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Adicione uma nova unidade da sua academia.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <form action={formAction} className="px-6 py-6 space-y-5">
            <div>
              <label htmlFor="gym-name" className={labelClass}>
                Nome da Filial
              </label>
              <input
                id="gym-name"
                name="name"
                type="text"
                placeholder="Ex: GYM CONNECT Centro"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="gym-city" className={labelClass}>
                Cidade
              </label>
              <input
                id="gym-city"
                name="city"
                type="text"
                placeholder="Ex: Belo Horizonte"
                required
                className={inputClass}
              />
            </div>

            {state.status === "error" && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">
                {state.message}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GymManager({ initialGyms, gymHours }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div>
          <h2 className="font-bold text-white">Filiais</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gerencie as unidades da sua rede.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform"
        >
          <PlusIcon className="w-4 h-4" />
          Nova Filial
        </button>
      </div>

      {initialGyms.length === 0 ? (
        <div className="p-12 flex flex-col items-center gap-3 text-center">
          <BuildingOffice2Icon className="w-10 h-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">Nenhuma filial cadastrada.</p>
          <p className="text-xs text-zinc-600">
            Crie sua primeira filial para começar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Cidade
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                  Criada em
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {initialGyms.map((gym) => (
                <Fragment key={gym.id}>
                  <tr className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <BuildingOffice2Icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium text-white">{gym.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{gym.city}</td>
                    <td className="px-4 py-4 text-zinc-500 text-xs tabular-nums hidden sm:table-cell">
                      {new Intl.DateTimeFormat("pt-BR").format(new Date(gym.created_at))}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-0">
                      <GymHoursEditor
                        gymId={gym.id}
                        gymName={gym.name}
                        initialHours={gymHours[gym.id] ?? []}
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 border-t border-white/5">
        <span className="text-xs text-zinc-600">
          {initialGyms.length} filial{initialGyms.length !== 1 ? "is" : ""} cadastrada{initialGyms.length !== 1 ? "s" : ""}
        </span>
      </div>

      {showModal && <CreateGymModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
