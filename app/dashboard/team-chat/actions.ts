"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";

const TEAM_ROLES = [...ADMIN_ROLES, "receptionist", "trainer"];

export type ActionResult = { ok: true } | { ok: false; message: string };

export type TeamMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

async function requireTeamMember() {
  return requireRole(TEAM_ROLES);
}

export async function getTeamMessages(): Promise<TeamMessage[]> {
  const auth = await requireTeamMember();
  if (!auth.ok || !auth.gymId) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("team_messages")
    .select("id, sender_id, content, created_at")
    .eq("gym_id", auth.gymId)
    .order("created_at", { ascending: true })
    .limit(200);

  const rows = data ?? [];
  const senderIds = [...new Set(rows.map((r) => r.sender_id))];
  const nameMap = new Map<string, string>();
  if (senderIds.length > 0) {
    const { data: users } = await admin
      .from("users")
      .select("id, first_name, full_name")
      .in("id", senderIds);
    for (const u of users ?? []) {
      nameMap.set(u.id, u.first_name ?? u.full_name?.split(" ")[0] ?? "Equipe");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    sender_id: r.sender_id,
    sender_name: nameMap.get(r.sender_id) ?? "Equipe",
    content: r.content,
    created_at: r.created_at,
  }));
}

export async function sendTeamMessage(content: string): Promise<ActionResult> {
  const auth = await requireTeamMember();
  if (!auth.ok) return auth;
  if (!auth.gymId) return { ok: false, message: "Nenhuma unidade vinculada." };

  const trimmed = content.trim();
  if (!trimmed) return { ok: false, message: "Escreva uma mensagem." };
  if (trimmed.length > 4000) return { ok: false, message: "Mensagem muito longa." };

  // RLS (team_messages_team_insert) double-checks gym_id + sender_id = auth.uid()
  const admin = createAdminClient();
  const { error } = await admin.from("team_messages").insert({
    gym_id: auth.gymId,
    sender_id: auth.userId,
    content: trimmed,
  });

  if (error) {
    console.error("sendTeamMessage:", error);
    return { ok: false, message: "Erro ao enviar mensagem." };
  }
  return { ok: true };
}

export async function deleteTeamMessage(messageId: string): Promise<ActionResult> {
  const auth = await requireTeamMember();
  if (!auth.ok) return auth;
  if (!auth.gymId) return { ok: false, message: "Nenhuma unidade vinculada." };

  const admin = createAdminClient();
  const isAdmin = ADMIN_ROLES.includes(auth.role);

  let q = admin.from("team_messages").delete().eq("id", messageId).eq("gym_id", auth.gymId);
  if (!isAdmin) q = q.eq("sender_id", auth.userId);

  const { error } = await q;
  if (error) return { ok: false, message: "Erro ao excluir mensagem." };
  return { ok: true };
}
