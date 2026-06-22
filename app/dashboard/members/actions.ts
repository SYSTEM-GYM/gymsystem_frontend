"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidCPF,
  parseAnamnesisData,
  stripDigits,
  type AnamnesisData,
  type PlanType,
} from "@/lib/member-utils";

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

const PLAN_TYPES: PlanType[] = ["basic", "premium", "vip"];

async function writeAuditLog(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
  if (error) console.error("writeAuditLog error:", error);
}

// ── Update member status ──────────────────────────────────────────────────────

export type MemberStatus = "active" | "inactive" | "banned";

export async function updateMemberStatus(
  userId: string,
  status: MemberStatus,
  previousStatus?: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createAdminClient();

  let prior = previousStatus;
  if (!prior) {
    const { data: current } = await admin
      .from("users")
      .select("status")
      .eq("id", userId)
      .single();
    prior = current?.status ?? "unknown";
  }

  const { error } = await admin
    .from("users")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("updateMemberStatus error:", error);
    return { ok: false, error: "Falha ao atualizar o status." };
  }

  await writeAuditLog(auth.userId, "status_change", "user", userId, {
    from: prior,
    to: status,
  });

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${userId}`);
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

// ── Update member profile fields ──────────────────────────────────────────────

export type MemberProfilePatch = {
  cpf?: string;
  phone?: string | null;
  home_gym_id?: string | null;
  plan_type?: PlanType;
};

export async function updateMemberProfile(
  userId: string,
  patch: MemberProfilePatch
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.cpf !== undefined) {
    const cpf = stripDigits(patch.cpf);
    if (cpf.length !== 11 || !isValidCPF(cpf)) {
      return { ok: false, error: "CPF inválido." };
    }
    update.cpf = cpf;
  }

  if (patch.phone !== undefined) {
    const phone = patch.phone ? stripDigits(patch.phone) : "";
    update.phone = phone.length > 0 ? phone : null;
  }

  if (patch.home_gym_id !== undefined) {
    update.home_gym_id = patch.home_gym_id || null;
  }

  if (patch.plan_type !== undefined) {
    if (!PLAN_TYPES.includes(patch.plan_type)) {
      return { ok: false, error: "Plano inválido." };
    }
    update.plan_type = patch.plan_type;
  }

  if (Object.keys(update).length === 1) {
    return { ok: true };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("users").update(update).eq("id", userId);

  if (error) {
    console.error("updateMemberProfile error:", error);
    return { ok: false, error: "Falha ao salvar dados do aluno." };
  }

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${userId}`);
  return { ok: true };
}

// ── Update health / anamnesis ─────────────────────────────────────────────────

export async function updateHealthData(
  userId: string,
  data: { medical_notes?: string; anamnesis_data?: AnamnesisData }
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.medical_notes !== undefined) {
    update.medical_notes = data.medical_notes.trim() || null;
  }

  if (data.anamnesis_data !== undefined) {
    update.anamnesis_data = data.anamnesis_data;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("users").update(update).eq("id", userId);

  if (error) {
    console.error("updateHealthData error:", error);
    return { ok: false, error: "Falha ao salvar dados de saúde." };
  }

  revalidatePath(`/dashboard/members/${userId}`);
  return { ok: true };
}

