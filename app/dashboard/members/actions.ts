"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  | { ok: true; userId: string; gymId: string | null }
  | { ok: false; error: string }
> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  const { data: profile } = await authClient
    .from("users")
    .select("role, home_gym_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Permissão insuficiente." };
  }

  return { ok: true, userId: user.id, gymId: profile.home_gym_id ?? null };
}

type ActionResult = { ok: true } | { ok: false; error: string };

// ── Update member status ──────────────────────────────────────────────────────

export type MemberStatus = "active" | "inactive" | "banned";

export async function updateMemberStatus(
  userId: string,
  status: MemberStatus
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("updateMemberStatus error:", error);
    return { ok: false, error: "Falha ao atualizar o status." };
  }

  revalidatePath("/dashboard/members");
  return { ok: true };
}

// Keep legacy name used by StatusToggleButton (maps to updateMemberStatus)
export async function toggleUserStatus(
  userId: string,
  newStatus: MemberStatus
): Promise<ActionResult> {
  return updateMemberStatus(userId, newStatus);
}

// ── Reset member password ─────────────────────────────────────────────────────

export async function resetMemberPassword(
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "A nova senha deve ter ao menos 8 caracteres." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error("resetMemberPassword error:", error);
    return { ok: false, error: "Falha ao redefinir a senha." };
  }

  return { ok: true };
}

// ── Update medical notes ──────────────────────────────────────────────────────

export async function updateMedicalNotes(
  userId: string,
  notes: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ medical_notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("updateMedicalNotes error:", error);
    return { ok: false, error: "Falha ao salvar observações." };
  }

  revalidatePath("/dashboard/members");
  return { ok: true };
}

// ── Register student ──────────────────────────────────────────────────────────

export type RegisterStudentState =
  | { status: "idle" }
  | { status: "success"; studentName: string }
  | { status: "error"; message: string };

const STUDENT_PHOTOS_BUCKET = "student-photos";

export async function registerStudent(
  _prev: RegisterStudentState,
  formData: FormData
): Promise<RegisterStudentState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error", message: auth.error };

  // Parse form fields
  const firstName   = ((formData.get("first_name") as string) ?? "").trim();
  const lastName    = ((formData.get("last_name") as string) ?? "").trim();
  const email       = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const cpf         = ((formData.get("cpf") as string) ?? "").trim().replace(/\D/g, "");
  const phone       = ((formData.get("phone") as string) ?? "").trim() || null;
  const birthDate   = (formData.get("birth_date") as string) || null;
  const weightRaw   = ((formData.get("weight") as string) ?? "").replace(",", ".");
  const heightRaw   = ((formData.get("height") as string) ?? "").replace(",", ".");
  const photoFile   = formData.get("photo_file") as File | null;
  const tempPassword = ((formData.get("temp_password") as string) ?? "").trim();

  // Validation — all errors returned as state so the UI can display them
  if (!firstName)     return { status: "error", message: "Nome é obrigatório." };
  if (!lastName)      return { status: "error", message: "Sobrenome é obrigatório." };
  if (!email)         return { status: "error", message: "E-mail é obrigatório." };
  if (cpf.length !== 11) {
    return { status: "error", message: "CPF inválido. Informe os 11 dígitos (sem pontos ou traços)." };
  }
  if (!tempPassword || tempPassword.length < 8) {
    return { status: "error", message: "A senha provisória deve ter ao menos 8 caracteres." };
  }

  const weight = weightRaw ? parseFloat(weightRaw) : null;
  const height = heightRaw ? parseFloat(heightRaw) : null;

  // CRITICAL: service-role admin API — keeps the admin's own session intact
  const admin = createAdminClient();

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    console.error("registerStudent createUser error:", createError);
    const message =
      createError?.message?.includes("already been registered")
        ? "Este e-mail já está cadastrado no sistema."
        : "Erro ao criar conta do aluno. Tente novamente.";
    return { status: "error", message };
  }

  const studentId = newUser.user.id;

  // Upload photo (non-fatal — registration continues without it)
  let photoUrl: string | null = null;
  if (photoFile && photoFile.size > 0) {
    const filename = `${studentId}.jpg`;
    const buffer = Buffer.from(await photoFile.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .upload(filename, buffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      console.error("registerStudent photo upload error:", uploadError);
    } else {
      const { data: urlData } = admin.storage
        .from(STUDENT_PHOTOS_BUCKET)
        .getPublicUrl(filename);
      photoUrl = urlData.publicUrl;
    }
  }

  // Update the profile row created by the auth trigger
  const { error: updateError } = await admin
    .from("users")
    .update({
      full_name:   `${firstName} ${lastName}`,
      first_name:  firstName,
      last_name:   lastName,
      birth_date:  birthDate,
      weight,
      height,
      cpf,
      phone,
      photo_url:   photoUrl,
      home_gym_id: auth.gymId,
      status:      "active",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", studentId);

  if (updateError) {
    console.error("registerStudent profile update error:", updateError);
    return {
      status: "error",
      message: "Conta criada mas perfil incompleto. Contate o suporte técnico.",
    };
  }

  revalidatePath("/dashboard/members");
  return { status: "success", studentName: `${firstName} ${lastName}` };
}
