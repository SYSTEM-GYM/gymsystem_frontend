"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Toggle user status ────────────────────────────────────────────────────────

type UserStatus = "active" | "inactive" | "blocked";

type ToggleResult = { ok: true } | { ok: false; error: string };

export async function toggleUserStatus(
  userId: string,
  newStatus: UserStatus
): Promise<ToggleResult> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { ok: false, error: "Falha ao atualizar o status do usuário" };

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
  // Verify the requesting user is an admin (session client, RLS-bound)
  const authClient = await createClient();
  const {
    data: { user: adminUser },
  } = await authClient.auth.getUser();
  if (!adminUser) return { status: "error", message: "Não autorizado." };

  const { data: adminProfile } = await authClient
    .from("users")
    .select("role, home_gym_id")
    .eq("id", adminUser.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { status: "error", message: "Permissão insuficiente." };
  }

  // Parse form fields
  const firstName    = (formData.get("first_name") as string).trim();
  const lastName     = (formData.get("last_name") as string).trim();
  const email        = (formData.get("email") as string).trim().toLowerCase();
  const cpf          = (formData.get("cpf") as string).trim().replace(/\D/g, "");
  const phone        = (formData.get("phone") as string | null)?.trim() || null;
  const birthDate    = (formData.get("birth_date") as string) || null;
  const weightRaw    = (formData.get("weight") as string).replace(",", ".");
  const heightRaw    = (formData.get("height") as string).replace(",", ".");
  const photoFile    = formData.get("photo_file") as File | null;
  const tempPassword = (formData.get("temp_password") as string).trim();

  // Validation
  if (!firstName) return { status: "error", message: "Nome é obrigatório." };
  if (!lastName)  return { status: "error", message: "Sobrenome é obrigatório." };
  if (!email)     return { status: "error", message: "E-mail é obrigatório." };
  if (cpf.length !== 11) {
    return { status: "error", message: "CPF inválido. Informe apenas os 11 dígitos." };
  }
  if (!tempPassword || tempPassword.length < 8) {
    return { status: "error", message: "A senha provisória deve ter ao menos 8 caracteres." };
  }

  const weight = weightRaw ? parseFloat(weightRaw) : null;
  const height = heightRaw ? parseFloat(heightRaw) : null;

  // CRITICAL: use service-role admin API so the currently-logged-in admin
  // session is NOT replaced. auth.signUp() would switch the active session.
  const admin = createAdminClient();

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // skip email confirmation — admin-vouched registration
  });

  if (createError || !newUser.user) {
    console.error("registerStudent auth.admin.createUser error:", createError);
    const message =
      createError?.message?.includes("already been registered")
        ? "Este e-mail já está cadastrado no sistema."
        : "Erro ao criar conta do aluno. Tente novamente.";
    return { status: "error", message };
  }

  const studentId = newUser.user.id;

  // Upload photo to student-photos bucket
  let photoUrl: string | null = null;
  if (photoFile && photoFile.size > 0) {
    const filename = `${studentId}.jpg`;
    const buffer = Buffer.from(await photoFile.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .upload(filename, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error("registerStudent photo upload error:", uploadError);
      // Non-fatal: registration continues without photo
    } else {
      const { data: urlData } = admin.storage
        .from(STUDENT_PHOTOS_BUCKET)
        .getPublicUrl(filename);
      photoUrl = urlData.publicUrl;
    }
  }

  // Update the public.users row created by the auth trigger with all profile data
  const { error: updateError } = await admin
    .from("users")
    .update({
      full_name:   `${firstName} ${lastName}`,
      first_name:  firstName,
      last_name:   lastName,
      birth_date:  birthDate,
      weight:      weight,
      height:      height,
      cpf:         cpf,
      phone:       phone,
      photo_url:   photoUrl,
      home_gym_id: adminProfile.home_gym_id,
      status:      "active",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", studentId);

  if (updateError) {
    console.error("registerStudent profile update error:", updateError);
    // Auth user was created — log for manual recovery but don't surface internal id
    return {
      status: "error",
      message: "Conta criada mas perfil incompleto. Contate o suporte técnico.",
    };
  }

  revalidatePath("/dashboard/members");
  return { status: "success", studentName: `${firstName} ${lastName}` };
}
