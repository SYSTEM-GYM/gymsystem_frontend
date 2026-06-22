import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function verifyGymToken(
  token: string,
  secret: string,
): { gymId: string; iat: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expectedSig = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  try {
    if (
      !timingSafeEqual(
        Buffer.from(sig, "base64url"),
        Buffer.from(expectedSig, "base64url"),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let parsed: { gymId: string; iat: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  const secret = process.env.HMAC_QR_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "Configuração do servidor incompleta." },
      { status: 500 },
    );
  }

  const body = await req.json() as { gymToken?: string };
  const { gymToken } = body;

  if (!gymToken || typeof gymToken !== "string") {
    return NextResponse.json(
      { ok: false, message: "Token inválido." },
      { status: 400 },
    );
  }

  // 1. Verify gym token
  const parsed = verifyGymToken(gymToken, secret);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, message: "QR Code inválido. Aproxime-se da catraca e tente novamente." },
      { status: 401 },
    );
  }

  // 2. Check token age (30-second window)
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - parsed.iat > 30) {
    return NextResponse.json(
      { ok: false, message: "QR Code expirado. Aguarde o próximo código aparecer na tela." },
      { status: 401 },
    );
  }

  // 3. Authenticate student
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Você precisa estar logado para entrar na academia." },
      { status: 401 },
    );
  }

  // 4. Check student status + active subscription
  const { data: profile } = await authClient
    .from("users")
    .select("status, home_gym_id, first_name, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { ok: false, message: "Sua conta está inativa. Regularize na recepção." },
      { status: 403 },
    );
  }

  const { data: subscription } = await authClient
    .from("gym_subscriptions")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json(
      { ok: false, message: "Nenhuma assinatura ativa. Regularize seu plano na recepção." },
      { status: 403 },
    );
  }

  // 5. Log access to occupancy_logs via admin (bypasses INSERT policy)
  const admin = createAdminClient();
  await admin.from("occupancy_logs").insert({
    user_id: user.id,
    event_type: "entry",
    validated_at: new Date().toISOString(),
    notes: `turnstile_qr gym:${parsed.gymId}`,
  });

  const firstName =
    profile.first_name ?? (profile.full_name as string)?.split(" ")[0] ?? "Aluno";

  return NextResponse.json({
    ok: true,
    message: `Bem-vindo, ${firstName}! Acesso liberado. 🎉`,
  });
}
