import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require admin or trainer role
const ADMIN_ONLY_ROUTES = ["/dashboard/members", "/dashboard/finance", "/dashboard/settings"];

// Routes that require any authenticated user
const APP_ROUTES = ["/app"];

// White-label subdomains that don't map to a tenant (e.g. app.oursystem.com, www.oursystem.com)
const RESERVED_SUBDOMAINS = new Set(["www", "app"]);

/**
 * Resolves a tenant slug from the request host, e.g. "academia.localhost:3000"
 * or "academia.oursystem.com" -> "academia". Returns null for bare domains
 * (localhost, oursystem.com) and reserved subdomains.
 */
function resolveTenantSlug(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  const hasSubdomain = parts.length > 2 || (parts.length === 2 && parts[1] === "localhost");
  if (!hasSubdomain) return null;

  const candidate = parts[0];
  return RESERVED_SUBDOMAINS.has(candidate) ? null : candidate;
}

function buildRequestHeaders(request: NextRequest, tenantSlug: string | null): Headers {
  const headers = new Headers(request.headers);
  if (tenantSlug) {
    headers.set("x-tenant-slug", tenantSlug);
  } else {
    headers.delete("x-tenant-slug");
  }
  return headers;
}

export async function middleware(request: NextRequest) {
  const tenantSlug = resolveTenantSlug(request.headers.get("host") ?? "");

  let supabaseResponse = NextResponse.next({
    request: { headers: buildRequestHeaders(request, tenantSlug) },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: buildRequestHeaders(request, tenantSlug) },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // /register is removed — public sign-up is disabled, admins register students directly
  if (pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isAuthRoute = pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    // Protect both /dashboard and /app
    const isProtected =
      pathname.startsWith("/dashboard") ||
      APP_ROUTES.some((r) => pathname.startsWith(r));
    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (user && isAuthRoute) {
    // Role-based post-login redirect: customers → /app, everyone else → /dashboard
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "customer";
    const destination = role === "customer" ? "/app" : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // RBAC: block customers from /dashboard entirely
  if (user && pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "customer";

    // Customers belong in /app, not the admin/trainer dashboard
    if (role === "customer") {
      return NextResponse.redirect(new URL("/app", request.url));
    }

    // Trainers and admins: enforce admin-only sub-routes
    const isAdminOnly = ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route));
    if (isAdminOnly && role !== "admin" && role !== "trainer") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)"],
};
