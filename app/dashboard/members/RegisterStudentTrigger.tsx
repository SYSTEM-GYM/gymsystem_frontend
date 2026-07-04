"use client";

import { useState } from "react";
import { UserPlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { StudentForm, type GymOption } from "@/app/components/students/StudentForm";

type Props = {
  gyms: GymOption[];
  defaultGymId: string | null;
};

export function RegisterStudentTrigger({ gyms, defaultGymId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-transform shrink-0"
      >
        <UserPlusIcon className="w-4 h-4" />
        Matricular Aluno
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-surface-1 border-l border-white/5 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div>
            <h2 className="font-bold text-white">Matricular Aluno</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Preencha os dados e capture a foto do aluno.</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-xl text-zinc-500 hover:bg-surface-2 hover:text-white transition-colors" aria-label="Fechar">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {open && <StudentForm onClose={() => setOpen(false)} gyms={gyms} defaultGymId={defaultGymId} />}
      </aside>
    </>
  );
}
