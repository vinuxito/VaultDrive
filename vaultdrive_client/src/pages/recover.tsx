import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Key,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { branding } from "../config/branding";
import { useTheme } from "../components/theme-provider";
import { hexToBytes, encryptPrivateKeyWithPassword } from "../utils/crypto";
import { shamirReconstruct, type ShamirShare } from "../utils/shamir";
import { getNormalizedErrorMessage } from "../utils/browser-storage";

interface RecoveryShare {
  share_index: number;
  custodian_label: string;
  status: string;
  decrypted_share_part?: string | null;
}

interface RecoveryStatus {
  threshold: number;
  shares?: RecoveryShare[];
  verification_code: string;
  expires_at: string;
}

function parseRecoveryStatus(value: unknown): Required<RecoveryStatus> {
  if (!value || typeof value !== "object") throw new Error("Invalid approval status received. Try again.");
  const candidate = value as { threshold?: unknown; shares?: unknown; verification_code?: unknown; expires_at?: unknown };
  if (!Number.isInteger(candidate.threshold) || (candidate.threshold as number) <= 0 || !Array.isArray(candidate.shares)
      || typeof candidate.verification_code !== "string" || typeof candidate.expires_at !== "string") {
    throw new Error("Invalid approval status received. Try again.");
  }
  const shares = candidate.shares as unknown[];
  const valid = shares.every((share) => {
    if (!share || typeof share !== "object") return false;
    const item = share as Record<string, unknown>;
    const basicFieldsValid = Number.isInteger(item.share_index) && (item.share_index as number) > 0
      && typeof item.custodian_label === "string" && typeof item.status === "string"
      && (item.decrypted_share_part === undefined || item.decrypted_share_part === null || typeof item.decrypted_share_part === "string");
    const part = item.decrypted_share_part;
    return basicFieldsValid && (typeof part !== "string" || part.length === 0 || (part.length % 2 === 0 && /^[0-9a-f]+$/i.test(part)));
  });
  const ids = shares.map((share) => (share as RecoveryShare).share_index);
  if (!valid || new Set(ids).size !== ids.length || (candidate.threshold as number) > shares.length) {
    throw new Error("Invalid approval status received. Try again.");
  }
  return { threshold: candidate.threshold as number, shares: shares as RecoveryShare[], verification_code: candidate.verification_code, expires_at: candidate.expires_at };
}

const RECOVERY_SESSION_KEY = "abrn_recovery_capability";

