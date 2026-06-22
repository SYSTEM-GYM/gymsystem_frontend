import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { SmartProfile } from "./SmartProfile";
import type { AuditLogEntry } from "@/app/components/members/AuditTimeline";

export type PhysicalAssessment = {
  id: string;
  date: string;
  weight: number | null;
  height: number | null;
  body_fat_percentage: number | null;
  lean_mass: number | null;
  notes: string | null;
  created_at: string;
};

export type OccupancyLog = {
  id: string;
  validated_at: string;
  event_type: string;
};

export type StudentDetail = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  birth_date: string | null;
  cpf: string | null;
  phone: string | null;
  weight: number | null;
  height: number | null;
  plan_type: string;
  status: string;
  experience_points: number;
  medical_notes: string | null;
  anamnesis_data: Record<string, boolean> | null;
  home_gym_id: string | null;
  created_at: string;
};

export type GymOption = { id: string; name: string; city: string | null };

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "personal" } = await searchParams;

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminProfile } = await authClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: student, error } = await admin
    .from("users")
    .select(
      "id, full_name, first_name, last_name, photo_url, birth_date, cpf, phone, weight, height, plan_type, status, experience_points, medical_notes, anamnesis_data, home_gym_id, created_at",
    )
    .eq("id", id)
    .single<StudentDetail>();

  if (error || !student) {
    console.error("[MemberProfilePage] student fetch error:", error);
    notFound();
  }

  let gymName: string | null = null;
  if (student.home_gym_id) {
    const { data: gym } = await admin
      .from("gyms")
      .select("name")
      .eq("id", student.home_gym_id)
      .single();
    gymName = gym?.name ?? null;
  }

  const { data: gymsData } = await admin
    .from("gyms")
    .select("id, name, city")
    .eq("owner_id", user.id)
    .order("name", { ascending: true });
  const gyms: GymOption[] = (gymsData ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    city: g.city,
  }));

  const { data: assessments } = await admin
    .from("physical_assessments")
    .select("id, date, weight, height, body_fat_percentage, lean_mass, notes, created_at")
    .eq("user_id", id)
    .order("date", { ascending: false })
    .returns<PhysicalAssessment[]>();

  const { data: logs } = await admin
    .from("occupancy_logs")
    .select("id, validated_at, event_type")
    .eq("user_id", id)
    .order("validated_at", { ascending: false })
    .limit(60)
    .returns<OccupancyLog[]>();

  const { data: collectionsRaw } = await admin
    .from("exercise_collections")
    .select(
      "id, name, description, estimated_duration_minutes, collection_exercises(sort_order, default_sets, default_reps, exercise:exercises(id, title, translated_name))",
    )
    .order("name", { ascending: true });

  type RawCollEx = {
    sort_order: number;
    default_sets: number;
    default_reps: number;
    exercise: { id: string; title: string; translated_name: string | null } | { id: string; title: string; translated_name: string | null }[] | null;
  };

  const collections = (collectionsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: (c as { description?: string | null }).description ?? null,
    estimated_duration_minutes: (c as { estimated_duration_minutes?: number }).estimated_duration_minutes ?? 60,
    exercises: ((c as { collection_exercises?: RawCollEx[] }).collection_exercises ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ce) => ({
        sort_order: ce.sort_order,
        default_sets: ce.default_sets,
        default_reps: ce.default_reps,
        exercise: Array.isArray(ce.exercise) ? (ce.exercise[0] ?? null) : ce.exercise,
      })),
  }));

  const { data: schedulesRaw } = await admin
    .from("workout_schedules")
    .select("id, schedule_type, day_of_week, session_label, created_at, collection:exercise_collections(name)")
    .eq("user_id", id)
    .order("sort_order", { ascending: true });

  const schedules = (schedulesRaw ?? []).map((s) => ({
    ...s,
    created_at: (s as { created_at?: string }).created_at ?? null,
    collection: Array.isArray(s.collection) ? s.collection[0] ?? null : s.collection,
  }));

  const { data: executionLogsRaw } = await admin
    .from("workout_execution_logs")
    .select("id, logged_at, weight_kg, reps_done, sets_completed, exercise:exercises(title)")
    .eq("user_id", id)
    .order("logged_at", { ascending: false })
    .limit(30);

  const executionLogs = (executionLogsRaw ?? []).map((log) => ({
    ...log,
    exercise: Array.isArray(log.exercise) ? log.exercise[0] ?? null : log.exercise,
  }));

  const { data: auditRaw } = await admin
    .from("audit_logs")
    .select("id, action, resource_type, metadata, created_at, actor_id")
    .eq("resource_id", id)
    .order("created_at", { ascending: false })
    .limit(40);

  const actorIds = [...new Set((auditRaw ?? []).map((a) => a.actor_id).filter(Boolean))];
  const actorMap = new Map<string, { full_name: string | null; first_name: string | null }>();

  if (actorIds.length > 0) {
    const { data: actors } = await admin
      .from("users")
      .select("id, full_name, first_name")
      .in("id", actorIds as string[]);
    for (const a of actors ?? []) {
      actorMap.set(a.id, { full_name: a.full_name, first_name: a.first_name });
    }
  }

  const auditLogs: AuditLogEntry[] = (auditRaw ?? []).map((a) => ({
    id: a.id,
    action: a.action,
    resource_type: a.resource_type,
    metadata: (a.metadata as Record<string, unknown>) ?? {},
    created_at: a.created_at,
    actor: a.actor_id ? actorMap.get(a.actor_id) ?? null : null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Voltar para Membros
      </Link>

      <SmartProfile
        student={student}
        gymName={gymName}
        gyms={gyms}
        assessments={assessments ?? []}
        logs={logs ?? []}
        collections={collections ?? []}
        schedules={schedules}
        executionLogs={executionLogs}
        auditLogs={auditLogs}
        initialTab={tab}
      />
    </div>
  );
}
