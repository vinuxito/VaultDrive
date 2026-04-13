/* @refresh reset */
import { createContext, useContext, useEffect, useState } from "react";

export type Skin = "quantix" | "light" | "dark" | "cyberpunk" | "elegant" | "business";

export interface SkinMeta {
  id: Skin;
  label: string;
  swatchBg: string;
  swatchPrimary: string;
  swatchAccent: string;
  isDark: boolean;
}

export const SKINS: SkinMeta[] = [
  { id: "quantix",   label: "QuantiX",   swatchBg: "#0a0a1a", swatchPrimary: "#01fff7", swatchAccent: "#ea12ff", isDark: true  },
  { id: "light",     label: "Light",     swatchBg: "#faf8f5", swatchPrimary: "#7d4f50", swatchAccent: "#c4999b", isDark: false },
  { id: "dark",      label: "Dark",      swatchBg: "#1e2330", swatchPrimary: "#c4999b", swatchAccent: "#7d4f50", isDark: true  },
  { id: "cyberpunk", label: "Cyberpunk", swatchBg: "#0d0d0d", swatchPrimary: "#f0ff00", swatchAccent: "#ff0090", isDark: true  },
  { id: "elegant",   label: "Elegant",   swatchBg: "#1a1208", swatchPrimary: "#b8860b", swatchAccent: "#d4a017", isDark: true  },
  { id: "business",  label: "Business",  swatchBg: "#f8fafc", swatchPrimary: "#1e40af", swatchAccent: "#3b82f6", isDark: false },
];

function resolveSystemSkin(): Skin {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "quantix" : "light";
}

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultSkin?: Skin;
  storageKey?: string;
  /* legacy compat — prefer defaultSkin */
  defaultTheme?: "light" | "dark" | "system";
};

type ThemeProviderState = {
  skin: Skin;
  setSkin: (skin: Skin) => void;
  /* legacy shim — use skin/setSkin in new code */
  theme: "light" | "dark";
  /* legacy shim — maps "dark"→dark skin, "light"→light skin */
  setTheme: (t: "light" | "dark") => void;
};

const initialState: ThemeProviderState = {
  skin: "quantix",
  setSkin: () => null,
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultSkin = "quantix",
  storageKey = "quantixdrive-skin",
  defaultTheme,
  ...props
}: ThemeProviderProps) {
  const [skin, setSkinState] = useState<Skin>(() => {
    // Check new key first
    const stored = localStorage.getItem(storageKey) as Skin | null;
    if (stored && SKINS.some((s) => s.id === stored)) return stored;
    // Migrate legacy key
    const legacy = localStorage.getItem("vaultdrive-ui-theme");
    if (legacy === "dark") return "dark";
    if (legacy === "light") return "light";
    // System preference
    if (defaultTheme === "system") return resolveSystemSkin();
    return defaultSkin;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const meta = SKINS.find((s) => s.id === skin)!;

    root.removeAttribute("data-theme");
    root.classList.remove("dark");

    root.setAttribute("data-theme", skin);
    if (meta.isDark) root.classList.add("dark");
  }, [skin]);

  const setSkin = (next: Skin) => {
    localStorage.setItem(storageKey, next);
    setSkinState(next);
  };

  const meta = SKINS.find((s) => s.id === skin)!;
  const theme: "light" | "dark" = meta.isDark ? "dark" : "light";
  const setTheme = (t: "light" | "dark") => setSkin(t === "dark" ? "dark" : "light");

  const value: ThemeProviderState = { skin, setSkin, theme, setTheme };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
