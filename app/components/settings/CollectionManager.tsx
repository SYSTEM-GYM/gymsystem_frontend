"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  PlusIcon,
  XMarkIcon,
  Bars3Icon,
  TrashIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import {
  createCollection,
  addExerciseToCollection,
  removeExerciseFromCollection,
  reorderCollectionExercises,
  deleteCollection,
} from "@/app/dashboard/settings/workout-actions";
import type { SettingsActionState } from "@/app/dashboard/settings/actions";
import type { Exercise } from "./ExerciseManager";

export type Collection = {
  id: string;
  name: string;
  description: string | null;
  estimated_duration_minutes: number;
  gym_id: string | null;
};

export type CollectionExerciseItem = {
  id: string;
  exercise_id: string;
  sort_order: number;
  exercise: { id: string; title: string };
};

type Props = {
  initialCollections: Collection[];
  collectionExercises: Record<string, CollectionExerciseItem[]>;
  allExercises: Exercise[];
  gyms: { id: string; name: string }[];
};

const INITIAL: SettingsActionState = { status: "idle" };

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 py-3 rounded-full text-sm font-bold bg-primary text-black disabled:opacity-40"
    >
      {pending ? "Salvando..." : "Criar Coleção"}
    </button>
  );
}

function CreateCollectionModal({
  gyms,
  onClose,
}: {
  gyms: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createCollection, INITIAL);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const inputCls =
    "w-full bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary/50";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h3 className="text-base font-bold text-white">Nova Coleção</h3>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <form action={formAction} className="px-6 py-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Nome</label>
              <input name="name" required placeholder="Ex: Treino de Pernas" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Descrição</label>
              <input name="description" placeholder="Opcional" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Filial</label>
              <select name="gym_id" className={inputCls}>
                <option value="">Todas as filiais</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                Duração estimada (min)
              </label>
              <input
                name="estimated_duration_minutes"
                type="number"
                min={15}
                defaultValue={60}
                className={inputCls}
              />
            </div>
            {state.status === "error" && (
              <p className="text-sm text-danger">{state.message}</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-full text-sm bg-surface-2 text-zinc-400">
                Cancelar
              </button>
              <CreateSubmitButton />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function DeleteCollectionModal({
  collection,
  onClose,
  onDeleted,
}: {
  collection: Collection;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCollection(collection.id);
      if (result.ok) {
        onDeleted();
      } else {
        setError(result.message ?? "Erro ao excluir.");
      }
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface-1 border border-white/10 rounded-3xl shadow-2xl p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto">
            <TrashIcon className="w-6 h-6 text-danger" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-white">Excluir Coleção</h3>
            <p className="text-sm text-zinc-500">
              Tem certeza que deseja excluir{" "}
              <span className="text-white font-semibold">{collection.name}</span>?{" "}
              Esta ação não pode ser desfeita.
            </p>
          </div>
          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3 text-center">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-3 rounded-full text-sm font-semibold bg-surface-2 text-zinc-400 hover:text-white border border-white/5 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 py-3 rounded-full text-sm font-bold bg-danger text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isPending ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function CollectionDetail({
  collection,
  items,
  allExercises,
  onUpdate,
  onDeleteRequest,
}: {
  collection: Collection;
  items: CollectionExerciseItem[];
  allExercises: Exercise[];
  onUpdate: () => void;
  onDeleteRequest: (c: Collection) => void;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [addId, setAddId] = useState("");

  useEffect(() => setLocalItems(items), [items]);

  const usedIds = new Set(localItems.map((i) => i.exercise_id));
  const available = allExercises.filter((e) => !usedIds.has(e.id));

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, overIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === overIdx) return;
    const next = [...localItems];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    setLocalItems(next.map((item, i) => ({ ...item, sort_order: i })));
    setDragIdx(overIdx);
  }

  async function persistOrder(next: CollectionExerciseItem[]) {
    startTransition(async () => {
      await reorderCollectionExercises(
        next.map((item, i) => ({ id: item.id, sort_order: i })),
      );
      onUpdate();
    });
  }

  function handleDragEnd() {
    if (dragIdx !== null) persistOrder(localItems);
    setDragIdx(null);
  }

  function handleAdd() {
    if (!addId) return;
    startTransition(async () => {
      const result = await addExerciseToCollection(collection.id, addId, localItems.length);
      if (result.ok) {
        setAddId("");
        onUpdate();
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeExerciseFromCollection(id);
      onUpdate();
    });
  }

  return (
    <div className="border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">{collection.name}</h3>
          {collection.description && (
            <p className="text-xs text-zinc-500 mt-0.5">{collection.description}</p>
          )}
          <p className="text-[10px] text-zinc-600 mt-1">
            ~{collection.estimated_duration_minutes} min · {localItems.length} exercício(s)
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDeleteRequest(collection)}
          title="Excluir coleção"
          className="p-2 rounded-xl text-zinc-600 hover:bg-danger/10 hover:text-danger transition-colors flex-shrink-0"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {localItems.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">Arraste exercícios para cá.</p>
      ) : (
        <ul className="space-y-2">
          {localItems.map((item, idx) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl cursor-grab active:cursor-grabbing"
            >
              <Bars3Icon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
              <span className="flex-1 text-sm text-white">{item.exercise.title}</span>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                disabled={pending}
                className="p-1.5 text-zinc-600 hover:text-danger"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="flex-1 bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
        >
          <option value="">Adicionar exercício...</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.translated_name || e.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!addId || pending}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-black disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CollectionManager({
  initialCollections,
  collectionExercises,
  allExercises,
  gyms,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCollections[0]?.id ?? null,
  );
  const [toDelete, setToDelete] = useState<Collection | null>(null);
  const router = useRouter();

  function handleUpdate() {
    router.refresh();
  }

  function handleDeleted() {
    setToDelete(null);
    // select the first remaining collection
    const remaining = initialCollections.filter((c) => c.id !== toDelete?.id);
    setSelectedId(remaining[0]?.id ?? null);
    router.refresh();
  }

  const selected = initialCollections.find((c) => c.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Coleções de Treino</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Agrupe exercícios e monte fichas reutilizáveis.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-primary text-black"
        >
          <PlusIcon className="w-4 h-4" />
          Nova Coleção
        </button>
      </div>

      {initialCollections.length === 0 ? (
        <div className="p-12 text-center bg-surface-1 border border-dashed border-white/10 rounded-3xl">
          <ClipboardDocumentListIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Nenhuma coleção criada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            {initialCollections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                  selectedId === c.id
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-surface-1 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-[10px] mt-0.5 opacity-70">
                  {(collectionExercises[c.id] ?? []).length} exercícios
                </p>
              </button>
            ))}
          </div>
          <div className="lg:col-span-2">
            {selected && (
              <CollectionDetail
                collection={selected}
                items={collectionExercises[selected.id] ?? []}
                allExercises={allExercises}
                onUpdate={handleUpdate}
                onDeleteRequest={setToDelete}
              />
            )}
          </div>
        </div>
      )}

      {showModal && (
        <CreateCollectionModal gyms={gyms} onClose={() => setShowModal(false)} />
      )}
      {toDelete && (
        <DeleteCollectionModal
          collection={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
