import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { WorkoutSessionProvider } from "@/lib/workout-session-store";
import { WorkoutSessionHost } from "@/app/components/app/WorkoutSessionHost";
import { getTenantBranding, buildThemeOverrideCss } from "@/lib/tenant-utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIMP - Academia",
  description: "Plataforma gamificada para gestão de academias",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SIMP",
  },
  formatDetection: { telephone: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // White-label theming: resolved from the subdomain slug the middleware
  // injects as x-tenant-slug. No slug (Master platform, bare domain) or no
  // matching gym/colors falls back to the default SIMP theme untouched.
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");
  const branding = tenantSlug ? await getTenantBranding(tenantSlug) : null;
  const themeOverrideCss = branding ? buildThemeOverrideCss(branding.colors) : null;

  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <head>
        {themeOverrideCss && (
          <style dangerouslySetInnerHTML={{ __html: themeOverrideCss }} />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-base text-foreground">
        <WorkoutSessionProvider>
          {children}
          <WorkoutSessionHost />
        </WorkoutSessionProvider>
      </body>
    </html>
  );
}
