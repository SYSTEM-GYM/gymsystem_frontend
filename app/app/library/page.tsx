import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExerciseList } from "@/app/components/app/ExerciseList";
import type { Exercise } from "@/app/components/app/ExerciseVideoModal";
import { BookOpenIcon } from "@heroicons/react/24/outline";

export const revalidate = 3600;

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercises } = await supabase
    .from("exercises")
    .select(
      "id, title, translated_name, description, instructions, youtube_url, webm_path, video_url, muscle_group",
    )
    .order("title")
    .returns<Exercise[]>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpenIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
            Catálogo
          </p>
          <h1 className="text-xl font-black text-white leading-tight">
            Biblioteca de Exercícios
          </h1>
        </div>
      </div>

      <ExerciseList exercises={exercises ?? []} />
    </div>
  );
}
