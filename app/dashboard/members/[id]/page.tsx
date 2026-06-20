import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { SmartProfile } from "./SmartProfile";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  entered_at: string;
  exited_at: string | null;
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
  home_gym_id: string | null;
  created_at: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "personal" } = await searchParams;

  // Auth guard
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

  // Fetch student
  const admin = createAdminClient();
  const { data: student, error } = await admin
    .from("users")
    .select(
      "id, full_name, first_name, last_name, photo_url, birth_date, cpf, phone, weight, height, plan_type, status, experience_points, medical_notes, home_gym_id, created_at"
    )
    .eq("id", id)
    .single<StudentDetail>();

  if (error || !student) {
    console.error("[MemberProfilePage] student fetch error:", error);
    notFound();
  }

  // Fetch gym name if the student has one assigned
  let gymName: string | null = null;
  if (student.home_gym_id) {
    const { data: gym } = await admin
      .from("gyms")
      .select("name")
      .eq("id", student.home_gym_id)
      .single();
    gymName = gym?.name ?? null;
  }

  // Fetch physical assessments (most recent first)
  const { data: assessments } = await admin
    .from("physical_assessments")
    .select("id, date, weight, height, body_fat_percentage, lean_mass, notes, created_at")
    .eq("user_id", id)
    .order("date", { ascending: false })
    .returns<PhysicalAssessment[]>();

  // Fetch last 60 occupancy logs
  const { data: logs } = await admin
    .from("occupancy_logs")
    .select("id, entered_at, exited_at")
    .eq("user_id", id)
    .order("entered_at", { ascending: false })
    .limit(60)
    .returns<OccupancyLog[]>();

  return (
    <div className="space-y-6">
      {/* Back */}
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
        assessments={assessments ?? []}
        logs={logs ?? []}
        initialTab={tab}
      />
    </div>
  );
}
