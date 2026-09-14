import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { mutate } from "swr";
import type { ReactNode } from "react";

afterEach(() => {
  cleanup();
  // Clear SWR cache globally after each test
  mutate(() => true, undefined, { revalidate: false });
});

import enAuth from "./locales/en/auth.json";
import enDrive from "./locales/en/drive.json";
import enCommon from "./locales/en/common.json";
import enSettings from "./locales/en/settings.json";
import { MotionGlobalConfig } from "framer-motion";

MotionGlobalConfig.skipAnimations = true;

type TranslationValue = string | Record<string, unknown>;

const resources: Record<string, Record<string, unknown>> = {
  auth: enAuth,
  drive: enDrive,
  common: enCommon,
  settings: enSettings,
};

function readTranslation(root: unknown, keys: string[]): TranslationValue | undefined {
  let value = root;
  for (const key of keys) {
    if (typeof value !== "object" || value === null || !(key in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value === "string" || (typeof value === "object" && value !== null)) {
    return value as TranslationValue;
  }
  return undefined;
}

vi.mock("react-i18next", () => ({
  useTranslation: (ns: string | string[] = "common") => {
    const namespace = Array.isArray(ns) ? ns[0] : ns;
    return {
      t: (key: string, options?: Record<string, unknown>) => {
        const parts = key.split(":");
        const actualNs = parts.length > 1 ? parts[0] : namespace;
        const actualKey = parts.length > 1 ? parts[1] : parts[0];
        
        let val = readTranslation(resources[actualNs], actualKey.split('.'));
        if (!val) return key;
        
        if (typeof val === "string" && typeof options?.product === "string") {
          val = val.replace("{{product}}", options.product);
        }
        return val;
      },
      i18n: {
        changeLanguage: () => new Promise(() => {}),
        language: "en",
      },
    };
  },
  Trans: ({ children }: { children?: ReactNode }) => children,
  initReactI18next: {
    type: "3rdParty",
    init: () => {},
  },
}));
