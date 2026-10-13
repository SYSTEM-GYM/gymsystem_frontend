/** Base URL of the NestJS backend (server-side only; routes live under /api). */
export function backendUrl(): string {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3001"
  );
}
