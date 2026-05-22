import { Upload, Link2, Users, Layers } from "lucide-react";

export type FileOrigin =
  | { type: "my-upload" }
  | { type: "drop"; linkName: string }
  | { type: "shared"; sharedBy: string }
  | { type: "group"; groupName: string };

interface OriginBadgeProps {
  origin: FileOrigin;
  size?: "sm" | "md";
}

const configs: Record<FileOrigin["type"], { bg: string; text: string; border: string }> = {
  "my-upload": {
    bg: "bg-muted",
    text: "text-foreground",
    border: "border-border",
  },
  drop: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
  shared: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  group: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
};

export function OriginBadge({ origin, size = "sm" }: OriginBadgeProps) {
  const cfg = configs[origin.type];
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  let icon: React.ReactNode;
  let label: string;

  switch (origin.type) {
    case "my-upload":
      icon = <Upload className={iconSize} />;
      label = "Vault";
      break;
    case "drop":
      icon = <Link2 className={iconSize} />;
      label = `Drop: ${origin.linkName}`;
      break;
    case "shared":
      icon = <Users className={iconSize} />;
      label = `@${origin.sharedBy}`;
      break;
    case "group":
      icon = <Layers className={iconSize} />;
      label = origin.groupName;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClass}`}
    >
      {icon}
      {label}
    </span>
  );
}
