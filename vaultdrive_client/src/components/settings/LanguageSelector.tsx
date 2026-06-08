import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Globe } from "lucide-react";

export function LanguageSelector() {
  const { t, i18n } = useTranslation(["settings"]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    void i18n.changeLanguage(newLang);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {t("settings:language.title")}
        </CardTitle>
        <CardDescription>
          {t("settings:language.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs">
          <select
            value={i18n.language.startsWith("es") ? "es" : "en"}
            onChange={handleLanguageChange}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="en">{t("settings:language.english")}</option>
            <option value="es">{t("settings:language.spanish")}</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
