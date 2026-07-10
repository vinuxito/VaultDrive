import { useState } from "react";
import { Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  isWebAuthnAvailable,
  hasRegisteredPasskey,
  registerPasskey,
  removePasskey,
} from "../../hooks/useWebAuthn";

interface WebAuthnSectionProps {
  userId: string;
  onPinRequired: (callback: (pin: string) => void) => void;
}

export function WebAuthnSection({ userId, onPinRequired }: WebAuthnSectionProps) {
  const available = isWebAuthnAvailable();
  const [registered, setRegistered] = useState(hasRegisteredPasskey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!available) {
    return (
      <div className="py-2">
        <p className="text-xs text-muted-foreground">
          Biometric unlock (Touch ID / Face ID) is not supported in this browser.
        </p>
      </div>
    );
  }

  const handleEnable = () => {
    onPinRequired((pin) => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      registerPasskey(userId, pin)
        .then(() => {
          setRegistered(true);
          setSuccess("Biometric unlock successfully configured!");
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Passkey registration failed");
        })
        .finally(() => {
          setLoading(false);
        });
    });
  };

  const handleDisable = async () => {
    setError(null);
    setSuccess(null);
    try {
      await removePasskey();
      setRegistered(false);
      setSuccess("Biometric unlock successfully removed.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove passkey");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {registered ? "Biometric Unlock Enabled" : "Biometric Quick Unlock"}
          </p>
          <p className="text-xs text-muted-foreground">
            {registered
              ? "Your vault can be unlocked using Touch ID / Face ID."
              : "Register a passkey to unlock your vault instantly without typing your PIN."}
          </p>
        </div>
        <div className="shrink-0">
          {registered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisable}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Disable
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleEnable}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              {loading ? "Configuring..." : "Enable"}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400 font-medium">{success}</p>}
    </div>
  );
}
