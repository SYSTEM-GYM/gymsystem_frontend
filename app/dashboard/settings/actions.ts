"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SettingsActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

// ── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; message: string }
> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { ok: false, message: "Não autorizado." };

  const { data: profile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Permissão insuficiente." };
  }

  return { ok: true, userId: user.id };
}

// ── Gyms ─────────────────────────────────────────────────────────────────────

export async function createGym(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const name = (formData.get("name") as string).trim();
  const city = (formData.get("city") as string).trim();

  if (!name) return { status: "error", message: "Nome da filial é obrigatório." };
  if (!city) return { status: "error", message: "Cidade é obrigatória." };

  const admin = createAdminClient();
  const { error } = await admin.from("gyms").insert({
    name,
    city,
    owner_id: auth.userId,
  });

  if (error) {
    console.error("createGym error:", error);
    return { status: "error", message: "Erro ao criar filial. Tente novamente." };
  }

  revalidatePath("/dashboard/settings");
  return { status: "success" };
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function createExercise(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const videoType = formData.get("video_type") as "youtube" | "webm" | null;
  const youtubeUrl = (formData.get("youtube_url") as string | null)?.trim() || null;

  if (!title) return { status: "error", message: "Título do exercício é obrigatório." };

  if (videoType === "youtube" && youtubeUrl) {
    const isValidYoutube =
      youtubeUrl.startsWith("https://www.youtube.com/") ||
      youtubeUrl.startsWith("https://youtu.be/");
    if (!isValidYoutube) {
      return { status: "error", message: "URL do YouTube inválida. Use https://www.youtube.com/... ou https://youtu.be/..." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("exercises").insert({
    title,
    description,
    youtube_url: videoType === "youtube" ? youtubeUrl : null,
    webm_path: null, // Supabase Storage upload will be wired in the next phase
    created_by: auth.userId,
  });

  if (error) {
    console.error("createExercise error:", error);
    return { status: "error", message: "Erro ao criar exercício. Tente novamente." };
  }

  revalidatePath("/dashboard/settings");
  return { status: "success" };
}
