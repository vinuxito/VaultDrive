import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import enAuth from "./locales/en/auth.json";
import enDrive from "./locales/en/drive.json";
import enCommon from "./locales/en/common.json";
import enSettings from "./locales/en/settings.json";

const resources: Record<string, Record<string, any>> = {
  auth: enAuth,
  drive: enDrive,
  common: enCommon,
  settings: enSettings,
};

vi.mock("react-i18next", () => ({
  useTranslation: (ns: string | string[] = "common") => {
    const namespace = Array.isArray(ns) ? ns[0] : ns;
    return {
      t: (key: string, options?: any) => {
        const parts = key.split(":");
        const actualNs = parts.length > 1 ? parts[0] : namespace;
        const actualKey = parts.length > 1 ? parts[1] : parts[0];
        
        let val = actualKey.split('.').reduce((o, i) => o ? o[i] : null, resources[actualNs] as any);
        if (!val) return key;
        
        if (options && options.product) {
          val = (val as string).replace("{{product}}", options.product);
        }
        return val;
      },
      i18n: {
        changeLanguage: () => new Promise(() => {}),
        language: "en",
      },
    };
  },
  Trans: ({ children }: any) => children,
  initReactI18next: {
    type: "3rdParty",
    init: () => {},
  },
}));
