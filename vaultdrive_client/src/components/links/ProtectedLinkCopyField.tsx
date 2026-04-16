import { useId, useRef, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, X } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  buildMaskedProtectedLink,
  validateProtectedLinkForCopy,
  type ProtectedLinkKind,
} from "../../utils/protected-link-copy";

interface ProtectedLinkCopyFieldProps {
  label: string;
  rawUrl: string;
  expectedPath: string;
  kind: ProtectedLinkKind;
  copyButtonLabel: string;
  guidanceText: string;
  onResolveUrl: (pin: string) => Promise<string>;
  unavailableReason?: string;
  variant?: "light" | "dark";
}

function looksLikePinError(message: string): boolean {
  return /pin/i.test(message) || /didn't match/i.test(message);
}

function looksLikeClipboardError(message: string): boolean {
  return /clipboard|writetext|permission/i.test(message);
}

const variantStyles = {
  light: {
    field: "border-slate-200 bg-slate-50 text-slate-700",
    helper: "text-slate-500",
    info: "text-slate-600",
    error: "text-rose-600",
    button: "bg-[#7d4f50] text-white hover:bg-[#6b4345]",
    secondaryButton: "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
    label: "text-slate-700",
  },
  dark: {
    field: "border-white/20 bg-white/10 text-white/90",
    helper: "text-white/70",
    info: "text-white/80",
    error: "text-rose-200",
    button: "bg-white text-[#7d4f50] hover:bg-[#f2d7d8]",
    secondaryButton: "text-white/60 hover:text-white hover:bg-white/10",
    label: "text-white/90",
  },
} as const;

export function ProtectedLinkCopyField({
  label,
  rawUrl,
  expectedPath,
  kind,
  copyButtonLabel,
  guidanceText,
  onResolveUrl,
  unavailableReason,
  variant = "light",
}: ProtectedLinkCopyFieldProps) {
  const styles = variantStyles[variant];
  const fieldId = useId();
  const pinFieldId = `${fieldId}-pin`;
  const guidanceId = `${fieldId}-guidance`;
  const errorId = `${fieldId}-error`;
  const statusId = `${fieldId}-status`;
  const pinInputRef = useRef<HTMLInputElement | null>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [manualCopyUrl, setManualCopyUrl] = useState("");

  const displayValue = manualCopyUrl || buildMaskedProtectedLink(rawUrl, kind);

  const focusPinInput = () => {
    requestAnimationFrame(() => {
      pinInputRef.current?.focus();
      pinInputRef.current?.select();
    });
  };

  const resetCopyState = () => {
    setErrorMessage("");
    setStatusMessage("");
    setManualCopyUrl("");
  };

  const fallbackToManualCopy = (resolvedUrl: string) => {
    setShowPinPrompt(false);
    setPinValue("");
    setManualCopyUrl(resolvedUrl);
    setStatusMessage("");
    setErrorMessage("Clipboard is unavailable. Select the full URL and copy it manually.");
  };

  const openPinPrompt = () => {
    if (unavailableReason) {
      setShowPinPrompt(false);
      setStatusMessage("");
      setManualCopyUrl("");
      setErrorMessage(unavailableReason);
      return;
    }

    resetCopyState();
    setPinValue("");
    setShowPinPrompt(true);
    focusPinInput();
  };

  const closePinPrompt = () => {
    setShowPinPrompt(false);
    setPinValue("");
  };

  const handleVerifyAndCopy = async () => {
    if (!/^\d{4}$/.test(pinValue)) {
      setErrorMessage("Enter your 4-digit PIN.");
      focusPinInput();
      return;
    }

    setIsResolving(true);
    setErrorMessage("");

    try {
      const resolvedUrl = await onResolveUrl(pinValue);
      const validation = validateProtectedLinkForCopy(resolvedUrl, { expectedPath, kind });

      if (!validation.ok) {
        setShowPinPrompt(false);
        setErrorMessage(validation.error);
        return;
      }

      if (!navigator.clipboard?.writeText) {
        fallbackToManualCopy(validation.url);
        return;
      }

      try {
        await navigator.clipboard.writeText(validation.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Clipboard is unavailable.";
        if (looksLikeClipboardError(message)) {
          fallbackToManualCopy(validation.url);
          return;
        }
        throw error;
      }

      setShowPinPrompt(false);
      setPinValue("");
      setManualCopyUrl("");
      setErrorMessage("");
      setStatusMessage("Copied!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy the full URL.";
      setStatusMessage("");
      setErrorMessage(message);

      if (looksLikePinError(message)) {
        setPinValue("");
        setShowPinPrompt(true);
        focusPinInput();
      }
    } finally {
      setIsResolving(false);
    }
  };

  const shouldShowGuidance = !statusMessage && !errorMessage && !manualCopyUrl;
  const pinDescribedBy = [
    shouldShowGuidance ? guidanceId : null,
    errorMessage ? errorId : null,
    statusMessage ? statusId : null,
  ].filter(Boolean).join(" ");
  const pinIsInvalid = Boolean(errorMessage);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={fieldId} className={`text-sm font-medium ${styles.label}`}>
          {label}
        </label>
        <div className="flex gap-2">
          <textarea
            id={fieldId}
            readOnly
            rows={manualCopyUrl ? 3 : 2}
            value={displayValue}
            className={`w-full rounded-md border px-3 py-2 text-xs resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${styles.field}`}
            onClick={(event) => (event.target as HTMLTextAreaElement).select()}
          />
          <Button
            type="button"
            onClick={openPinPrompt}
            className={`h-auto min-h-10 shrink-0 gap-1.5 px-3 py-2 font-semibold ${styles.button}`}
            aria-describedby={`${guidanceId} ${statusId} ${errorId}`}
          >
            {statusMessage === "Copied!" ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copyButtonLabel}
          </Button>
        </div>
      </div>

      {showPinPrompt && (
        <div className="space-y-2 rounded-xl border border-current/10 px-3 py-3">
          <label htmlFor={pinFieldId} className={`text-xs font-medium uppercase tracking-[0.14em] ${styles.helper}`}>
            4-digit PIN
          </label>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                ref={pinInputRef}
                id={pinFieldId}
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pinValue}
                onChange={(event) => {
                  setPinValue(event.target.value.replace(/\D/g, "").slice(0, 4));
                  setErrorMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleVerifyAndCopy();
                  }
                }}
                placeholder="••••"
                className={styles.field}
                aria-label="4-digit PIN"
                aria-describedby={pinDescribedBy || undefined}
                aria-invalid={pinIsInvalid}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleVerifyAndCopy()}
              disabled={isResolving}
              className={`gap-1.5 font-semibold ${styles.button}`}
              aria-label="Verify PIN and copy"
            >
              {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Verify
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={closePinPrompt}
              className={styles.secondaryButton}
              aria-label="Cancel PIN entry"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {shouldShowGuidance && (
        <p id={guidanceId} className={`text-xs leading-relaxed ${styles.helper}`}>
          {guidanceText}
        </p>
      )}

      {errorMessage && (
        <p id={errorId} className={`text-xs leading-relaxed ${styles.error}`}>
          {errorMessage}
        </p>
      )}

      <p id={statusId} role="status" aria-live="polite" className={`text-xs font-medium ${styles.info}`}>
        {statusMessage}
      </p>
    </div>
  );
}
