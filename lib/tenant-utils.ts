import { createAdminClient } from "@/lib/supabase/admin";

export type TenantBrandingColors = {
  primary?: string;
  base?: string;
  surface1?: string;
  surface2?: string;
};

export type TenantBranding = {
  name: string;
  logoUrl: string | null;
  colors: TenantBrandingColors;
};

type WhiteLabelSettings = {
  logo_url?: string | null;
  colors?: {
    primary?: string;
    base?: string;
    surface_1?: string;
    surface_2?: string;
  };
};

/**
 * Resolves white-label branding (name, logo, theme colors) for the gym
 * matching `slug`. Uses the service_role client — this table isn't opened
 * to RLS for branding reads, so this must only ever run in a Server
 * Component/Action, never in client-side code.
 */
export async function getTenantBranding(slug: string): Promise<TenantBranding | null> {
  if (!slug) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gyms")
    .select("name, white_label_settings")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const settings = (data.white_label_settings ?? {}) as WhiteLabelSettings;

  return {
    name: data.name,
    logoUrl: settings.logo_url ?? null,
    colors: {
      primary: settings.colors?.primary,
      base: settings.colors?.base,
      surface1: settings.colors?.surface_1,
      surface2: settings.colors?.surface_2,
    },
  };
}

const CSS_VAR_MAP: { key: keyof TenantBrandingColors; cssVar: string }[] = [
  { key: "primary", cssVar: "--color-primary" },
  { key: "base", cssVar: "--color-base" },
  { key: "surface1", cssVar: "--color-surface-1" },
  { key: "surface2", cssVar: "--color-surface-2" },
];

/**
 * Builds a `:root { --color-x: ... }` override block for the given branding
 * colors. Returns null when there's nothing to override (missing/empty
 * colors), so the default SIMP theme in globals.css applies untouched.
 */
export function buildThemeOverrideCss(colors: TenantBrandingColors): string | null {
  const declarations = CSS_VAR_MAP.filter(({ key }) => colors[key]).map(
    ({ key, cssVar }) => `${cssVar}: ${colors[key]};`,
  );

  if (declarations.length === 0) return null;
  return `:root { ${declarations.join(" ")} }`;
}
