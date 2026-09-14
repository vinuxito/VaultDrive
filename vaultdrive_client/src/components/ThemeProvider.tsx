/* @refresh reset */
import { useEffect, useState } from "react";
import { SKINS, ThemeProviderContext, type Skin, type ThemeProviderState } from "./theme-context";

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

  const setSkin = (next: Skin, event?: React.MouseEvent | MouseEvent) => {
    localStorage.setItem(storageKey, next);
    
    const doc = document;
    if (event && doc.startViewTransition) {
      let x = event.clientX;
      let y = event.clientY;
      
      // Harden: fallback to target element center if coordinates are zero or undefined
      if (x === undefined || y === undefined || (x === 0 && y === 0)) {
        const target = event.target as HTMLElement;
        if (target && typeof target.getBoundingClientRect === "function") {
          const rect = target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        } else {
          x = window.innerWidth / 2;
          y = window.innerHeight / 2;
        }
      }
      
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      
      try {
        const transition = doc.startViewTransition(() => {
          setSkinState(next);
        });
        
        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
            },
            {
              duration: 450,
              easing: "cubic-bezier(0.4, 0, 0.2, 1)",
              pseudoElement: "::view-transition-new(root)"
            }
          );
        }).catch((err: unknown) => {
          console.warn("View transition animation failed:", err);
        });
      } catch (err) {
        console.warn("startViewTransition failed, falling back:", err);
        setSkinState(next);
      }
    } else {
      setSkinState(next);
    }
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
