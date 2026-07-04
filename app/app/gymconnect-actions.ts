"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CollectionExerciseRow } from "@/lib/workout-utils";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

// ── Squad CRUD ────────────────────────────────────────────────────────────────

export async function createSquad(input: {
  name: string;
  description: string | null;
}): Promise<ActionResult & { squadId?: string }> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Nome do squad é obrigatório." };

  const supabase = await createClient();

  const { data: squad, error: squadError } = await supabase
    .from("gymconnect_squads")
    .insert({ name, description: input.description || null, created_by: user.id })
    .select("id")
    .single();

  if (squadError || !squad) {
    console.error("createSquad:", squadError);
    return { ok: false, message: "Erro ao criar squad." };
  }

  await supabase
    .from("gymconnect_squad_members")
    .insert({ squad_id: squad.id, student_id: user.id });

  revalidatePath("/app/gymconnect");
  return { ok: true, squadId: squad.id };
}

export async function joinSquad(inviteCode: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const code = inviteCode.trim().toUpperCase();
  if (!code) return { ok: false, message: "Código inválido." };

  const supabase = await createClient();

  const { data: squad } = await supabase
    .from("gymconnect_squads")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  if (!squad) return { ok: false, message: "Nenhum squad encontrado com este código." };

  const { error } = await supabase
    .from("gymconnect_squad_members")
    .insert({ squad_id: squad.id, student_id: user.id });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Você já faz parte deste squad." };
    console.error("joinSquad:", error);
    return { ok: false, message: "Erro ao entrar no squad." };
  }

  revalidatePath("/app/gymconnect");
  return { ok: true };
}

export async function leaveSquad(squadId: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("gymconnect_squad_members")
    .delete()
    .eq("squad_id", squadId)
    .eq("student_id", user.id);

  if (error) {
    console.error("leaveSquad:", error);
    return { ok: false, message: "Erro ao sair do squad." };
  }

  revalidatePath("/app/gymconnect");
  return { ok: true };
}

// ── Challenges ────────────────────────────────────────────────────────────────

export type ChallengeType = "frequency" | "volume" | "max_weight";

export async function createChallenge(input: {
  squadId: string;
  title: string;
  description: string | null;
  challengeType: ChallengeType;
  targetValue: number;
  targetExerciseId: string | null;
  endDate: string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const supabase = await createClient();
  const { error } = await supabase.from("squad_challenges").insert({
    squad_id: input.squadId,
    title: input.title.trim(),
    description: input.description || null,
    challenge_type: input.challengeType,
    target_value: input.targetValue,
    target_exercise_id: input.targetExerciseId || null,
    end_date: new Date(input.endDate).toISOString(),
    created_by: user.id,
  });

  if (error) {
    console.error("createChallenge:", error);
    if (error.code === "42501") return { ok: false, message: "Apenas o criador do squad pode criar desafios." };
    return { ok: false, message: "Erro ao criar desafio." };
  }

  revalidatePath(`/app/gymconnect/${input.squadId}`);
  return { ok: true };
}

export async function joinChallenge(
  challengeId: string,
  squadId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  // RLS (challenge_participants_join) verifies squad membership
  const supabase = await createClient();
  const { error } = await supabase
    .from("challenge_participants")
    .insert({ challenge_id: challengeId, student_id: user.id });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Você já está participando deste desafio." };
    if (error.code === "42501") return { ok: false, message: "Você precisa ser membro do squad para participar." };
    console.error("joinChallenge:", error);
    return { ok: false, message: "Erro ao entrar no desafio." };
  }

  revalidatePath(`/app/gymconnect/${squadId}`);
  return { ok: true };
}

