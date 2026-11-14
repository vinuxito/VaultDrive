import { createContext, useContext } from "react";

export type Skin = "quantix" | "light" | "dark" | "oled" | "cyberpunk" | "elegant" | "business";

export interface SkinMeta {
  id: Skin;
  label: string;
  swatchBg: string;
  swatchPrimary: string;
  swatchAccent: string;
  isDark: boolean;
}

export const SKINS: SkinMeta[] = [
  { id: "quantix",   label: "QuantiX",    swatchBg: "#090a12", swatchPrimary: "#06b6d4", swatchAccent: "#7c3aed", isDark: true  },
  { id: "light",     label: "ABRN Cream", swatchBg: "#faf8f5", swatchPrimary: "#7a1f2b", swatchAccent: "#7d4f50", isDark: false },
  { id: "dark",      label: "ABRN Slate", swatchBg: "#1e2330", swatchPrimary: "#c4999b", swatchAccent: "#7d4f50", isDark: true  },
  { id: "oled",      label: "ABRN OLED",  swatchBg: "#030712", swatchPrimary: "#eab5b8", swatchAccent: "#34d399", isDark: true  },
  { id: "cyberpunk", label: "Cyberpunk",  swatchBg: "#0d0d0d", swatchPrimary: "#f0ff00", swatchAccent: "#ff0090", isDark: true  },
  { id: "elegant",   label: "Elegant",    swatchBg: "#1a1208", swatchPrimary: "#d4af37", swatchAccent: "#b8860b", isDark: true  },
  { id: "business",  label: "Business",   swatchBg: "#f8fafc", swatchPrimary: "#1e40af", swatchAccent: "#3b82f6", isDark: false },
];

export type ThemeProviderState = {
  skin: Skin;
  setSkin: (skin: Skin, event?: React.MouseEvent | MouseEvent) => void;
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

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
