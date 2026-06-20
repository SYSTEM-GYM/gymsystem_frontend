"use server";

import { createHmac } from "crypto";
import { createClient } from "@/lib/supabase/server";

const QR_VALIDITY_SECONDS = 10;

export type AccessPayload = {
  token: string;      // <base64url_json>.<base64url_signature>
  expiresAt: number;  // Unix ms — client uses this to drive the countdown
};

export type GenerateAccessResult =
  | { ok: true; payload: AccessPayload }
  | { ok: false; reason: "unauthenticated" | "inactive_user" | "missing_secret" };

function signToken(userId: string, secret: string): AccessPayload {
  const iat = Math.floor(Date.now() / 1000);
  const encodedPayload = Buffer.from(
    JSON.stringify({ uid: userId, iat })
  ).toString("base64url");

  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: (iat + QR_VALIDITY_SECONDS) * 1000,
  };
}

export async function generateAccessPayload(): Promise<GenerateAccessResult> {
  const secret = process.env.HMAC_QR_SECRET;
  if (!secret) return { ok: false, reason: "missing_secret" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  // Gate: check public.users.status before issuing any token
  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "inactive_user" };
  }

  return { ok: true, payload: signToken(user.id, secret) };
}
