import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require admin or trainer role
const ADMIN_ONLY_ROUTES = ["/dashboard/members", "/dashboard/finance", "/dashboard/settings"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // RBAC: check role before allowing access to protected routes
  if (user) {
    const isProtectedRoute = ADMIN_ONLY_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role ?? "customer";

      if (role !== "admin" && role !== "trainer") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)"],
};
