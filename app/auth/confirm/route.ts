import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Landing route for the sign-up confirmation e-mail. Supports both link styles:
 * - ?code=…                 default template (PKCE). Must be opened in the
 *                           same browser where the sign-up happened.
 * - ?token_hash=…&type=…    custom template; works on any device.
 * On success the session cookies are set and the user goes to /app.
 *
 * Password recovery links (type=recovery — set by Supabase on token_hash
 * links, and by requestPasswordReset's redirectTo on PKCE links) go to
 * /reset-password instead, to choose the new password.
 *
 * E-mail change links (type=email_change, from the student profile) go back to
 * /app/profile?email=pending|updated|error. With "secure e-mail change" both
 * the old and the new address must confirm: after the first link Supabase
 * redirects with ?message=… and no code, and user.new_email stays set until
 * the second one.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isRecovery = type === "recovery";
  const isEmailChange = type === "email_change";

  const supabase = await createClient();
  let user: User | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) user = data.user;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  }

  if (isEmailChange) {
    let status: "pending" | "updated" | "error";
    if (user) status = user.new_email ? "pending" : "updated";
    else if (!code && !tokenHash && searchParams.get("message")) status = "pending";
    else status = "error";
    return NextResponse.redirect(new URL(`/app/profile?email=${status}`, request.url));
  }

  if (!user) {
    const failure = isRecovery ? "/forgot-password?link=expired" : "/login?confirm=error";
    return NextResponse.redirect(new URL(failure, request.url));
  }

  if (isRecovery) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  await completeProfile(user);
  return NextResponse.redirect(new URL("/app", request.url));
}

/**
 * The handle_new_user trigger only copies full_name. Now that the user has
 * proven ownership of the e-mail, fill first/last name and phone from the
 * sign-up metadata — once, without overwriting edits made afterwards.
 */
async function completeProfile(user: User): Promise<void> {
  const meta = user.user_metadata as { full_name?: string; phone?: string };
  const fullName = meta.full_name?.trim();
  if (!fullName) return;

  const [firstName, ...rest] = fullName.split(/\s+/);
  const { error } = await createAdminClient()
    .from("users")
    .update({
      first_name: firstName,
      last_name: rest.join(" ") || null,
      ...(meta.phone && { phone: meta.phone }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .is("first_name", null);

  if (error) {
    // Non-fatal: the account is confirmed; the profile can be edited later.
    console.error("auth/confirm completeProfile error:", error.message);
  }
}
