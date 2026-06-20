"use server";

import { createHmac } from "crypto";
import { createClient } from "@/lib/supabase/server";

export type QRPayload = {
  token: string;   // <base64url_json>.<base64url_signature>
  expiresAt: number; // Unix ms timestamp when this token expires
};

export type GenerateQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; error: "unauthenticated" | "missing_secret" };

function buildToken(userId: string, secret: string): QRPayload {
  const iat = Math.floor(Date.now() / 1000); // Unix seconds
  const json = JSON.stringify({ uid: userId, iat });
  const encodedPayload = Buffer.from(json).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: (iat + 10) * 1000, // 10-second window in ms
  };
}

export async function generateAccessQR(): Promise<GenerateQRResult> {
  const secret = process.env.HMAC_QR_SECRET;
  if (!secret) return { ok: false, error: "missing_secret" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "unauthenticated" };

  return { ok: true, payload: buildToken(user.id, secret) };
}
