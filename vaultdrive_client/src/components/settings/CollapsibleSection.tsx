import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function CollapsibleSection({ title, description, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[1.6rem] border border-border bg-background shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open ? <div className="border-t border-border px-5 py-4">{children}</div> : null}
    </div>
  );
}
