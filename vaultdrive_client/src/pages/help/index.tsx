import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { branding } from "../../config/branding";
import { HelpSidebar } from "./components/HelpSidebar";
import { HelpContent } from "./components/HelpContent";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";

export type HelpSection = 
  | "getting_started" 
  | "vault_pin" 
  | "uploads_shares" 
  | "drop_portals"
  | "workspaces" 
  | "user_management" 
  | "agent_keys" 
  | "audit_logs"
  | "system_settings";

const USER_HELP_SECTIONS: readonly HelpSection[] = [
  "getting_started",
  "vault_pin",
  "uploads_shares",
  "drop_portals",
  "workspaces",
];

const ADMIN_HELP_SECTIONS: readonly HelpSection[] = [
  "user_management",
  "agent_keys",
  "audit_logs",
  "system_settings",
];

export default function HelpCenter() {
  const { t } = useTranslation(["help"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const storedUser = getStoredUserFromLocalStorage();
  const allowedSections = storedUser?.is_admin === true
    ? [...USER_HELP_SECTIONS, ...ADMIN_HELP_SECTIONS]
    : USER_HELP_SECTIONS;
  const requestedSection = searchParams.get("section") as HelpSection | null;
  const activeSection = requestedSection && allowedSections.includes(requestedSection)
    ? requestedSection
    : "getting_started";

  const selectSection = (section: HelpSection) => {
    if (allowedSections.includes(section)) {
      setSearchParams({ section });
    }
  };

  return (
    <div className="flex min-h-full flex-col md:h-[calc(100dvh-4rem)]">
        {/* Header */}
        <div className="shrink-0 border-b border-primary/10 bg-background/50 backdrop-blur-md px-6 py-8">
          <div className="max-w-6xl mx-auto w-full">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {t("help:title", { product: branding.productName })}
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              {t("help:subtitle", { product: branding.productName })}
            </p>
          </div>
        </div>

        {/* 2-pane layout */}
        <div className="flex-1 md:overflow-hidden" data-testid="help-layout">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col md:flex-row">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 shrink-0 border-r border-primary/10 bg-background/30 overflow-y-auto">
              <HelpSidebar activeSection={activeSection} onSelect={selectSection} />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-visible p-6 md:overflow-y-auto md:p-10 bg-background/50" data-testid="help-content">
              <HelpContent activeSection={activeSection} />
            </div>

          </div>
        </div>
    </div>
  );
}
