"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

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

  // Creator automatically becomes a member
  const { error: memberError } = await supabase
    .from("gymconnect_squad_members")
    .insert({ squad_id: squad.id, student_id: user.id });

  if (memberError) {
    console.error("createSquad member insert:", memberError);
  }

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

// ── Read helpers (used by server components via admin client) ─────────────────

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
  collection_name: string;
  finished_at: string | null;
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

  // Date ranges
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: workoutLogs } = await admin
    .from("workout_logs")
    .select("id, student_id, collection_id, finished_at, created_at")
    .in("student_id", memberIds)
    .order("created_at", { ascending: false })
    .limit(200);

  // Count per member
  const weekCountMap: Record<string, number> = {};
  const monthCountMap: Record<string, number> = {};
  for (const log of workoutLogs ?? []) {
    const logDate = new Date(log.created_at);
    if (logDate >= weekStart) weekCountMap[log.student_id] = (weekCountMap[log.student_id] ?? 0) + 1;
    if (logDate >= monthStart) monthCountMap[log.student_id] = (monthCountMap[log.student_id] ?? 0) + 1;
  }

  // Fetch collection names for feed
  const collectionIds = [...new Set((workoutLogs ?? []).slice(0, 30).map((l) => l.collection_id))];
  const { data: collections } = await admin
    .from("exercise_collections")
    .select("id, name")
    .in("id", collectionIds);
  const collectionMap = new Map<string, string>();
  for (const c of collections ?? []) collectionMap.set(c.id, c.name);

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
      collection_name: collectionMap.get(log.collection_id) ?? "Treino",
      finished_at: log.finished_at,
      created_at: log.created_at,
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
  };
}
