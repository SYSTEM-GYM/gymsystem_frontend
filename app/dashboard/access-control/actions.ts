"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { storeBackendFetch } from "@/lib/store/backend";

const ACCESS_STAFF_ROLES = [...ADMIN_ROLES, "receptionist"];

export type ActionResult = { ok: true } | { ok: false; message: string };

type StaffContext =
  | { ok: true; userId: string; gymId: string }
  | { ok: false; message: string };

async function requireAccessStaff(): Promise<StaffContext> {
  const auth = await requireRole(ACCESS_STAFF_ROLES);
  if (!auth.ok) return auth;

  let gymId = auth.gymId;
  if (!gymId) {
    const admin = createAdminClient();
    const { data: gym } = await admin
      .from("gyms")
      .select("id")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    gymId = gym?.id ?? null;
  }
  if (!gymId) return { ok: false, message: "Nenhuma unidade vinculada ao seu usuário." };
  return { ok: true, userId: auth.userId, gymId };
}

// ── Hardware settings ─────────────────────────────────────────────────────────

export type TurnstileMode = "qr" | "facial" | "manual";

export type HardwareSettings = {
  turnstile_mode: TurnstileMode;
  ip_address: string | null;
  updated_at: string | null;
};

export async function getHardwareSettings(): Promise<HardwareSettings> {
  const auth = await requireAccessStaff();
  if (!auth.ok) return { turnstile_mode: "qr", ip_address: null, updated_at: null };

  const admin = createAdminClient();
  const { data } = await admin
    .from("gym_hardware_settings")
    .select("turnstile_mode, ip_address, updated_at")
    .eq("gym_id", auth.gymId)
    .maybeSingle();

  return (
    (data as HardwareSettings | null) ?? {
      turnstile_mode: "qr",
      ip_address: null,
      updated_at: null,
    }
  );
}

const IP_RE =
  /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$|^([0-9a-fA-F:]+)$/;

