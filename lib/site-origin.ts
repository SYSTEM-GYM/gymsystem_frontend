import { headers } from "next/headers";

/** Absolute URL of this deployment, for auth e-mail link redirects. */
export async function siteOrigin(): Promise<string> {
  // Server Actions are POSTs, so browsers always send Origin (and Next.js
  // rejects actions whose Origin doesn't match the host).
  const origin = (await headers()).get("origin");
  return origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
