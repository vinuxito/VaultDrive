import { useState } from "react";
import { useTranslation } from "react-i18next";
import { branding } from "../../config/branding";
import { DashboardLayout } from "../../components/layout/dashboard-layout";
import { HelpSidebar } from "./components/HelpSidebar";
import { HelpContent } from "./components/HelpContent";

export type HelpSection = 
  | "getting_started" 
  | "vault_pin" 
  | "uploads_shares" 
  | "workspaces" 
  | "user_management" 
  | "agent_keys" 
  | "audit_logs";

export default function HelpCenter() {
  const { t } = useTranslation(["help"]);
  const [activeSection, setActiveSection] = useState<HelpSection>("getting_started");

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
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
        <div className="flex-1 overflow-hidden">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col md:flex-row">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 shrink-0 border-r border-primary/10 bg-background/30 overflow-y-auto">
              <HelpSidebar activeSection={activeSection} onSelect={setActiveSection} />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-background/50">
              <HelpContent activeSection={activeSection} />
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
