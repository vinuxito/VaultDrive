import { useId, useRef, useState, useEffect } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, X } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useSessionVault } from "../../context/SessionVaultContext";
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

const semanticStyles = {
  field: "border-border bg-background text-foreground placeholder:text-muted-foreground",
  helper: "text-muted-foreground",
  info: "text-muted-foreground",
  error: "text-destructive",
  button: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondaryButton: "text-muted-foreground hover:text-foreground hover:bg-muted",
  label: "text-foreground",
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
}: ProtectedLinkCopyFieldProps) {
  const { getCredential } = useSessionVault();
  const styles = semanticStyles;
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

  useEffect(() => {
    if (statusMessage === "Copied!") {
      const timer = setTimeout(() => {
        setStatusMessage("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

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

  const openPinPrompt = () => {
    if (unavailableReason) {
      setShowPinPrompt(false);
      setStatusMessage("");
      setManualCopyUrl("");
      setErrorMessage(unavailableReason);
      return;
    }

    const autoCred = getCredential ? getCredential() : null;
    if (autoCred && autoCred.type === "pin" && /^\d{4}$/.test(autoCred.value)) {
      setIsResolving(true);
      resetCopyState();
      onResolveUrl(autoCred.value)
        .then(async (resolvedUrl) => {
          const validation = validateProtectedLinkForCopy(resolvedUrl, { expectedPath, kind });

          if (!validation.ok) {
            setErrorMessage(validation.error);
            return;
          }

          if (!navigator.clipboard?.writeText) {
            setManualCopyUrl(validation.url);
            setErrorMessage("Clipboard is unavailable. Select the full URL and copy it manually.");
            return;
          }

          await navigator.clipboard.writeText(validation.url);
          setStatusMessage("Copied!");
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Failed to copy link.";
          setErrorMessage(message);
          setShowPinPrompt(true);
          focusPinInput();
        })
        .finally(() => {
          setIsResolving(false);
        });
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
        setShowPinPrompt(false);
        setPinValue("");
        setManualCopyUrl(validation.url);
        setStatusMessage("");
        setErrorMessage("Clipboard is unavailable. Select the full URL and copy it manually.");
        return;
      }

      await navigator.clipboard.writeText(validation.url);
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
          <div className="relative flex-1">
            <textarea
              id={fieldId}
              readOnly
              rows={manualCopyUrl ? 3 : 2}
              value={displayValue}
              className={`w-full rounded-md border px-3 py-2 text-xs resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-300 ${
                statusMessage === "Copied!"
                  ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                  : styles.field
              }`}
              onClick={(event) => (event.target as HTMLTextAreaElement).select()}
            />
            {statusMessage === "Copied!" && (
              <span className="absolute top-1 right-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-primary text-primary-foreground border border-primary animate-pulse">
                Copied!
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={openPinPrompt}
            className={`h-auto min-h-10 shrink-0 gap-1.5 px-3 py-2 font-semibold transition-all duration-300 ${styles.button}`}
            aria-describedby={`${guidanceId} ${statusId} ${errorId}`}
          >
            {statusMessage === "Copied!" ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {statusMessage === "Copied!" ? "Copied!" : copyButtonLabel}
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
