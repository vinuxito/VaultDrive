import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

/**
 * Compact pill-shaped language toggle (EN ↔ ES).
 * Uses i18next-browser-languagedetector for localStorage persistence.
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();

  const currentLang = i18n.language.startsWith("es") ? "es" : "en";

  const toggle = () => {
    void i18n.changeLanguage(currentLang === "es" ? "en" : "es");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 text-foreground text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer select-none"
      aria-label="Toggle language"
    >
      <Globe className="w-3.5 h-3.5" />
      {currentLang === "es" ? "ES" : "EN"}
    </button>
  );
}
