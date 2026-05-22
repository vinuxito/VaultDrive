import { useTranslation } from "react-i18next";
import { getStoredUserFromLocalStorage } from "../../../utils/browser-storage";
import { cn } from "../../../lib/utils";
import type { HelpSection } from "../index";

interface HelpSidebarProps {
  activeSection: HelpSection;
  onSelect: (section: HelpSection) => void;
}

export function HelpSidebar({ activeSection, onSelect }: HelpSidebarProps) {
  const { t } = useTranslation(["help"]);
  const user = getStoredUserFromLocalStorage();
  const isAdmin = user?.is_admin === true;

  const userSections: { id: HelpSection; label: string }[] = [
    { id: "getting_started", label: t("help:navigation.getting_started") },
    { id: "vault_pin", label: t("help:navigation.vault_pin") },
    { id: "uploads_shares", label: t("help:navigation.uploads_shares") },
    { id: "drop_portals", label: t("help:navigation.drop_portals") },
    { id: "workspaces", label: t("help:navigation.workspaces") },
  ];

  const adminSections: { id: HelpSection; label: string }[] = [
    { id: "user_management", label: t("help:navigation.user_management") },
    { id: "agent_keys", label: t("help:navigation.agent_keys") },
    { id: "audit_logs", label: t("help:navigation.audit_logs") },
    { id: "system_settings", label: t("help:navigation.system_settings") },
  ];

  return (
    <nav className="p-4 space-y-6">
      <div>
        <h3 className="mb-2 px-3 text-sm font-bold tracking-wider text-muted-foreground uppercase">
          {t("help:navigation.user_guide")}
        </h3>
        <ul className="space-y-1">
          {userSections.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  activeSection === s.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && (
        <div>
          <h3 className="mb-2 px-3 text-sm font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            {t("help:navigation.admin_guide")}
          </h3>
          <ul className="space-y-1">
            {adminSections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    activeSection === s.id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
