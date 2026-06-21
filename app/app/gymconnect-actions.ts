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
  progress: ChallengeProgress[];
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
    .select("id, first_name, full_name, photo_url")
    .in("id", memberIds);

  const profileMap = new Map<string, { first_name: string | null; full_name: string | null; photo_url: string | null }>();
  for (const u of userProfiles ?? []) {
    profileMap.set(u.id, { first_name: u.first_name, full_name: u.full_name, photo_url: u.photo_url });
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

    // Workout logs within challenge timeframe
    const logsInRange = (workoutLogs ?? []).filter((l) => {
      const d = new Date(l.created_at);
      return d >= start && d <= end;
    });

    const progress: ChallengeProgress[] = memberIds.map((sid) => {
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
  };
}