export async function saveHardwareSettings(input: {
  turnstileMode: TurnstileMode;
  ipAddress: string;
}): Promise<ActionResult> {
  const auth = await requireAccessStaff();
  if (!auth.ok) return auth;

  const ip = input.ipAddress.trim();
  if (ip && !IP_RE.test(ip)) {
    return { ok: false, message: "IP inválido. Use IPv4 (192.168.0.10) ou IPv6." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("gym_hardware_settings").upsert(
    {
      gym_id: auth.gymId,
      turnstile_mode: input.turnstileMode,
      ip_address: ip || null,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "gym_id" },
  );

  if (error) {
    console.error("saveHardwareSettings:", error);
    return { ok: false, message: "Erro ao salvar as configurações." };
  }
  revalidatePath("/dashboard/access-control");
  return { ok: true };
}

export async function unlockTurnstile(): Promise<{ ok: boolean; message: string }> {
  try {
    return await storeBackendFetch<{ ok: boolean; message: string }>(
      "/api/v1/access/unlock",
      { method: "POST" },
    );
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Falha ao contatar o backend.",
    };
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export type PeakHourPoint = { hour: string; count: number };

export type LiveFeedEntry = {
  id: string;
  student_name: string;
  photo_url: string | null;
  entry_time: string;
  exit_time: string | null;
};

export type AccessAnalytics = {
  peakHours: PeakHourPoint[];
  avgStayMinutes: number | null;
  entriesToday: number;
  currentlyInside: number;
  liveFeed: LiveFeedEntry[];
};

type LogRow = {
  id: string;
  student_id: string;
  entry_time: string;
  exit_time: string | null;
};

export async function getAccessAnalytics(): Promise<AccessAnalytics> {
  const auth = await requireAccessStaff();
  if (!auth.ok) {
    return {
      peakHours: [],
      avgStayMinutes: null,
      entriesToday: 0,
      currentlyInside: 0,
      liveFeed: [],
    };
  }

  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await admin
    .from("access_logs")
    .select("id, student_id, entry_time, exit_time")
    .eq("gym_id", auth.gymId)
    .gte("entry_time", since.toISOString())
    .order("entry_time", { ascending: false })
    .limit(2000);

  const logs = (data ?? []) as LogRow[];

  // Peak hours histogram (05h–23h, local time)
  const hourCounts = new Map<number, number>();
  for (const log of logs) {
    const h = new Date(log.entry_time).getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const peakHours: PeakHourPoint[] = [];
  for (let h = 5; h <= 23; h++) {
    peakHours.push({ hour: `${String(h).padStart(2, "0")}h`, count: hourCounts.get(h) ?? 0 });
  }

  // Average stay (completed sessions only)
  const stays = logs
    .filter((l) => l.exit_time)
    .map((l) => new Date(l.exit_time!).getTime() - new Date(l.entry_time).getTime())
    .filter((ms) => ms > 0 && ms < 12 * 3600_000);
  const avgStayMinutes = stays.length
    ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length / 60000)
    : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const entriesToday = logs.filter(
    (l) => new Date(l.entry_time) >= todayStart,
  ).length;
  const currentlyInside = logs.filter(
    (l) => !l.exit_time && new Date(l.entry_time) >= todayStart,
  ).length;

  // Live feed with names
  const recent = logs.slice(0, 20);
  const studentIds = [...new Set(recent.map((l) => l.student_id))];
  const nameMap = new Map<string, { name: string; photo: string | null }>();
  if (studentIds.length > 0) {
    const { data: students } = await admin
      .from("users")
      .select("id, first_name, full_name, photo_url")
      .in("id", studentIds);
    for (const s of students ?? []) {
      nameMap.set(s.id, {
        name: s.first_name ?? s.full_name?.split(" ")[0] ?? "Aluno",
        photo: s.photo_url ?? null,
      });
    }
  }

  return {
    peakHours,
    avgStayMinutes,
    entriesToday,
    currentlyInside,
    liveFeed: recent.map((l) => ({
      id: l.id,
      student_name: nameMap.get(l.student_id)?.name ?? "Aluno",
      photo_url: nameMap.get(l.student_id)?.photo ?? null,
      entry_time: l.entry_time,
      exit_time: l.exit_time,
    })),
  };
}

// ── Individual attendance ─────────────────────────────────────────────────────

export type StudentOption = { id: string; full_name: string; photo_url: string | null };

export async function searchStudentsForAttendance(
  query: string,
): Promise<StudentOption[]> {
  const auth = await requireAccessStaff();
  if (!auth.ok || query.trim().length < 2) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, full_name, photo_url")
    .eq("role", "customer")
    .ilike("full_name", `%${query.trim()}%`)
    .limit(8);
  return (data ?? []) as StudentOption[];
}

export type AttendanceEntry = {
  id: string;
  entry_time: string;
  exit_time: string | null;
  duration_minutes: number | null;
};

export type StudentAttendance = {
  visitsLast30d: number;
  avgDurationMinutes: number | null;
  entries: AttendanceEntry[];
};

export async function getStudentAttendance(
  studentId: string,
): Promise<StudentAttendance> {
  const auth = await requireAccessStaff();
  if (!auth.ok) return { visitsLast30d: 0, avgDurationMinutes: null, entries: [] };

  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await admin
    .from("access_logs")
    .select("id, entry_time, exit_time")
    .eq("gym_id", auth.gymId)
    .eq("student_id", studentId)
    .gte("entry_time", since.toISOString())
    .order("entry_time", { ascending: false })
    .limit(60);

  const entries: AttendanceEntry[] = ((data ?? []) as LogRow[]).map((l) => {
    const dur = l.exit_time
      ? Math.round(
          (new Date(l.exit_time).getTime() - new Date(l.entry_time).getTime()) / 60000,
        )
      : null;
    return {
      id: l.id,
      entry_time: l.entry_time,
      exit_time: l.exit_time,
      duration_minutes: dur !== null && dur >= 0 && dur < 720 ? dur : null,
    };
  });

  const durations = entries
    .map((e) => e.duration_minutes)
    .filter((d): d is number => d !== null);

  return {
    visitsLast30d: entries.length,
    avgDurationMinutes: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null,
    entries,
  };
}
