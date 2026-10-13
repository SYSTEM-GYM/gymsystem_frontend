import Link from "next/link";

// Shared building blocks for the /login, /register and /forgot-password screens.

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-7">
      <h1 className="font-display text-4xl lg:text-5xl font-bold leading-none tracking-tight text-bone">
        {title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-bone/65">{subtitle}</p>
    </header>
  );
}

export function AuthSubmitButton({
  children,
  pending = false,
}: {
  children: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full min-h-12 rounded-2xl bg-linear-to-r from-leaf to-volt px-6 text-[15px] font-semibold text-forest shadow-[0_12px_32px_-12px_rgba(155,227,66,0.7)] transition hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AuthNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "error"
      ? "text-danger bg-danger/10 border-danger/25"
      : "text-bone/90 bg-leaf/15 border-leaf/30";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-sm rounded-2xl border px-4 py-3 ${toneCls}`}>
      {children}
    </p>
  );
}

export function AuthTextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-volt underline-offset-4 transition-colors hover:text-bone hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt rounded"
    >
      {children}
    </Link>
  );
}

export function AuthFooter({ children }: { children: React.ReactNode }) {
  return <p className="mt-7 text-center text-sm text-bone/60">{children}</p>;
}

/** Two-stroke arc echoing the ring in the GYM CONNECT logo. Decorative only. */
export function BrandRing({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className={className}>
      <circle
        cx="100"
        cy="100"
        r="86"
        pathLength={100}
        strokeDasharray="78 22"
        transform="rotate(-62 100 100)"
        className="stroke-leaf motion-safe:animate-ring-draw"
        strokeWidth="9"
        strokeLinecap="butt"
      />
      <circle
        cx="100"
        cy="100"
        r="96"
        pathLength={100}
        strokeDasharray="78 22"
        transform="rotate(-62 100 100)"
        className="stroke-volt/50 motion-safe:animate-ring-draw"
        strokeWidth="1.25"
      />
    </svg>
  );
}
