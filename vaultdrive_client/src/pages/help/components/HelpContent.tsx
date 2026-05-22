import { useTranslation } from "react-i18next";
import { branding } from "../../../config/branding";
import type { HelpSection } from "../index";

interface HelpContentProps {
  activeSection: HelpSection;
}

export function HelpContent({ activeSection }: HelpContentProps) {
  const { t } = useTranslation(["help"]);

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">
          {t(`help:content.${activeSection}.title` as any)}
        </h2>
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-lg">
          <p>
            {t(`help:content.${activeSection}.body` as any, { product: branding.productName })}
          </p>
        </div>
      </div>

      {/* Conditional rendering for specific interactive elements or rich media per section could go here */}
      {activeSection === "vault_pin" && (
        <div className="mt-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <h4 className="text-amber-600 dark:text-amber-400 font-semibold mb-2">Zero-Knowledge Guarantee</h4>
          <p className="text-amber-700/80 dark:text-amber-400/80">
            Because {branding.productName} uses Zero-Knowledge architecture, we cannot recover your files if you lose your PIN. Your encryption keys never leave your browser unencrypted.
          </p>
        </div>
      )}

      {activeSection === "uploads_shares" && (
        <div className="mt-8 p-6 bg-primary/10 border border-primary/20 rounded-xl">
          <h4 className="text-primary font-semibold mb-2">End-to-End Encryption</h4>
          <p className="text-primary/80">
            Every file is encrypted on your device using AES-256-GCM before it is uploaded. Our servers only store the encrypted ciphertext.
          </p>
        </div>
      )}
    </div>
  );
}
