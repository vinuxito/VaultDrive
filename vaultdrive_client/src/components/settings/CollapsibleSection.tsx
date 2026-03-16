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
    <div className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          {description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open ? <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">{children}</div> : null}
    </div>
  );
}
