import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Generate a PWA manifest.json at build time from VITE_* env vars so the
 * manifest name/scope/start_url/icons match the active branding config.
 */
function brandManifestPlugin(env: Record<string, string>): Plugin {
  const productName = env.VITE_PRODUCT_NAME || "QuantiX Drive";
  const rawBase = env.VITE_BASE_PATH || "/quantix";
  const basePathWithSlash = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  const primaryColor = env.VITE_PRIMARY_COLOR || "#4f46e5";
  const backgroundColor = env.VITE_BACKGROUND_COLOR || "#0f172a";
  // Icon path/type overridable via env so downstream brands can supply their own PWA icon.
  const iconPath = env.VITE_BRAND_ICON_PATH
    ? `${basePathWithSlash}${env.VITE_BRAND_ICON_PATH.replace(/^\//, "")}`
    : `${basePathWithSlash}vault.svg`;
  const iconType = env.VITE_BRAND_ICON_TYPE || "image/svg+xml";
  const manifest = {
    name: productName,
    short_name: productName,
    description: "Zero-knowledge encrypted cloud drive",
    start_url: basePathWithSlash,
    scope: basePathWithSlash,
    display: "standalone",
    background_color: backgroundColor,
    theme_color: primaryColor,
    icons: [
      { src: iconPath, sizes: "192x192", type: iconType },
      { src: iconPath, sizes: "512x512", type: iconType },
    ],
  };

  return {
    name: "brand-manifest-generator",
    // Run on dev and build — write to public/ so the existing path works.
    buildStart() {
      const publicDir = path.resolve(__dirname, "public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(publicDir, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rawBase = env.VITE_BASE_PATH || "/quantix";
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base,
    plugins: [react(), tailwindcss(), brandManifestPlugin(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            lucide: ["lucide-react"],
            i18n: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
            crypto: ["jszip"],
            radix: [
              "@radix-ui/react-avatar",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-label",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tooltip",
            ],
            motion: ["framer-motion"],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/vitest.setup.ts",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["e2e/**", "playwright-report/**", "test-results/**"],
      testTimeout: 15000,
    },
  };
});
