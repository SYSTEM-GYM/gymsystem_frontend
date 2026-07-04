import { createClient } from "@/lib/supabase/server";

export type SessionProfile = {
  userId: string;
  role: string;
  gymId: string | null;
};

type JwtAppMetadata = {
  role?: string;
  gym_id?: string | null;
};

/**
 * Resolves the current user's role/gym_id. Prefers the JWT's app_metadata
 * (populated by the custom_access_token_hook Postgres function) so most
 * requests need zero extra DB round-trips. Falls back to a `public.users`
 * read for sessions whose token was issued/refreshed before the hook went
 * live, so legacy sessions keep working with zero downtime.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const appMetadata = user.app_metadata as JwtAppMetadata | undefined;

  if (appMetadata?.role) {
    return {
      userId: user.id,
      role: appMetadata.role,
      gymId: appMetadata.gym_id ?? null,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, home_gym_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    role: profile.role,
    gymId: profile.home_gym_id ?? null,
  };
}

export type RequireRoleResult =
  | { ok: true; userId: string; gymId: string | null; role: string }
  | { ok: false; message: string };

/**
 * Generic RBAC gate for Server Actions. Pass the roles allowed to proceed,
 * e.g. requireRole(["master", "gym_admin"]).
 */
export async function requireRole(allowedRoles: string[]): Promise<RequireRoleResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, message: "Não autorizado." };

  if (!allowedRoles.includes(profile.role)) {
    return { ok: false, message: "Permissão insuficiente." };
  }

  return { ok: true, userId: profile.userId, gymId: profile.gymId, role: profile.role };
}

/**
 * 'admin' is kept alongside the new hierarchy so rows/tokens issued before
 * the Master/Gym Admin/Staff rollout keep working unchanged.
 */
export const ADMIN_ROLES = ["master", "gym_admin", "admin"];

export async function requireAdmin(): Promise<RequireRoleResult> {
  return requireRole(ADMIN_ROLES);
}
