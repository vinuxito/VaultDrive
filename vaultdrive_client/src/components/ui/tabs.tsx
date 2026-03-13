import React from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) => {
  return (
    <div
      role="tablist"
      className={`flex gap-1 border-b border-white/10 mb-6 overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-3 whitespace-nowrap
            border-b-2 transition-all duration-200
            ${
              activeTab === tab.id
                ? "border-[#7d4f50] text-[#c4999b] font-medium"
                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-white/20"
            }
            focus:outline-none focus:ring-2 focus:ring-[#7d4f50]/50 focus:ring-offset-2 focus:ring-offset-gray-900
            min-h-[44px]
          `}
        >
          {tab.icon && (
            <span className="flex-shrink-0 w-5 h-5">{tab.icon}</span>
          )}
          <span>{tab.label}</span>
          {tab.badge !== undefined && tab.badge > 0 && (
            <span
              className={`
                flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-medium
                ${
                  activeTab === tab.id
                    ? "bg-[#7d4f50]/20 text-[#c4999b]"
                    : "bg-white/5 text-gray-400"
                }
              `}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  activeTab,
  children,
  className = "",
}) => {
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={className}
    >
      {children}
    </div>
  );
};