const PROOF_MAX_BYTES = 8 * 1024 * 1024;
const PROOF_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadChallengeProof(
  formData: FormData,
): Promise<ActionResult & { proofUrl?: string }> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const challengeId = formData.get("challengeId");
  const squadId = formData.get("squadId");
  const file = formData.get("photo");

  if (typeof challengeId !== "string" || typeof squadId !== "string" || !(file instanceof File)) {
    return { ok: false, message: "Envio inválido." };
  }

  const ext = PROOF_MIME_EXT[file.type];
  if (!ext) return { ok: false, message: "Formato não suportado. Use JPG, PNG ou WebP." };
  if (file.size === 0) return { ok: false, message: "Arquivo vazio." };
  if (file.size > PROOF_MAX_BYTES) return { ok: false, message: "Foto muito grande (máx. 8 MB)." };

  const supabase = await createClient();

  // Must already be a participant (opt-in first, proof later)
  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!participant) {
    return { ok: false, message: "Entre no desafio antes de enviar a foto." };
  }

  // Path satisfies the {user_id}/ folder RLS rule on the bucket
  const path = `${user.id}/${challengeId}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("challenge-proofs")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("uploadChallengeProof storage:", uploadError);
    return { ok: false, message: "Erro ao enviar a foto. Tente novamente." };
  }

  const { data: pub } = admin.storage.from("challenge-proofs").getPublicUrl(path);
  const proofUrl = pub.publicUrl;

  const { error: updateError } = await supabase
    .from("challenge_participants")
    .update({ proof_photo_url: proofUrl, proof_uploaded_at: new Date().toISOString() })
    .eq("id", participant.id);

  if (updateError) {
    console.error("uploadChallengeProof update:", updateError);
    return { ok: false, message: "Foto enviada, mas não foi possível registrá-la." };
  }

  revalidatePath(`/app/gymconnect/${squadId}`);
  return { ok: true, proofUrl };
}

// ── Shared Workouts ───────────────────────────────────────────────────────────

export async function shareWorkout(input: {
  squadId: string;
  collectionId: string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const supabase = await createClient();
  const { error } = await supabase.from("squad_shared_workouts").insert({
    squad_id: input.squadId,
    collection_id: input.collectionId,
    shared_by: user.id,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Este treino já foi compartilhado neste squad." };
    console.error("shareWorkout:", error);
    return { ok: false, message: "Erro ao compartilhar treino." };
  }

  revalidatePath(`/app/gymconnect/${input.squadId}`);
  return { ok: true };
}

export async function removeSharedWorkout(sharedWorkoutId: string, squadId: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("squad_shared_workouts")
    .delete()
    .eq("id", sharedWorkoutId);

  if (error) {
    console.error("removeSharedWorkout:", error);
    return { ok: false, message: "Erro ao remover treino." };
  }

  revalidatePath(`/app/gymconnect/${squadId}`);
  return { ok: true };
}

// ── Picker helpers (called from client modals) ────────────────────────────────

export async function getExercisesForPicker(): Promise<{ id: string; title: string; translated_name: string | null }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("exercises")
    .select("id, title, translated_name")
    .order("translated_name", { ascending: true, nullsFirst: false })
    .limit(100);
  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    translated_name: (e as { translated_name?: string | null }).translated_name ?? null,
  }));
}

export async function getMyCollectionsForSharing(): Promise<{ id: string; name: string }[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data: schedules } = await admin
    .from("workout_schedules")
    .select("collection_id")
    .eq("user_id", user.id);

  if (!schedules || schedules.length === 0) {
    // Fallback: return all collections
    const { data: all } = await admin
      .from("exercise_collections")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(30);
    return (all ?? []).map((c) => ({ id: c.id, name: c.name }));
  }

  const collectionIds = [...new Set(schedules.map((s) => s.collection_id))];
  const { data: collections } = await admin
    .from("exercise_collections")
    .select("id, name")
    .in("id", collectionIds)
    .order("name", { ascending: true });

  return (collections ?? []).map((c) => ({ id: c.id, name: c.name }));
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export type SquadWithMeta = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  member_count: number;
};

export async function getMySquads(userId: string): Promise<SquadWithMeta[]> {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("gymconnect_squad_members")
    .select("squad_id")
    .eq("student_id", userId);

  if (!memberships || memberships.length === 0) return [];

  const squadIds = memberships.map((m) => m.squad_id);

  const { data: squads } = await admin
    .from("gymconnect_squads")
    .select("id, name, description, invite_code, created_by, created_at")
    .in("id", squadIds)
    .order("created_at", { ascending: false });

  if (!squads) return [];

  const { data: allMembers } = await admin
    .from("gymconnect_squad_members")
    .select("squad_id")
    .in("squad_id", squadIds);

  const countMap: Record<string, number> = {};
  for (const m of allMembers ?? []) {
    countMap[m.squad_id] = (countMap[m.squad_id] ?? 0) + 1;
  }

  return squads.map((s) => ({
    ...s,
    description: s.description ?? null,
    member_count: countMap[s.id] ?? 1,
  }));
}

export type SquadMember = {
  student_id: string;
  first_name: string | null;
  full_name: string | null;
  photo_url: string | null;
  joined_at: string;
  workouts_this_week: number;
  workouts_this_month: number;
  current_streak: number;
  last_workout_date: string | null;
};

export type FeedEntry = {
  id: string;
  student_id: string;
  first_name: string | null;
  full_name: string | null;
  photo_url: string | null;
  collection_id: string;
  collection_name: string;
  finished_at: string | null;
  created_at: string;
};

export type ChallengeProgress = {
  student_id: string;
  first_name: string | null;
  full_name: string | null;
  photo_url: string | null;
  value: number;
};

export type ChallengeParticipant = {
  student_id: string;
  first_name: string | null;
  full_name: string | null;
  photo_url: string | null;
  joined_at: string;
  proof_photo_url: string | null;
  proof_uploaded_at: string | null;
};

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  target_value: number;
  target_exercise_id: string | null;
  target_exercise_name: string | null;
  end_date: string;
  created_at: string;
  /** Progress of participants only — opt-in é explícito. */
  progress: ChallengeProgress[];
  participants: ChallengeParticipant[];
};

export type SharedWorkout = {
  id: string;
  collection_id: string;
  collection_name: string;
  estimated_duration_minutes: number;
  exercise_count: number;
  shared_by_id: string;
  shared_by_name: string;
  created_at: string;
  exercises: CollectionExerciseRow[];
};

export type StreakRescue = {
  id: string;
  squad_id: string;
  student_id: string;
  student_name: string;
  student_photo: string | null;
  streak_at_risk: number;
  missed_date: string;
  votes_collected: number;
  status: "pending" | "approved" | "rejected";
  voter_ids: string[];
  created_at: string;
};

export type SquadDetail = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  members: SquadMember[];
  feed: FeedEntry[];
  challenges: Challenge[];
  sharedWorkouts: SharedWorkout[];
  rescues: StreakRescue[];
};

export async function getSquadDetail(squadId: string, requestingUserId: string): Promise<SquadDetail | null> {
  const admin = createAdminClient();

  // Verify membership
  const { data: membership } = await admin
    .from("gymconnect_squad_members")
    .select("student_id")
    .eq("squad_id", squadId)
    .eq("student_id", requestingUserId)
    .maybeSingle();

  if (!membership) return null;

  const { data: squad } = await admin
    .from("gymconnect_squads")
    .select("id, name, description, invite_code, created_by")
    .eq("id", squadId)
    .single();

  if (!squad) return null;

  // Members
  const { data: memberRows } = await admin
    .from("gymconnect_squad_members")
    .select("student_id, joined_at")
    .eq("squad_id", squadId)
    .order("joined_at", { ascending: true });

  const memberIds = (memberRows ?? []).map((m) => m.student_id);

  const { data: userProfiles } = await admin
    .from("users")
    .select("id, first_name, full_name, photo_url, current_streak, last_workout_date")
    .in("id", memberIds);

  const profileMap = new Map<string, {
    first_name: string | null;
    full_name: string | null;
    photo_url: string | null;
    current_streak: number;
    last_workout_date: string | null;
  }>();
  for (const u of userProfiles ?? []) {
    profileMap.set(u.id, {
      first_name: u.first_name,
      full_name: u.full_name,
      photo_url: u.photo_url,
      current_streak: (u.current_streak as number) ?? 0,
      last_workout_date: (u.last_workout_date as string | null) ?? null,
    });
  }

  function memberName(id: string): string {
    const p = profileMap.get(id);
    return p?.first_name ?? p?.full_name?.split(" ")[0] ?? "Aluno";
  }

  // Date ranges for leaderboard
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Workout logs for the squad
  const { data: workoutLogs } = await admin
    .from("workout_logs")
    .select("id, student_id, collection_id, finished_at, created_at")
    .in("student_id", memberIds)
    .order("created_at", { ascending: false })
    .limit(200);

  const weekCountMap: Record<string, number> = {};
  const monthCountMap: Record<string, number> = {};
  for (const log of workoutLogs ?? []) {
    const logDate = new Date(log.created_at);
    if (logDate >= weekStart) weekCountMap[log.student_id] = (weekCountMap[log.student_id] ?? 0) + 1;
    if (logDate >= monthStart) monthCountMap[log.student_id] = (monthCountMap[log.student_id] ?? 0) + 1;
  }

  // Collection names for feed
  const collectionIds = [...new Set((workoutLogs ?? []).slice(0, 30).map((l) => l.collection_id))];
  const { data: collectionsMeta } = collectionIds.length > 0
    ? await admin.from("exercise_collections").select("id, name").in("id", collectionIds)
    : { data: [] };
  const collectionMap = new Map<string, string>();
  for (const c of collectionsMeta ?? []) collectionMap.set(c.id, c.name);

  const members: SquadMember[] = (memberRows ?? []).map((m) => {
    const profile = profileMap.get(m.student_id);
    return {
      student_id: m.student_id,
      first_name: profile?.first_name ?? null,
      full_name: profile?.full_name ?? null,
      photo_url: profile?.photo_url ?? null,
      joined_at: m.joined_at,
      workouts_this_week: weekCountMap[m.student_id] ?? 0,
      workouts_this_month: monthCountMap[m.student_id] ?? 0,
      current_streak: profile?.current_streak ?? 0,
      last_workout_date: profile?.last_workout_date ?? null,
    };
  });

  const feed: FeedEntry[] = (workoutLogs ?? []).slice(0, 30).map((log) => {
    const profile = profileMap.get(log.student_id);
    return {
      id: log.id,
      student_id: log.student_id,
      first_name: profile?.first_name ?? null,
      full_name: profile?.full_name ?? null,
      photo_url: profile?.photo_url ?? null,
      collection_id: log.collection_id,
      collection_name: collectionMap.get(log.collection_id) ?? "Treino",
      finished_at: log.finished_at,
      created_at: log.created_at,
    };
  });

  // ── Challenges ──────────────────────────────────────────────────────────────
  const { data: challengeRows } = await admin
    .from("squad_challenges")
    .select("id, title, description, challenge_type, target_value, target_exercise_id, end_date, created_at")
    .eq("squad_id", squadId)
    .gte("end_date", now.toISOString())
    .order("end_date", { ascending: true });

  // Fetch target exercise names
  const exerciseIds = [...new Set((challengeRows ?? []).map((c) => c.target_exercise_id).filter(Boolean) as string[])];
  const exerciseNameMap = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data: exRows } = await admin
      .from("exercises")
      .select("id, title, translated_name")
      .in("id", exerciseIds);
    for (const e of exRows ?? []) {
      exerciseNameMap.set(e.id, (e as { translated_name?: string | null }).translated_name ?? e.title);
    }
  }

  // Challenge participants (explicit opt-in)
  const challengeIds = (challengeRows ?? []).map((c) => c.id);
  const { data: participantRows } = challengeIds.length > 0
    ? await admin
        .from("challenge_participants")
        .select("challenge_id, student_id, joined_at, proof_photo_url, proof_uploaded_at")
        .in("challenge_id", challengeIds)
        .order("joined_at", { ascending: true })
    : { data: [] };

  const participantsByChallenge = new Map<string, ChallengeParticipant[]>();
  for (const p of participantRows ?? []) {
    const profile = profileMap.get(p.student_id);
    const list = participantsByChallenge.get(p.challenge_id) ?? [];
    list.push({
      student_id: p.student_id,
      first_name: profile?.first_name ?? null,
      full_name: profile?.full_name ?? null,
      photo_url: profile?.photo_url ?? null,
      joined_at: p.joined_at,
      proof_photo_url: p.proof_photo_url ?? null,
      proof_uploaded_at: p.proof_uploaded_at ?? null,
    });
    participantsByChallenge.set(p.challenge_id, list);
  }

  // Fetch set_logs for challenge computation (all workout log ids)
  const workoutLogIds = (workoutLogs ?? []).map((l) => l.id);
  const { data: setLogs } = workoutLogIds.length > 0
    ? await admin
        .from("set_logs")
        .select("workout_log_id, exercise_id, weight_kg, reps_completed, created_at")
        .in("workout_log_id", workoutLogIds)
    : { data: [] };

  // Build a map: workoutLogId → studentId + date
  const logMeta = new Map<string, { student_id: string; created_at: string }>();
  for (const l of workoutLogs ?? []) logMeta.set(l.id, { student_id: l.student_id, created_at: l.created_at });

  const challenges: Challenge[] = (challengeRows ?? []).map((ch) => {
    const start = new Date(ch.created_at);
    const end = new Date(ch.end_date);
    const participants = participantsByChallenge.get(ch.id) ?? [];

    // Workout logs within challenge timeframe
    const logsInRange = (workoutLogs ?? []).filter((l) => {
      const d = new Date(l.created_at);
      return d >= start && d <= end;
    });

    // Leaderboard counts participants only — joining is an explicit action
    const participantIds = participants.map((p) => p.student_id);
    const progress: ChallengeProgress[] = participantIds.map((sid) => {
      let value = 0;
      const memberLogs = logsInRange.filter((l) => l.student_id === sid);

      if (ch.challenge_type === "frequency") {
        value = memberLogs.length;
      } else {
        const memberLogIds = new Set(memberLogs.map((l) => l.id));
        const relevantSets = (setLogs ?? []).filter((s) => {
          if (!memberLogIds.has(s.workout_log_id)) return false;
          if (ch.target_exercise_id && s.exercise_id !== ch.target_exercise_id) return false;
          const d = new Date(s.created_at);
          return d >= start && d <= end;
        });
        if (ch.challenge_type === "volume") {
          value = relevantSets.reduce((acc, s) => acc + (s.weight_kg ?? 0) * (s.reps_completed ?? 0), 0);
        } else if (ch.challenge_type === "max_weight") {
          value = relevantSets.reduce((acc, s) => Math.max(acc, s.weight_kg ?? 0), 0);
        }
      }

      const profile = profileMap.get(sid);
      return {
        student_id: sid,
        first_name: profile?.first_name ?? null,
        full_name: profile?.full_name ?? null,
        photo_url: profile?.photo_url ?? null,
        value,
      };
    });

    progress.sort((a, b) => b.value - a.value);

    return {
      id: ch.id,
      title: ch.title,
      description: (ch as { description?: string | null }).description ?? null,
      challenge_type: ch.challenge_type as ChallengeType,
      target_value: Number(ch.target_value),
      target_exercise_id: (ch as { target_exercise_id?: string | null }).target_exercise_id ?? null,
      target_exercise_name: ch.target_exercise_id ? (exerciseNameMap.get(ch.target_exercise_id) ?? null) : null,
      end_date: ch.end_date,
      created_at: ch.created_at,
      progress,
      participants,
    };
  });

  // ── Shared Workouts ─────────────────────────────────────────────────────────
  const { data: sharedRows } = await admin
    .from("squad_shared_workouts")
    .select("id, collection_id, shared_by, created_at")
    .eq("squad_id", squadId)
    .order("created_at", { ascending: false });

  const sharedCollectionIds = [...new Set((sharedRows ?? []).map((r) => r.collection_id))];
  const sharedWorkouts: SharedWorkout[] = [];

  if (sharedCollectionIds.length > 0) {
    const { data: sharedCollections } = await admin
      .from("exercise_collections")
      .select(
        "id, name, estimated_duration_minutes, collection_exercises(id, exercise_id, sort_order, default_sets, default_reps, default_weight_kg, exercise:exercises(id, title, translated_name, description, instructions, youtube_url, webm_path, video_url))",
      )
      .in("id", sharedCollectionIds);

    type RawCE = {
      id: string;
      exercise_id: string;
      sort_order: number;
      default_sets: number;
      default_reps: number;
      default_weight_kg: number | null;
      exercise: CollectionExerciseRow["exercise"] | CollectionExerciseRow["exercise"][];
    };

    const collectionDetailMap = new Map<string, {
      name: string;
      estimated_duration_minutes: number;
      exercises: CollectionExerciseRow[];
    }>();

    for (const col of sharedCollections ?? []) {
      const rawCEs = (col as { collection_exercises?: RawCE[] }).collection_exercises ?? [];
      const exercises: CollectionExerciseRow[] = rawCEs
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ce) => {
          const ex = Array.isArray(ce.exercise) ? ce.exercise[0] : ce.exercise;
          if (!ex) return null;
          return { id: ce.id, exercise_id: ce.exercise_id, sort_order: ce.sort_order, default_sets: ce.default_sets, default_reps: ce.default_reps, default_weight_kg: ce.default_weight_kg, exercise: ex };
        })
        .filter((e): e is CollectionExerciseRow => e !== null);

      collectionDetailMap.set(col.id, {
        name: col.name,
        estimated_duration_minutes: (col as { estimated_duration_minutes?: number }).estimated_duration_minutes ?? 60,
        exercises,
      });
    }

    for (const row of sharedRows ?? []) {
      const detail = collectionDetailMap.get(row.collection_id);
      if (!detail) continue;
      sharedWorkouts.push({
        id: row.id,
        collection_id: row.collection_id,
        collection_name: detail.name,
        estimated_duration_minutes: detail.estimated_duration_minutes,
        exercise_count: detail.exercises.length,
        shared_by_id: row.shared_by,
        shared_by_name: memberName(row.shared_by),
        created_at: row.created_at,
        exercises: detail.exercises,
      });
    }
  }

  // ── Streak Rescues ──────────────────────────────────────────────────────────
  // Show pending (and recently approved) rescues from the last 3 days
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  const { data: rescueRows } = await admin
    .from("squad_streak_rescues")
    .select("id, student_id, missed_date, votes_collected, status, created_at")
    .eq("squad_id", squadId)
    .gte("missed_date", threeDaysAgo.toISOString().slice(0, 10))
    .order("created_at", { ascending: false });

  const rescueIds = (rescueRows ?? []).map((r) => r.id);
  const { data: voteRows } = rescueIds.length > 0
    ? await admin.from("squad_rescue_votes").select("rescue_id, voter_id").in("rescue_id", rescueIds)
    : { data: [] };

  const voteMap = new Map<string, string[]>();
  for (const v of voteRows ?? []) {
    if (!voteMap.has(v.rescue_id)) voteMap.set(v.rescue_id, []);
    voteMap.get(v.rescue_id)!.push(v.voter_id);
  }

  const rescues: StreakRescue[] = (rescueRows ?? []).map((r) => {
    const profile = profileMap.get(r.student_id);
    const name = profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "Aluno";
    const streak = profile?.current_streak ?? 0;
    return {
      id: r.id,
      squad_id: squadId,
      student_id: r.student_id,
      student_name: name,
      student_photo: profile?.photo_url ?? null,
      streak_at_risk: streak,
      missed_date: r.missed_date,
      votes_collected: r.votes_collected,
      status: r.status as "pending" | "approved" | "rejected",
      voter_ids: voteMap.get(r.id) ?? [],
      created_at: r.created_at,
    };
  });

  return {
    id: squad.id,
    name: squad.name,
    description: squad.description ?? null,
    invite_code: squad.invite_code,
    created_by: squad.created_by,
    members,
    feed,
    challenges,
    sharedWorkouts,
    rescues,
  };
}

// ── Streak Rescue Actions ─────────────────────────────────────────────────────

export async function requestStreakRescue(
  squadId: string,
): Promise<ActionResult & { rescueId?: string }> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const supabase = await createClient();

  // Must be a squad member
  const { data: membership } = await supabase
    .from("gymconnect_squad_members")
    .select("student_id")
    .eq("squad_id", squadId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, message: "Você não é membro deste squad." };

  // Missed date is yesterday
  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const missedDate = yd.toISOString().slice(0, 10);

  const { data: rescue, error } = await supabase
    .from("squad_streak_rescues")
    .insert({ squad_id: squadId, student_id: user.id, missed_date: missedDate })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Você já pediu resgate para este dia." };
    console.error("requestStreakRescue:", error);
    return { ok: false, message: "Erro ao criar pedido de resgate." };
  }

  revalidatePath(`/app/gymconnect/${squadId}`);
  return { ok: true, rescueId: rescue.id };
}

export async function voteForRescue(
  rescueId: string,
  squadId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const supabase = await createClient();

  // Verify rescue belongs to squad and voter is a member (not the at-risk student)
  const { data: rescue } = await supabase
    .from("squad_streak_rescues")
    .select("id, student_id, squad_id, votes_collected, status")
    .eq("id", rescueId)
    .eq("squad_id", squadId)
    .maybeSingle();

  if (!rescue) return { ok: false, message: "Resgate não encontrado." };
  if (rescue.status === "approved") return { ok: false, message: "Resgate já foi aprovado." };
  if (rescue.student_id === user.id) return { ok: false, message: "Você não pode votar no seu próprio resgate." };

  // Insert vote (PK prevents duplicates)
  const { error: voteError } = await supabase
    .from("squad_rescue_votes")
    .insert({ rescue_id: rescueId, voter_id: user.id });

  if (voteError) {
    if (voteError.code === "23505") return { ok: false, message: "Você já votou neste resgate." };
    console.error("voteForRescue:", voteError);
    return { ok: false, message: "Erro ao registrar voto." };
  }

  // Increment votes_collected and check for auto-approve (threshold: 2)
  const newCount = rescue.votes_collected + 1;
  const newStatus = newCount >= 2 ? "approved" : "pending";

  await supabase
    .from("squad_streak_rescues")
    .update({ votes_collected: newCount, status: newStatus })
    .eq("id", rescueId);

  revalidatePath(`/app/gymconnect/${squadId}`);
  return { ok: true };
}