/** @deprecated Use updateHealthData */
export async function updateMedicalNotes(
  userId: string,
  notes: string
): Promise<ActionResult> {
  return updateHealthData(userId, { medical_notes: notes });
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
  const cpf         = stripDigits((formData.get("cpf") as string) ?? "");
  const phoneRaw    = stripDigits((formData.get("phone") as string) ?? "");
  const phone       = phoneRaw.length > 0 ? phoneRaw : null;
  const planType    = ((formData.get("plan_type") as string) ?? "basic").trim() as PlanType;
  const homeGymId   = ((formData.get("home_gym_id") as string) ?? "").trim() || auth.gymId;
  const birthDate   = (formData.get("birth_date") as string) || null;
  const weightRaw   = ((formData.get("weight") as string) ?? "").replace(",", ".");
  const heightRaw   = ((formData.get("height") as string) ?? "").replace(",", ".");
  const photoFile   = formData.get("photo_file") as File | null;
  const tempPassword = ((formData.get("temp_password") as string) ?? "").trim();

  // Validation — all errors returned as state so the UI can display them
  if (!firstName)     return { status: "error", message: "Nome é obrigatório." };
  if (!lastName)      return { status: "error", message: "Sobrenome é obrigatório." };
  if (!email)         return { status: "error", message: "E-mail é obrigatório." };
  if (cpf.length !== 11 || !isValidCPF(cpf)) {
    return { status: "error", message: "CPF inválido. Informe os 11 dígitos (sem pontos ou traços)." };
  }
  if (!PLAN_TYPES.includes(planType)) {
    return { status: "error", message: "Plano selecionado é inválido." };
  }
  if (!homeGymId) {
    return { status: "error", message: "Selecione uma filial para o aluno." };
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
      home_gym_id: homeGymId,
      plan_type:   planType,
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

// ── Search exercises ──────────────────────────────────────────────────────────

export type ExerciseSearchResult = {
  id: string;
  title: string;
  translated_name: string | null;
  youtube_url: string | null;
  muscle_group: string | null;
};

export async function searchExercises(query: string): Promise<
  | { ok: true; exercises: ExerciseSearchResult[] }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const q = query.trim();
  if (q.length < 2) return { ok: true, exercises: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exercises")
    .select("id, title, translated_name, youtube_url, muscle_group")
    .or(`title.ilike.%${q}%,translated_name.ilike.%${q}%`)
    .limit(15);

  if (error) {
    console.error("searchExercises error:", error);
    return { ok: false, error: "Erro ao buscar exercícios." };
  }
  return { ok: true, exercises: data ?? [] };
}

// ── Save custom workout sheet (A/B/C) ─────────────────────────────────────────

type CustomSessionInput = {
  label: string;
  exercises: {
    exercise_id: string;
    sets: number;
    reps: number;
    weight_kg: number | null;
    rest_seconds: number;
    notes: string | null;
  }[];
};

export async function saveCustomWorkoutSheet(
  studentId: string,
  studentName: string,
  sessions: CustomSessionInput[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const nonEmpty = sessions.filter((s) => s.exercises.length > 0);
  if (nonEmpty.length === 0) {
    return { ok: false, error: "Adicione pelo menos um exercício antes de salvar." };
  }

  const admin = createAdminClient();

  for (const session of nonEmpty) {
    const { data: collection, error: colErr } = await admin
      .from("exercise_collections")
      .insert({
        name: `${studentName.trim()} — Sessão ${session.label}`,
        created_by: auth.userId,
        gym_id: auth.gymId,
        estimated_duration_minutes: 60,
      })
      .select("id")
      .single();

    if (colErr || !collection) {
      console.error("saveCustomWorkoutSheet collection insert:", colErr);
      return { ok: false, error: `Erro ao criar sessão ${session.label}.` };
    }

    const rows = session.exercises.map((ex, i) => ({
      collection_id: collection.id,
      exercise_id: ex.exercise_id,
      sort_order: i + 1,
      default_sets: ex.sets,
      default_reps: ex.reps,
      default_weight_kg: ex.weight_kg,
      rest_seconds: ex.rest_seconds,
      notes: ex.notes,
    }));

    const { error: exErr } = await admin.from("collection_exercises").insert(rows);
    if (exErr) {
      console.error("saveCustomWorkoutSheet exercises insert:", exErr);
      await admin.from("exercise_collections").delete().eq("id", collection.id);
      return { ok: false, error: `Erro ao salvar exercícios da sessão ${session.label}.` };
    }

    const { error: schedErr } = await admin.from("workout_schedules").insert({
      user_id: studentId,
      collection_id: collection.id,
      schedule_type: "session",
      session_label: session.label,
      sort_order: session.label.charCodeAt(0) - 65,
    });
    if (schedErr) console.error("saveCustomWorkoutSheet schedule insert:", schedErr);
  }

  revalidatePath(`/dashboard/members/${studentId}`);
  return { ok: true };
}

// ── Create physical assessment ─────────────────────────────────────────────────

export async function createPhysicalAssessment(
  userId: string,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const date              = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
  const weightRaw         = ((formData.get("weight") as string) ?? "").replace(",", ".");
  const heightRaw         = ((formData.get("height") as string) ?? "").replace(",", ".");
  const bodyFatRaw        = ((formData.get("body_fat_percentage") as string) ?? "").replace(",", ".");
  const leanMassRaw       = ((formData.get("lean_mass") as string) ?? "").replace(",", ".");
  const notes             = ((formData.get("notes") as string) ?? "").trim() || null;

  const weight            = weightRaw ? parseFloat(weightRaw) : null;
  const height            = heightRaw ? parseFloat(heightRaw) : null;
  const body_fat_percentage = bodyFatRaw ? parseFloat(bodyFatRaw) : null;
  const lean_mass         = leanMassRaw ? parseFloat(leanMassRaw) : null;

  if (!weight && !height) {
    return { ok: false, error: "Informe pelo menos peso ou altura." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("physical_assessments").insert({
    user_id: userId,
    date,
    weight,
    height,
    body_fat_percentage,
    lean_mass,
    notes,
  });

  if (error) {
    console.error("createPhysicalAssessment error:", error);
    return { ok: false, error: "Erro ao salvar avaliação. Tente novamente." };
  }

  revalidatePath(`/dashboard/members/${userId}`);
  return { ok: true };
}
