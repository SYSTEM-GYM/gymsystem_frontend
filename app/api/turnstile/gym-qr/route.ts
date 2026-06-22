import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function buildGymToken(gymId: string, secret: string) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ gymId, iat })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  const expiresAt = (iat + 30) * 1000;
  return { token: `${payload}.${sig}`, expiresAt };
}

export async function GET(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gymId");
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "Missing gymId" }, { status: 400 });
  }

  const secret = process.env.HMAC_QR_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
  }

  // Verify the gym exists
  const admin = createAdminClient();
  const { data: gym, error } = await admin
    .from("gyms")
    .select("id, name")
    .eq("id", gymId)
    .single();

  if (error || !gym) {
    return NextResponse.json({ ok: false, error: "Gym not found" }, { status: 404 });
  }

  const { token, expiresAt } = buildGymToken(gymId, secret);
  return NextResponse.json({ ok: true, token, expiresAt, gymName: gym.name });
}
