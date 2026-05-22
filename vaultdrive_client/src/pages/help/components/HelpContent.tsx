import { useTranslation } from "react-i18next";
import { branding } from "../../../config/branding";
import type { HelpSection } from "../index";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface HelpContentProps {
  activeSection: HelpSection;
}

export function HelpContent({ activeSection }: HelpContentProps) {
  const { t } = useTranslation(["help"]);
  
  // Use returnObjects to get the full JSON tree for the active section
  const sectionData = t(`help:content.${activeSection}`, { 
    returnObjects: true,
    product: branding.productName 
  }) as any;

  if (!sectionData || typeof sectionData !== "object") {
    return <div className="text-muted-foreground p-8">Loading manual...</div>;
  }

  const { title, paragraphs = [], bulletPoints = [], callout } = sectionData;

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <h2 className="text-3xl font-bold tracking-tight text-foreground mb-6">
        {title}
      </h2>

      <div className="space-y-6 text-lg text-foreground/90 leading-relaxed">
        {paragraphs.map((p: string, idx: number) => (
          <p key={idx}>{p}</p>
        ))}

        {bulletPoints.length > 0 && (
          <ul className="list-disc list-outside ml-6 space-y-2 mt-6">
            {bulletPoints.map((bp: string, idx: number) => (
              <li key={idx} className="pl-2">{bp}</li>
            ))}
          </ul>
        )}
      </div>

      {callout && callout.title && (
        <div className={`mt-10 p-6 rounded-xl border flex gap-4 items-start ${
          callout.type === 'warning' 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' 
            : 'bg-primary/10 border-primary/20 text-primary dark:text-primary'
        }`}>
          <div className="shrink-0 mt-1">
            {callout.type === 'warning' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-2">{callout.title}</h4>
            <p className="opacity-90 leading-relaxed">{callout.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
