/**
 * Branding configuration — read from Vite env vars at build time.
 *
 * Defaults are QuantiX Drive (the generic upstream product).
 * Branded downstream deployments override via `.env.local` or
 * environment variables at build time.
 */

export type BrandLogoVariant = string;

export interface BrandingConfig {
  /** Canonical product name, e.g. "QuantiX Drive" */
  productName: string;
  /** Short product slug, e.g. "quantix-drive" — used for filenames, ids */
  productSlug: string;
  /** Company / operator name, e.g. "QuantiX" */
  companyName: string;
  /** Which logo component to render */
  logoVariant: BrandLogoVariant;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Accent brand color (hex) */
  accentColor: string;
  /** Landing-page tagline shown below the headline */
  landingTagline: string;
  /** Footer copyright line (overrides default `© YEAR COMPANY`) */
  copyrightNotice: string;
  /** Public base URL for client-side absolute URLs */
  publicBaseURL: string;
  /** Marketing / homepage URL shown on public landing pages */
  marketingURL: string;
  /** API base path, e.g. "/api" */
  apiBasePath: string;
  /** SPA base path, e.g. "/quantix" — NO trailing slash */
  basePath: string;
  /**
   * Hosts where the app is served at the root (no SPA base path prefix).
   * Used by `base-path.ts` to strip the SPA base path on prod hosts that
   * don't need the prefix.
   */
  rootHostedHosts: string[];
  /** Agent API key prefix (matches backend PRODUCT_AGENT_KEY_PREFIX), e.g. "qx_ak" */
  agentKeyPrefix: string;
  /** Bash env var name used in dev portal docs, e.g. "QX_KEY" */
  agentKeyEnvVar: string;
}

function cleanEnv(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function parseCSV(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const branding: BrandingConfig = {
  productName: cleanEnv(import.meta.env.VITE_PRODUCT_NAME, "QuantiX Drive"),
  productSlug: cleanEnv(import.meta.env.VITE_PRODUCT_SLUG, "quantix-drive"),
  companyName: cleanEnv(import.meta.env.VITE_COMPANY_NAME, "QuantiX"),
  logoVariant: (cleanEnv(import.meta.env.VITE_LOGO_VARIANT, "quantix") as BrandLogoVariant),
  primaryColor: cleanEnv(import.meta.env.VITE_PRIMARY_COLOR, "#4f46e5"),
  accentColor: cleanEnv(import.meta.env.VITE_ACCENT_COLOR, "#6366f1"),
  landingTagline: cleanEnv(import.meta.env.VITE_LANDING_TAGLINE, "Coded for Excellence"),
  copyrightNotice: cleanEnv(import.meta.env.VITE_COPYRIGHT_NOTICE, ""),
  publicBaseURL: cleanEnv(import.meta.env.VITE_PUBLIC_BASE_URL, "https://app.quantixdrive.io"),
  marketingURL: cleanEnv(import.meta.env.VITE_MARKETING_URL, "https://quantixdrive.io"),
  apiBasePath: cleanEnv(import.meta.env.VITE_API_URL, "/api"),
  basePath: cleanEnv(import.meta.env.VITE_BASE_PATH, "/quantix").replace(/\/$/, ""),
  rootHostedHosts: parseCSV(cleanEnv(import.meta.env.VITE_ROOT_HOSTED_HOSTS, "")),
  agentKeyPrefix: cleanEnv(import.meta.env.VITE_AGENT_KEY_PREFIX, "qx_ak"),
  agentKeyEnvVar: cleanEnv(import.meta.env.VITE_AGENT_KEY_ENV_VAR, "QX_KEY"),
};

/** Default copyright line derived from companyName if none provided. */
export function getCopyrightLine(): string {
  if (branding.copyrightNotice.length > 0) {
    return branding.copyrightNotice;
  }
  return `© ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.`;
}
