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

// ── Set admin home gym ────────────────────────────────────────────────────────

export async function setAdminHomeGym(gymId: string): Promise<SettingsActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const authClient = await createClient();
  const { error } = await authClient
    .from("users")
    .update({ home_gym_id: gymId, updated_at: new Date().toISOString() })
    .eq("id", auth.userId);

  if (error) {
    console.error("setAdminHomeGym error:", error);
    return { status: "error", message: "Erro ao selecionar filial." };
  }

  revalidatePath("/", "layout");
  return { status: "success" };
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

const EXERCISE_VIDEOS_BUCKET = "exercise-videos";
const MAX_WEBM_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export async function createExercise(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const videoType = formData.get("video_type") as "youtube" | "webm" | "none" | null;
  const youtubeUrl = (formData.get("youtube_url") as string | null)?.trim() || null;
  const webmFile = formData.get("webm_file") as File | null;

  if (!title) return { status: "error", message: "Título do exercício é obrigatório." };

  if (videoType === "youtube" && youtubeUrl) {
    const isValidYoutube =
      youtubeUrl.startsWith("https://www.youtube.com/") ||
      youtubeUrl.startsWith("https://youtu.be/");
    if (!isValidYoutube) {
      return {
        status: "error",
        message: "URL do YouTube inválida. Use https://www.youtube.com/... ou https://youtu.be/...",
      };
    }
  }

  const admin = createAdminClient();
  let webmPath: string | null = null;

  // Upload WebM to Supabase Storage when a file is provided
  if (videoType === "webm" && webmFile && webmFile.size > 0) {
    if (webmFile.size > MAX_WEBM_SIZE_BYTES) {
      return { status: "error", message: "O arquivo de vídeo não pode ultrapassar 100 MB." };
    }

    if (webmFile.type !== "video/webm") {
      return { status: "error", message: "Apenas arquivos no formato WebM são aceitos." };
    }

    const filename = `${crypto.randomUUID()}.webm`;
    const buffer = Buffer.from(await webmFile.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(EXERCISE_VIDEOS_BUCKET)
      .upload(filename, buffer, {
        contentType: "video/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("createExercise upload error:", uploadError);
      return { status: "error", message: "Erro ao enviar o vídeo. Tente novamente." };
    }

    const { data: urlData } = admin.storage
      .from(EXERCISE_VIDEOS_BUCKET)
      .getPublicUrl(filename);

    webmPath = urlData.publicUrl;
  }

  const { error } = await admin.from("exercises").insert({
    title,
    description,
    youtube_url: videoType === "youtube" ? youtubeUrl : null,
    webm_path: webmPath,
    created_by: auth.userId,
  });

  if (error) {
    console.error("createExercise db error:", error);
    // Clean up the uploaded file if the DB insert failed
    if (webmPath) {
      const filename = webmPath.split("/").pop()!;
      await admin.storage.from(EXERCISE_VIDEOS_BUCKET).remove([filename]);
    }
    return { status: "error", message: "Erro ao criar exercício. Tente novamente." };
  }

  revalidatePath("/dashboard/settings");
  return { status: "success" };
}