export default function Recover() {
  const { t } = useTranslation(["auth", "drive"]);
  const navigate = useNavigate();
  const { skin } = useTheme();
  const isQuantiX = skin === "quantix";

  const [phase, setPhase] = useState<"request" | "wait" | "ready" | "reconstructing" | "success">("request");
  const [username, setUsername] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [threshold, setThreshold] = useState<number | null>(null);
  const [shares, setShares] = useState<RecoveryShare[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [recoveryToken, setRecoveryToken] = useState(() => sessionStorage.getItem(RECOVERY_SESSION_KEY) || "");
  const recoveryTokenRef = useRef(recoveryToken);
  const [verificationCode, setVerificationCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [resetSubmitted, setResetSubmitted] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRequestPendingRef = useRef(false);
  const lifecycleGenerationRef = useRef(0);
  const resetAbortRef = useRef<AbortController | null>(null);
  const cancelAbortRef = useRef<AbortController | null>(null);
  const cancelInProgressRef = useRef(false);
  const resetSubmittedRef = useRef(false);
  const resumeCheckedRef = useRef(false);

  useEffect(() => {
    return () => {
      lifecycleGenerationRef.current += 1;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      resetAbortRef.current?.abort();
      cancelAbortRef.current?.abort();
    };
  }, []);

  const startRecovery = async () => {
    if (!username.trim()) return;
    const generation = ++lifecycleGenerationRef.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("drive:recovery.startFailed", { defaultValue: "Failed to start recovery request." }));
      }

      const data = await response.json() as { recovery_token?: unknown; verification_code?: unknown; expires_at?: unknown };
      if (typeof data.recovery_token !== "string" || !data.recovery_token || typeof data.verification_code !== "string" || typeof data.expires_at !== "string") {
        throw new Error(t("drive:recovery.invalidStart", { defaultValue: "Recovery request could not be secured. Start again." }));
      }
      if (lifecycleGenerationRef.current !== generation) return;
      recoveryTokenRef.current = data.recovery_token;
      setRecoveryToken(data.recovery_token);
      sessionStorage.setItem(RECOVERY_SESSION_KEY, data.recovery_token);
      setVerificationCode(data.verification_code);
      setExpiresAt(data.expires_at);
      setPhase("wait");
      // Start polling status immediately.
      void fetchStatus(generation, data.recovery_token).then((result) => {
        if ((result === "pending" || result === "error") && lifecycleGenerationRef.current === generation) {
          pollIntervalRef.current = setInterval(() => { void fetchStatus(generation, data.recovery_token as string); }, 5000);
        }
      });
    } catch (err: unknown) {
      if (lifecycleGenerationRef.current !== generation) return;
      setError(getNormalizedErrorMessage(err, t("drive:recovery.startFailed", { defaultValue: "Request failed." })));
    } finally {
      if (lifecycleGenerationRef.current === generation) setLoading(false);
    }
  };

  const fetchStatus = useCallback(async (
    generation = lifecycleGenerationRef.current,
    capability = recoveryTokenRef.current,
  ): Promise<"pending" | "ready" | "invalid" | "error"> => {
    if (!capability || statusRequestPendingRef.current) return "error";
    statusRequestPendingRef.current = true;
    setCheckingStatus(true);
    setStatusError("");
    try {
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/status`, {
        headers: { Authorization: `Bearer ${capability}` },
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404 || response.status === 410) {
          if (lifecycleGenerationRef.current === generation) {
            recoveryTokenRef.current = "";
            setRecoveryToken("");
            sessionStorage.removeItem(RECOVERY_SESSION_KEY);
            setPhase("request");
            setThreshold(null);
            setShares([]);
            setApprovedCount(0);
            setVerificationCode("");
            setExpiresAt("");
            setStatusError("");
            setError(t("drive:recovery.resumeExpired", { defaultValue: "That recovery request expired or is no longer valid. Start a new recovery request." }));
          }
          return "invalid";
        }
        throw new Error(t("drive:recovery.statusUnavailable", { defaultValue: "Approval status is temporarily unavailable." }));
      }

      const data = parseRecoveryStatus(await response.json());
      if (lifecycleGenerationRef.current !== generation) return "error";
      setThreshold(data.threshold);
      setShares(data.shares);
      setVerificationCode(data.verification_code);
      setExpiresAt(data.expires_at);

      const approved = (data.shares || []).filter(
        (share) => share.status === "approved" && share.decrypted_share_part
      ).length;
      setApprovedCount(approved);
      setLastCheckedAt(Date.now());

      if (data.threshold > 0 && approved >= data.threshold) {
        setPhase("ready");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return "ready";
      }
      setPhase("wait");
      return "pending";
    } catch (err) {
      if (lifecycleGenerationRef.current !== generation) return "error";
      setStatusError(getNormalizedErrorMessage(err, t("drive:recovery.statusUnavailable", { defaultValue: "Approval status is temporarily unavailable." })));
      return "error";
    } finally {
      statusRequestPendingRef.current = false;
      if (lifecycleGenerationRef.current === generation) setCheckingStatus(false);
    }
  }, [t]);

  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    const capability = recoveryTokenRef.current;
    if (!capability) return;
    const generation = ++lifecycleGenerationRef.current;
    setPhase("wait");
    setLoading(true);
    void fetchStatus(generation, capability).then((result) => {
      if ((result === "pending" || result === "error") && lifecycleGenerationRef.current === generation) {
        pollIntervalRef.current = setInterval(() => { void fetchStatus(generation, capability); }, 5000);
      }
    }).finally(() => {
      if (lifecycleGenerationRef.current === generation) setLoading(false);
    });
  }, [fetchStatus]);

  const handleResetPassword = async () => {
    setError("");
    resetSubmittedRef.current = false;
    setResetSubmitted(false);
    if (newPassword.length < 8) {
      setError(t("drive:recovery.passwordTooShort", { defaultValue: "Password must be at least 8 characters long." }));
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError(t("drive:recovery.passwordTooLong", { defaultValue: "Password must be 72 bytes or fewer." }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("drive:recovery.passwordMismatch", { defaultValue: "Passwords do not match." }));
      return;
    }

    setLoading(true);
    setPhase("reconstructing");
    const generation = lifecycleGenerationRef.current;
    const controller = new AbortController();
    resetAbortRef.current = controller;
    try {
      // 1. Gather all approved shares
      const approvedShares = shares.filter(
        (share): share is RecoveryShare & { decrypted_share_part: string } =>
          share.status === "approved"
          && typeof share.decrypted_share_part === "string"
          && share.decrypted_share_part.length > 0
      );

      if (threshold === null || approvedShares.length < threshold) {
        throw new Error("Insufficient approvals to reconstruct the key.");
      }

      // 2. Map shares to SSSS reconstruction input format

      const reconstructionShares: ShamirShare[] = [];
      for (const s of approvedShares) {
        reconstructionShares.push({
          x: s.share_index,
          y: hexToBytes(s.decrypted_share_part),
        });
      }

      // 3. Reconstruct the private key PEM
      const reconstructedBytes = shamirReconstruct(reconstructionShares, threshold);
      const privateKeyPem = new TextDecoder().decode(reconstructedBytes);

      // Validate the PEM structure before saving to prevent corrupting the account permanently
      if (!privateKeyPem.includes("BEGIN PRIVATE KEY") && !privateKeyPem.includes("BEGIN RSA PRIVATE KEY")) {
        throw new Error("Reconstructed key is invalid. Custodian consensus shares might be corrupted or tampered.");
      }

      // 4. Encrypt the private key PEM with the new password
      const newPrivateKeyEncrypted = await encryptPrivateKeyWithPassword(newPassword, privateKeyPem, 2);
      if (lifecycleGenerationRef.current !== generation) return;

      // 5. Submit to backend
      resetSubmittedRef.current = true;
      setResetSubmitted(true);
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${recoveryTokenRef.current}` },
        body: JSON.stringify({
          new_password_hash: newPassword,
          new_private_key_encrypted: newPrivateKeyEncrypted,
          kek_envelope_version: 2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        if ([400, 401, 403, 429].includes(response.status)) {
          resetSubmittedRef.current = false;
          setResetSubmitted(false);
        }
        throw new Error(data.error || "Reset password failed.");
      }

      if (lifecycleGenerationRef.current !== generation) return;
      setShares([]);
      setNewPassword("");
      setConfirmPassword("");
      sessionStorage.removeItem(RECOVERY_SESSION_KEY);
      recoveryTokenRef.current = "";
      setRecoveryToken("");
      setPhase("success");
    } catch (err: unknown) {
      if (lifecycleGenerationRef.current !== generation) return;
      if (cancelInProgressRef.current) return;
      setError(resetSubmittedRef.current
        ? t("drive:recovery.resetOutcomeUnknown", { defaultValue: "We could not confirm whether the password changed. Do not cancel or submit another reset. Try signing in with the new password; if that fails, return here and start a new recovery request." })
        : getNormalizedErrorMessage(err, "Failed to reset password."));
      setPhase("ready");
    } finally {
      if (resetAbortRef.current === controller) resetAbortRef.current = null;
      if (lifecycleGenerationRef.current === generation) setLoading(false);
    }
  };

  const cancelRecovery = async () => {
    const capability = recoveryTokenRef.current;
    if (!capability || canceling || resetSubmittedRef.current) return;
    cancelInProgressRef.current = true;
    setCanceling(true);
    setError("");
    setStatusError("");
    resetAbortRef.current?.abort();
    resetAbortRef.current = null;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
    statusRequestPendingRef.current = false;
    const controller = new AbortController();
    cancelAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${capability}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("cancellation was not acknowledged");
      lifecycleGenerationRef.current += 1;
      setPhase("request");
      setUsername("");
      setLoading(false);
      setThreshold(null);
      setShares([]);
      setApprovedCount(0);
      setLastCheckedAt(null);
      setCheckingStatus(false);
      setNewPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setExpiresAt("");
      recoveryTokenRef.current = "";
      setRecoveryToken("");
      sessionStorage.removeItem(RECOVERY_SESSION_KEY);
    } catch {
      setPhase(threshold !== null && approvedCount >= threshold ? "ready" : "wait");
      setError(t("drive:recovery.cancelUncertain", { defaultValue: "We could not confirm cancellation. Your recovery request is still available in this browser. Check your connection and try again." }));
      const generation = lifecycleGenerationRef.current;
      pollIntervalRef.current = setInterval(() => { void fetchStatus(generation, capability); }, 5000);
    } finally {
      window.clearTimeout(timeout);
      if (cancelAbortRef.current === controller) cancelAbortRef.current = null;
      cancelInProgressRef.current = false;
      setCanceling(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        
        <Card className="border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-card/65 backdrop-blur-md rounded-[1.8rem]">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold brand-section-heading">
              {t("drive:recovery.title")}
            </CardTitle>
            <CardDescription className="text-xs max-w-sm mx-auto leading-relaxed">
              {t("drive:recovery.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border border-border bg-muted p-3 text-sm text-foreground" data-testid="recovery-file-limit">
              {t("drive:recovery.originalFileCredential", { defaultValue: "Recovery restores your account key. Files encrypted with an earlier PIN or file password still need that original credential. A new PIN does not re-encrypt existing files. Support cannot recover a lost file credential; ask the sender for another copy or use your own backup." })}
            </p>
            
            {/* Phase 1: Request Recovery */}
            {phase === "request" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="recover-username">{t("drive:recovery.username", { defaultValue: "Username" })}</Label>
                  <input
                    id="recover-username"
                    type="text"
                    placeholder={t("drive:recovery.usernamePlaceholder", { defaultValue: "Enter your username" })}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    onKeyDown={(e) => { if (e.key === "Enter") startRecovery(); }}
                  />
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium" role="alert">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}

                <Button
                  onClick={startRecovery}
                  disabled={loading || !username.trim()}
                  className="w-full flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t("drive:recovery.requestRecovery")}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => navigate("/login")}
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground hover:underline"
                >
                  {t("drive:recovery.backToLogin", { defaultValue: "Back to login" })}
                </Button>
              </div>
            )}

            {/* Phase 2: Wait for Approvals */}
            {phase === "wait" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="recovery-verification-code">
                  <p className="font-semibold">{t("drive:recovery.verificationCode", { defaultValue: "Verification code" })}: <span className="font-mono tracking-wider">{verificationCode}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("drive:recovery.verifyOutOfBand", { defaultValue: "Confirm this exact code with each custodian outside ABRN Drive before they approve. Expires {{time}}.", time: expiresAt ? new Date(expiresAt).toLocaleString() : t("drive:recovery.soon", { defaultValue: "soon" }) })}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("drive:recovery.custodianApprovals", { defaultValue: "Custodian approvals" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => { void fetchStatus(); }}
                      disabled={checkingStatus}
                      className="text-primary hover:bg-primary/10 p-1.5 rounded-md transition-colors flex items-center gap-1 text-[10px]"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingStatus ? "animate-spin" : ""}`} />
                      {t("drive:recovery.checkAgain", { defaultValue: "Check again" })}
                    </button>
                  </div>
                  
                  {/* Progress Indicators */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span>{t("drive:recovery.status", { defaultValue: "Status" })}</span>
                      <span>{approvedCount} / {threshold} {t("drive:recovery.approved", { defaultValue: "Approved" })}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500 shadow-[var(--shadow-glow-primary)]"
                        style={{ width: `${threshold ? (approvedCount / threshold) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {lastCheckedAt
                      ? t("drive:recovery.lastChecked", {
                          defaultValue: "Last checked: {{time}}",
                          time: new Date(lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        })
                      : t("drive:recovery.notCheckedYet", { defaultValue: "Status has not been checked yet." })}
                  </p>
                  {statusError && (
                    <p className="text-xs text-destructive" role="alert">{statusError}</p>
                  )}
                </div>

                {/* Node visualization (QuantiX vs ABRN) */}
                <div className="relative rounded-2xl border border-border bg-card p-4 min-h-[140px] flex flex-col items-center justify-center space-y-4 overflow-hidden">
                  {isQuantiX ? (
                    /* QuantiX Hexagonal Node Network */
                    <div className="w-full flex flex-col items-center justify-center space-y-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border border-primary bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-[var(--shadow-glow-primary)]">
                          ME
                        </div>
                        {/* Connecting lines to custodians */}
                        <div className="absolute inset-0 -z-10 flex items-center justify-center">
                          <svg className="w-40 h-40 absolute" viewBox="0 0 100 100">
                            {shares.map((_, i) => {
                              const angle = (i * 2 * Math.PI) / shares.length;
                              const x2 = 50 + 35 * Math.cos(angle);
                              const y2 = 50 + 35 * Math.sin(angle);
                              return (
                                <line
                                  key={i}
                                  x1="50"
                                  y1="50"
                                  x2={x2}
                                  y2={y2}
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeDasharray="4"
                                  className="text-primary/30 animate-pulse"
                                />
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 w-full pt-2">
                        {shares.map((s) => (
                          <div
                            key={s.share_index}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] flex flex-col justify-center items-center transition-all ${
                              s.status === "approved"
                                ? "border-emerald-500/50 bg-emerald-950/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                : "border-border bg-muted/30 text-muted-foreground"
                            }`}
                          >
                            <span className="font-semibold truncate max-w-[120px]">
                              {s.custodian_label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ABRN Timeline */
                    <div className="w-full space-y-3">
                      <p className="text-xs font-semibold text-foreground">Recovery Approval Steps:</p>
                      <div className="space-y-2">
                        {shares.map((s) => (
                          <div
                            key={s.share_index}
                            className={`flex justify-between items-center px-3 py-2 rounded-xl border text-xs transition-all ${
                              s.status === "approved"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                                : "border-border bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            <div>
                              <p className="font-semibold">{s.custodian_label}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              s.status === "approved" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground border"
                            }`}>
                              {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("drive:recovery.waitingForCustodians", { defaultValue: "Waiting for configured custodians to review the request. No response time is guaranteed." })}</span>
                </div>
                <Button type="button" variant="outline" onClick={() => { void cancelRecovery(); }} disabled={canceling} className="w-full">{canceling ? t("drive:recovery.cancelling", { defaultValue: "Cancelling..." }) : t("drive:recovery.cancel", { defaultValue: "Cancel recovery" })}</Button>
              </div>
            )}

            {/* Phase 3: Ready to reset, then actual reconstruction */}
            {(phase === "ready" || phase === "reconstructing") && (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                  {t("drive:recovery.readyCode", { defaultValue: "Request {{code}} expires {{time}}. Only continue after your custodians confirmed this code with you outside the app.", code: verificationCode, time: expiresAt ? new Date(expiresAt).toLocaleString() : t("drive:recovery.soon", { defaultValue: "soon" }) })}
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 px-3 py-2.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold shadow-sm">
                  {phase === "reconstructing" ? (
                    <Loader2 className="w-4 h-4 text-emerald-500 shrink-0 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  <span>
                    {phase === "reconstructing"
                      ? t("drive:recovery.reconstructingNow", { defaultValue: "Reconstructing your key and applying the reset..." })
                      : t("drive:recovery.approvalsComplete", { defaultValue: "Approvals complete. Choose a new account password to continue." })}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">{t("drive:recovery.newPassword", { defaultValue: "New Password" })}</Label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder={t("drive:recovery.newPasswordPlaceholder", { defaultValue: "Minimum 8 characters" })}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        maxLength={72}
                        disabled={phase === "reconstructing" || resetSubmitted}
                        className="w-full px-3 py-2 pr-10 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((visible) => !visible)}
                        aria-label={showNewPassword
                          ? t("auth:credentials.hideNewPassword", { defaultValue: "Hide new password" })
                          : t("auth:credentials.showNewPassword", { defaultValue: "Show new password" })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={phase === "reconstructing" || resetSubmitted}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">{t("drive:recovery.confirmPassword", { defaultValue: "Confirm Password" })}</Label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t("drive:recovery.confirmPasswordPlaceholder", { defaultValue: "Re-enter password" })}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        maxLength={72}
                        disabled={phase === "reconstructing" || resetSubmitted}
                        className="w-full px-3 py-2 pr-10 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((visible) => !visible)}
                        aria-label={showConfirmPassword
                          ? t("auth:credentials.hidePasswordConfirmation", { defaultValue: "Hide password confirmation" })
                          : t("auth:credentials.showPasswordConfirmation", { defaultValue: "Show password confirmation" })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={phase === "reconstructing" || resetSubmitted}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium" role="alert">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleResetPassword}
                  disabled={phase === "reconstructing" || resetSubmitted || loading || !newPassword || !confirmPassword}
                  className="w-full flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {t("drive:recovery.resetAccount", { defaultValue: "Recover & Reset Account" })}
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => { void cancelRecovery(); }} disabled={canceling || resetSubmitted} className="w-full">{canceling ? t("drive:recovery.cancelling", { defaultValue: "Cancelling..." }) : t("drive:recovery.cancel", { defaultValue: "Cancel recovery" })}</Button>
              </div>
            )}

            {/* Phase 4: Success */}
            {phase === "success" && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 shrink-0" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">
                  Account Recovered Successfully
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your private encryption key has been reconstructed browser-side and re-secured with your new password. The consensus shares have been cleaned.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("drive:recovery.pinAfterReset", {
                    defaultValue: "After you log in, set a new vault PIN. Then verify that an existing file opens before relying on this device for future work.",
                  })}
                </p>
                
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full text-sm mt-2"
                >
                  Log In
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
