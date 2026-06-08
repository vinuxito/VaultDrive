import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { branding } from "../config/branding";
import { useTheme } from "../components/theme-provider";
import { hexToBytes, encryptPrivateKeyWithPassword } from "../utils/crypto";
import { shamirReconstruct, type ShamirShare } from "../utils/shamir";

export default function Recover() {
  const { t } = useTranslation(["auth", "drive"]);
  const navigate = useNavigate();
  const { skin } = useTheme();
  const isQuantiX = skin === "quantix";

  const [phase, setPhase] = useState<"request" | "wait" | "reset" | "success">("request");
  const [username, setUsername] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [threshold, setThreshold] = useState<number | null>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startRecovery = async () => {
    if (!username.trim()) return;
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
        throw new Error(data.error || "Failed to start recovery request.");
      }

      setPhase("wait");
      // Start polling status immediately
      fetchStatus();
      pollIntervalRef.current = setInterval(fetchStatus, 5000);
    } catch (err: any) {
      setError(err.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    if (!username.trim()) return;
    try {
      const response = await fetch(
        `${branding.apiBasePath}/v1/recovery/status?username=${encodeURIComponent(username.trim())}`
      );
      if (response.ok) {
        const data = await response.json();
        setThreshold(data.threshold);
        setShares(data.shares || []);

        const approved = (data.shares || []).filter(
          (s: any) => s.status === "approved" && s.decrypted_share_part
        ).length;
        setApprovedCount(approved);

        if (data.threshold > 0 && approved >= data.threshold) {
          setPhase("reset");
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error("Error polling recovery status:", err);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // 1. Gather all approved shares
      const approvedShares = shares.filter(
        (s: any) => s.status === "approved" && s.decrypted_share_part
      );

      if (threshold === null || approvedShares.length < threshold) {
        throw new Error("Insufficient approvals to reconstruct the key.");
      }

      // 2. Map shares to SSSS reconstruction input format

      // Let's sort all shares by custodian ID
      const sortedAllShares = [...shares].sort((a, b) => a.custodian_id.localeCompare(b.custodian_id));
      
      const reconstructionShares: ShamirShare[] = [];
      for (const s of approvedShares) {
        // Find the index of this custodian in the sorted list of ALL custodians
        const originalIndex = sortedAllShares.findIndex((allS) => allS.custodian_id === s.custodian_id);
        if (originalIndex === -1) {
          throw new Error("Custodian mismatch during key reconstruction.");
        }
        reconstructionShares.push({
          x: originalIndex + 1, // 1-based index
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
      const newPrivateKeyEncrypted = await encryptPrivateKeyWithPassword(newPassword, privateKeyPem);

      // 5. Submit to backend
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          new_password_hash: newPassword,
          new_private_key_encrypted: newPrivateKeyEncrypted,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Reset password failed.");
      }

      setPhase("success");
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
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
            
            {/* Phase 1: Request Recovery */}
            {phase === "request" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="recover-username">Username</Label>
                  <input
                    id="recover-username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    onKeyDown={(e) => { if (e.key === "Enter") startRecovery(); }}
                  />
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium">
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
                  Back to login
                </Button>
              </div>
            )}

            {/* Phase 2: Wait for Approvals */}
            {phase === "wait" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Custodian Approvals
                    </span>
                    <button
                      type="button"
                      onClick={fetchStatus}
                      className="text-primary hover:bg-primary/10 p-1.5 rounded-md transition-colors flex items-center gap-1 text-[10px]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh
                    </button>
                  </div>
                  
                  {/* Progress Indicators */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span>Status</span>
                      <span>{approvedCount} / {threshold} Approved</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500 shadow-[var(--shadow-glow-primary)]"
                        style={{ width: `${threshold ? (approvedCount / threshold) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
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
                            key={s.custodian_id}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] flex flex-col justify-center items-center transition-all ${
                              s.status === "approved"
                                ? "border-emerald-500/50 bg-emerald-950/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                : "border-border bg-muted/30 text-muted-foreground"
                            }`}
                          >
                            <span className="font-semibold truncate max-w-[120px]">
                              {s.custodian_first_name} {s.custodian_last_name}
                            </span>
                            <span className="text-[8px] opacity-75">
                              @{s.custodian_username}
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
                            key={s.custodian_id}
                            className={`flex justify-between items-center px-3 py-2 rounded-xl border text-xs transition-all ${
                              s.status === "approved"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                                : "border-border bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            <div>
                              <p className="font-semibold">{s.custodian_first_name} {s.custodian_last_name}</p>
                              <p className="text-[10px] opacity-75">@{s.custodian_username}</p>
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
                  <span>Waiting for custodians to decrypt and approve shares...</span>
                </div>
              </div>
            )}

            {/* Phase 3: Reconstruction & Reset */}
            {phase === "reset" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 px-3 py-2.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold shadow-sm">
                  <Key className="w-4 h-4 text-emerald-500 shrink-0 animate-bounce" />
                  <span>Consensus reached! Reconstructing private key...</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Recover &amp; Reset Account
                    </>
                  )}
                </Button>
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
