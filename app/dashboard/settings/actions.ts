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

export async function deleteExercise(id: string): Promise<SettingsActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.message };

  const admin = createAdminClient();

  const { data: exercise } = await admin
    .from("exercises")
    .select("webm_path")
    .eq("id", id)
    .single();

  const { error } = await admin.from("exercises").delete().eq("id", id);

  if (error) {
    console.error("deleteExercise db error:", error);
    return { status: "error", message: "Erro ao excluir exercício." };
  }

  if (exercise?.webm_path) {
    const filename = exercise.webm_path.split("/").pop();
    if (filename) {
      await admin.storage.from(EXERCISE_VIDEOS_BUCKET).remove([filename]);
    }
  }

  revalidatePath("/dashboard/settings");
  return { status: "success" };
}

// ── Seed default exercises ────────────────────────────────────────────────────

const DEFAULT_EXERCISES = [
  // Peito
  { title: "Bench Press", translated_name: "Supino Reto", muscle_group: "chest", description: "Exercício fundamental para desenvolvimento do peitoral maior. Deite no banco, segure a barra na largura dos ombros e empurre verticalmente.", youtube_url: "https://www.youtube.com/watch?v=vcBig73ojpE" },
  { title: "Incline Bench Press", translated_name: "Supino Inclinado", muscle_group: "chest", description: "Variação do supino com banco inclinado a 30–45°, enfatizando a porção superior do peitoral.", youtube_url: "https://www.youtube.com/watch?v=DbFgADa2PL8" },
  { title: "Dumbbell Fly", translated_name: "Crucifixo com Halteres", muscle_group: "chest", description: "Movimento de abertura com halteres no banco plano, isolando o peitoral em toda a amplitude de movimento.", youtube_url: null },
  { title: "Cable Crossover", translated_name: "Crossover no Cabo", muscle_group: "chest", description: "Exercício no cabo cruzado que trabalha o peitoral com tensão constante durante todo o movimento.", youtube_url: null },
  // Costas
  { title: "Lat Pulldown", translated_name: "Puxada Frontal", muscle_group: "back", description: "Puxada na polia alta à frente do rosto, trabalhando o grande dorsal e o bíceps. Ótimo para construir largura nas costas.", youtube_url: "https://www.youtube.com/watch?v=CAwf7n6Luuc" },
  { title: "Bent-Over Row", translated_name: "Remada Curvada", muscle_group: "back", description: "Remada com o tronco inclinado à frente usando barra ou halteres. Trabalha latíssimo, trapézio e romboides.", youtube_url: "https://www.youtube.com/watch?v=FWJR5Ve8bnQ" },
  { title: "Single-Arm Dumbbell Row", translated_name: "Remada Unilateral", muscle_group: "back", description: "Remada com um haltere, apoiando joelho e mão no banco. Excelente para correção de assimetrias nas costas.", youtube_url: null },
  { title: "Pull-Up", translated_name: "Barra Fixa", muscle_group: "back", description: "Exercício de peso corporal na barra fixa. Um dos melhores movimentos compostos para desenvolvimento das costas.", youtube_url: "https://www.youtube.com/watch?v=eGo4IYlbE5g" },
  { title: "Seated Cable Row", translated_name: "Remada Baixa no Cabo", muscle_group: "back", description: "Remada sentado no cabo com pegada neutra, trabalhando o meio das costas, romboides e bíceps.", youtube_url: null },
  { title: "Deadlift", translated_name: "Levantamento Terra", muscle_group: "back", description: "O exercício mais completo da academia. Trabalha costas, glúteos, isquiotibiais, trapézio e core. Técnica é essencial.", youtube_url: "https://www.youtube.com/watch?v=op9kVnSso6Q" },
  // Pernas
  { title: "Back Squat", translated_name: "Agachamento Livre", muscle_group: "legs", description: "O rei dos exercícios. Agachamento com barra nas costas, trabalhando quadríceps, isquiotibiais, glúteos e core.", youtube_url: "https://www.youtube.com/watch?v=U3HlEF_E9fo" },
  { title: "Leg Press", translated_name: "Leg Press 45°", muscle_group: "legs", description: "Pressão de pernas na máquina a 45 graus. Permite carga elevada com menor estresse na coluna.", youtube_url: "https://www.youtube.com/watch?v=IZxyjW7MPJQ" },
  { title: "Leg Extension", translated_name: "Cadeira Extensora", muscle_group: "legs", description: "Isolamento do quadríceps na cadeira extensora. Complemento ideal para agachamentos.", youtube_url: null },
  { title: "Leg Curl", translated_name: "Mesa Flexora", muscle_group: "legs", description: "Isolamento dos isquiotibiais na mesa flexora. Essencial para equilíbrio muscular entre anterior e posterior da coxa.", youtube_url: null },
  { title: "Standing Calf Raise", translated_name: "Panturrilha em Pé", muscle_group: "legs", description: "Elevação nas pontas dos pés para trabalhar gastrocnêmio e sóleo. Pode ser realizado com barra, halteres ou máquina.", youtube_url: null },
  { title: "Lunge", translated_name: "Avanço (Afundo)", muscle_group: "legs", description: "Exercício unilateral que trabalha quadríceps, glúteos e melhora equilíbrio. Pode ser feito com peso corporal, halteres ou barra.", youtube_url: null },
  { title: "Hack Squat", translated_name: "Agachamento Hack", muscle_group: "legs", description: "Variação do agachamento na máquina hack, com grande ênfase nos quadríceps e menor estresse na lombar.", youtube_url: null },
  // Ombros
  { title: "Dumbbell Shoulder Press", translated_name: "Desenvolvimento com Halteres", muscle_group: "shoulders", description: "Desenvolvimento dos ombros com halteres, trabalhando todas as porções do deltoide e o tríceps.", youtube_url: "https://www.youtube.com/watch?v=qEwKCR5JCog" },
  { title: "Lateral Raise", translated_name: "Elevação Lateral", muscle_group: "shoulders", description: "Isolamento do deltoide lateral. Fundamental para criar a largura dos ombros. Realize com controle total.", youtube_url: null },
  { title: "Front Raise", translated_name: "Elevação Frontal", muscle_group: "shoulders", description: "Isolamento do deltoide anterior com halteres ou barra. Complementa o trabalho de empurrar.", youtube_url: null },
  { title: "Arnold Press", translated_name: "Desenvolvimento Arnold", muscle_group: "shoulders", description: "Variação criada por Arnold Schwarzenegger. Combina rotação do punho para ativar mais porções do deltoide.", youtube_url: null },
  { title: "Reverse Fly", translated_name: "Crucifixo Inverso (Deltóide Posterior)", muscle_group: "shoulders", description: "Exercício para o deltoide posterior, romboides e trapézio médio. Corrige postura e equilibra o trabalho de empurrar.", youtube_url: null },
  // Bíceps
  { title: "Barbell Curl", translated_name: "Rosca Direta com Barra", muscle_group: "biceps", description: "Exercício básico para bíceps com barra reta ou EZ. Permite carga elevada para hipertrofia máxima.", youtube_url: "https://www.youtube.com/watch?v=ykJmrZ5v0Oo" },
  { title: "Alternating Dumbbell Curl", translated_name: "Rosca Alternada com Halteres", muscle_group: "biceps", description: "Rosca com halteres de forma alternada, permitindo supinação do punho e maior ativação do bíceps.", youtube_url: null },
  { title: "Hammer Curl", translated_name: "Rosca Martelo", muscle_group: "biceps", description: "Rosca com pegada neutra que trabalha o braquial e braquiorradial além do bíceps.", youtube_url: null },
  { title: "Preacher Curl", translated_name: "Rosca Scott", muscle_group: "biceps", description: "Rosca no banco scott que elimina compensações do ombro, isolando completamente o bíceps.", youtube_url: null },
  // Tríceps
  { title: "Skull Crusher", translated_name: "Tríceps Testa", muscle_group: "triceps", description: "Extensão de cotovelo deitado com barra EZ ou halteres, trabalhando todas as cabeças do tríceps.", youtube_url: null },
  { title: "Cable Triceps Pushdown", translated_name: "Tríceps Corda no Cabo", muscle_group: "triceps", description: "Extensão de cotovelo com cabo e corda. Excelente para isolamento do tríceps com tensão constante.", youtube_url: null },
  { title: "Dips", translated_name: "Mergulho nas Barras Paralelas", muscle_group: "triceps", description: "Exercício composto de peso corporal para tríceps e peitoral inferior. Adicione peso quando dominar o próprio corpo.", youtube_url: null },
  // Glúteos
  { title: "Hip Thrust", translated_name: "Elevação de Quadril (Hip Thrust)", muscle_group: "glutes", description: "Melhor exercício para ativação dos glúteos. Apoie os ombros no banco, coloque a barra no quadril e empurre para cima.", youtube_url: "https://www.youtube.com/watch?v=SEdqd1n0cvg" },
  { title: "Romanian Deadlift", translated_name: "Stiff (Levantamento Terra Romeno)", muscle_group: "glutes", description: "Ênfase nos isquiotibiais e glúteos com o quadril empurrando para trás. Essencial para desenvolvimento posterior.", youtube_url: null },
  { title: "Sumo Squat", translated_name: "Agachamento Sumô", muscle_group: "glutes", description: "Agachamento com abertura ampla dos pés, maior ativação de glúteos e adutores.", youtube_url: null },
  // Core
  { title: "Plank", translated_name: "Prancha Isométrica", muscle_group: "core", description: "Exercício isométrico fundamental para o core. Mantenha o corpo alinhado da cabeça aos calcanhares.", youtube_url: null },
  { title: "Crunch", translated_name: "Abdominal Crunch", muscle_group: "core", description: "Exercício clássico para o reto abdominal. Contraia os abdominais sem puxar o pescoço.", youtube_url: null },
  { title: "Russian Twist", translated_name: "Rotação Russa", muscle_group: "core", description: "Exercício rotacional para os oblíquos. Pode ser realizado com peso corporal ou com anilha ou kettlebell.", youtube_url: null },
  { title: "Hanging Leg Raise", translated_name: "Elevação de Pernas na Barra", muscle_group: "core", description: "Exercício avançado para abdômen inferior. Pendurado na barra, eleve as pernas até a horizontal com controle.", youtube_url: null },
] as const;

export async function seedDefaultExercises(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.message };

  const admin = createAdminClient();

  const rows = DEFAULT_EXERCISES.map((ex) => ({
    title: ex.title,
    translated_name: ex.translated_name,
    muscle_group: ex.muscle_group,
    description: ex.description,
    youtube_url: ex.youtube_url,
    created_by: auth.userId,
  }));

  const { error } = await admin.from("exercises").insert(rows);

  if (error) {
    console.error("seedDefaultExercises error:", error);
    return { ok: false, error: "Erro ao popular exercícios. Verifique o console." };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, count: rows.length };
}
