import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import {
  Shield,
  ShieldCheck,
  User,
  Users,
  Mail,
  Calendar,
  Lock,
  Key,
  Moon,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme, SKINS } from "../components/theme-provider";
import { cn } from "../lib/utils";
import { getPINStatus, setPIN } from "../utils/api";
import { AgentApiKeysSection } from "../components/settings/AgentApiKeysSection";
import { AgentDeveloperPortalSection } from "../components/settings/AgentDeveloperPortalSection";
import { AgentOperationsSection } from "../components/settings/AgentOperationsSection";
import { ApiSimulationSection } from "../components/settings/ApiSimulationSection";
import { PipelineExamplesSection } from "../components/settings/PipelineExamplesSection";
import { AuditLogSection } from "../components/settings/AuditLogSection";
import { CollapsibleSection } from "../components/settings/CollapsibleSection";
import { ControlPlaneStatusSection } from "../components/settings/ControlPlaneStatusSection";
import { LanguageSelector } from "../components/settings/LanguageSelector";
import { CustodianRecoverySection } from "../components/settings/CustodianRecoverySection";

import { Tabs, TabPanel } from "../components/ui/tabs";
import { useSessionVault } from "../context/SessionVaultContext";
import {
  createPinProtectedPrivateKey,
  getPinEnrollmentErrorMessage,
} from "../utils/pin-enrollment";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import { mergeUserPinState } from "../utils/pin-trust";
import { branding } from "../config/branding";

export default function Settings() {
  const navigate = useNavigate();
  const { skin, setSkin } = useTheme();
  const { setCredential } = useSessionVault();
  const [userData] = useState(() => getStoredUserFromLocalStorage());
  const [orgName, setOrgName] = useState<string>("");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${branding.apiBasePath}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u?.organization_name) setOrgName(u.organization_name as string); })
      .catch(() => undefined);
  }, []);

  const [activeTab, setActiveTab] = useState("account");
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [oldPinInput, setOldPinInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [previousPasswordInput, setPreviousPasswordInput] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Governance settings state.
  const [govRetentionDays, setGovRetentionDays] = useState(365);
  const [govStaleEnabled, setGovStaleEnabled] = useState(false);
  const [govStaleDays, setGovStaleDays] = useState(30);
  const [govAlertThreshold, setGovAlertThreshold] = useState(3);
  const [govSaving, setGovSaving] = useState(false);
  const [govSaved, setGovSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${branding.apiBasePath}/v1/governance/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setGovRetentionDays(data.audit_retention_days ?? 365);
        setGovAlertThreshold(data.failure_alert_threshold ?? 3);
        if (data.auto_expire_stale_days != null) {
          setGovStaleEnabled(true);
          setGovStaleDays(data.auto_expire_stale_days);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !userData) {
      navigate("/login");
      return;
    }
    getPINStatus(token)
      .then((s) => setPinSet(s.pin_set))
      .catch(() => setPinSet(false));
  }, [userData, navigate]);

  const handlePinSubmit = async () => {
    setPinError("");
    setPinSuccess("");
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN must be exactly 4 digits.");
      return;
    }
    if (pinSet && !oldPinInput) {
      setPinError("Enter your current PIN to change it.");
      return;
    }
    if (pinSet && oldPinInput.length !== 4) {
      setPinError("Current PIN must be exactly 4 digits.");
      return;
    }
    if (!passwordInput) {
      setPinError("Enter your account password to protect your PIN.");
      return;
    }
    setPinLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
      const userObj = getStoredUserFromLocalStorage();
      const privateKeyEncrypted: string | null = userObj?.private_key_encrypted ?? null;

      const { privateKeyPinEncrypted, reEncryptedPrivateKey } = await createPinProtectedPrivateKey({
        privateKeyEncrypted,
        password: passwordInput,
        pin: pinInput,
        previousPassword: showRecovery ? previousPasswordInput : undefined,
      });

      await setPIN(pinInput, token, pinSet ? oldPinInput : undefined, privateKeyPinEncrypted);
      setPinSet(true);
      setCredential(pinInput, "pin");
      setPinSuccess(pinSet ? "PIN changed successfully." : "PIN set successfully.");
      setShowPinForm(false);
      setShowRecovery(false);
      setPinInput("");
      setOldPinInput("");
      setPasswordInput("");
      setPreviousPasswordInput("");
      if (userObj) {
        const updatedUser = mergeUserPinState(userObj, privateKeyPinEncrypted);
        if (reEncryptedPrivateKey) {
          updatedUser.private_key_encrypted = reEncryptedPrivateKey;
        }
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (err) {
      const msg = getPinEnrollmentErrorMessage(err);
      setPinError(msg);
      if (msg.includes("Incorrect password")) {
        setShowRecovery(true);
      }
    } finally {
      setPinLoading(false);
    }
  };

  const saveOrgName = async () => {
    setOrgSaving(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${branding.apiBasePath}/users/organization`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organization_name: orgName }),
      });
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2000);
    } catch {
      void 0;
    } finally {
      setOrgSaving(false);
    }
  };

  if (!userData) {
    return null;
  }

  const settingsTabs = [
    { id: "account", label: "Account" },
    { id: "security", label: "Security" },
    { id: "advanced", label: "Advanced" },
    { id: "governance", label: "Governance" },
  ];

  async function saveGovernanceSettings() {
    const token = localStorage.getItem("token");
    if (!token) return;
    setGovSaving(true);
    try {
      await fetch(`${branding.apiBasePath}/v1/governance/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          audit_retention_days: govRetentionDays,
          auto_expire_stale_days: govStaleEnabled ? govStaleDays : null,
          failure_alert_threshold: govAlertThreshold,
        }),
      });
      setGovSaved(true);
      setTimeout(() => setGovSaved(false), 2500);
    } finally {
      setGovSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
        <div className="rounded-[1.8rem] border border-border bg-card px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="brand-badge">Owner control</span>
            <span className="inline-flex items-center rounded-full border border-border bg-muted/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Trust stays visible
            </span>
          </div>
          <h1 className="text-3xl font-bold brand-section-heading">Settings</h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
            Keep the vault calm and predictable: one PIN, clear privacy boundaries, and delegated access you can inspect or revoke whenever needed.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-left text-[11px] text-muted-foreground">
            <div className="rounded-xl border border-border bg-muted/80 px-3 py-2">PIN trust flows across the vault, sharing, and Secure Drop</div>
            <div className="rounded-xl border border-border bg-muted/80 px-3 py-2">The server stores ciphertext, metadata, and reviewable access events</div>
            <div className="rounded-xl border border-border bg-muted/80 px-3 py-2">Agent credentials stay scoped, visible, and revocable</div>
          </div>
        </div>

        <Tabs tabs={settingsTabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Account Tab */}
        <TabPanel id="account" activeTab={activeTab} className="space-y-6">
        {/* Language Settings */}
        <LanguageSelector />

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full ring-1 ring-border"
                style={{
                  background: `linear-gradient(135deg, ${SKINS.find(s => s.id === skin)?.swatchPrimary}, ${SKINS.find(s => s.id === skin)?.swatchAccent})`,
                }}
              />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose your interface skin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SKINS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={(e) => setSkin(s.id, e)}
                  aria-pressed={skin === s.id}
                  className={cn(
                    "relative rounded-xl border-2 p-3 text-left transition-all duration-200",
                    "hover:scale-[1.03] hover:-translate-y-0.5",
                    skin === s.id
                      ? "border-primary shadow-md"
                      : "border-border hover:border-primary/40"
                  )}
                  style={{ background: s.swatchBg }}
                >
                  <div className="flex gap-1.5 mb-2 items-center">
                    <span
                      className="w-4 h-4 rounded-full ring-1 ring-white/20 flex-shrink-0"
                      style={{ background: s.swatchPrimary }}
                    />
                    <span
                      className="w-4 h-4 rounded-full ring-1 ring-white/20 flex-shrink-0"
                      style={{ background: s.swatchAccent }}
                    />
                    {s.isDark && (
                      <Moon
                        className="w-3 h-3 ml-auto opacity-60"
                        style={{ color: s.swatchPrimary }}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold tracking-wide",
                      "text-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                  {skin === s.id && (
                    <CheckCircle2
                      className="absolute top-1.5 right-1.5 w-4 h-4"
                      style={{ color: s.swatchPrimary }}
                    />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Username
                  </Label>
                  <p className="font-medium">{userData.username}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <p className="font-medium">{userData.email}</p>
                </div>
              </div>
              {userData.created_at && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Member Since
                  </Label>
                  <p className="font-medium">
                    {new Date(userData.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization
            </CardTitle>
            <CardDescription>Shown to clients on your Secure Drop portal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 max-w-sm">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={`e.g. ${branding.companyName}`}
                className="flex-1 px-3 py-2 border rounded-md bg-background border-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") void saveOrgName(); }}
              />
              <Button
                onClick={() => void saveOrgName()}
                disabled={orgSaving}
                variant="outline"
                className="shrink-0"
              >
                {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : orgSaved ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel id="security" activeTab={activeTab} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Your Security PIN
            </CardTitle>
            <CardDescription>
              A single 4-digit PIN used across your vault, shares, Secure Drop, and quick login
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">One PIN for everything</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px] text-muted-foreground">
                <div className="rounded-xl border border-border bg-muted/80 px-3 py-2">Set once, then reuse it across normal owner flows</div>
                <div className="rounded-xl border border-border bg-muted/80 px-3 py-2">Protect your encrypted private key without rewrapping every action</div>
                <div className="rounded-xl border border-border bg-muted/80 px-3 py-2">Keep trust visible without adding daily friction</div>
              </div>
            </div>

            {pinSet === null ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking PIN status…
              </div>
            ) : pinSet ? (
              <div className="brand-receipt-surface rounded-2xl flex items-start gap-3 p-4">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">PIN is set</p>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1 leading-relaxed">
                    Your vault is protected. This PIN now carries trust across uploads, downloads, share creation, and Secure Drop owner flows.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">No PIN set yet</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                    Set a PIN to unlock the calm owner flow. Once enrolled, the app can reuse that trusted session instead of asking again for routine work.
                  </p>
                </div>
              </div>
            )}

            {pinSuccess && !showPinForm && (
              <p className="text-sm text-green-600 dark:text-green-400">{pinSuccess}</p>
            )}

            {!showPinForm ? (
              <Button
                variant="outline"
                onClick={() => { setShowPinForm(true); setPinError(""); setPinSuccess(""); setPinInput(""); setOldPinInput(""); }}
                className="border-primary/40 bg-background text-primary hover:bg-muted"
              >
                {pinSet ? "Change PIN" : "Set PIN"}
              </Button>
            ) : (
              <div className="space-y-3 max-w-sm rounded-2xl border border-border bg-card p-4">
                {pinSet && (
                  <div className="space-y-1">
                    <Label>Current PIN</Label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={oldPinInput}
                      onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center tracking-widest text-xl"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>{pinSet ? "New PIN" : "PIN"}</Label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center tracking-widest text-xl"
                    onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
                  />
                  <p className="text-xs text-muted-foreground">Enter exactly 4 digits</p>
                </div>
                {pinError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {pinError}
                  </p>
                )}
                <div className="space-y-1">
                  <Label>Account Password</Label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Your login password"
                    className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">Needed to bind your PIN to your encryption key</p>
                </div>
                {showRecovery && (
                  <div className="space-y-1 p-3 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label className="text-amber-700 dark:text-amber-400">Previous Password</Label>
                    <input
                      type="password"
                      value={previousPasswordInput}
                      onChange={(e) => setPreviousPasswordInput(e.target.value)}
                      placeholder="Enter your previous password"
                      className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
                    />
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">
                      Your administrator may have reset your password. Enter your previous password to recover your encryption key.
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                  variant="outline"
                  onClick={() => { setShowPinForm(false); setPinInput(""); setOldPinInput(""); setPasswordInput(""); setPinError(""); }}
                  disabled={pinLoading}
                >
                    Cancel
                  </Button>
                  <Button onClick={handlePinSubmit} disabled={pinLoading || pinInput.length !== 4 || !passwordInput}>
                    {pinLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    {pinSet ? "Change PIN" : "Set PIN"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <CustodianRecoverySection />

        {/* Security Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Encryption
            </CardTitle>
            <CardDescription>
              Your data is protected with end-to-end encryption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <Lock className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    End-to-End Encryption Enabled
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    All your files are encrypted with AES-256-GCM before upload
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-primary/10 dark:bg-primary/90 border border-primary/40 dark:border-primary rounded-lg">
                <Key className="w-5 h-5 text-primary dark:text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-primary/90 dark:text-primary-foreground">
                    RSA-2048 Key Pair
                  </p>
                  <p className="text-sm text-primary dark:text-primary mt-1">
                    Your encryption keys are secured with password-based
                    derivation (PBKDF2)
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-3 py-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Server never decrypts</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All operations happen in your browser</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-3 py-2.5">
                  <Users className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Sharing uses key exchange</p>
                    <p className="text-xs text-muted-foreground mt-0.5">RSA wrapping, revocable anytime</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy & Trust
            </CardTitle>
            <CardDescription>
              {`What ${branding.productName} sees, what it protects, and what you control`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-[1.6rem] border border-border bg-card px-5 py-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-200">Ciphertext only</span>
                <span className="inline-flex items-center rounded-full border border-border bg-muted/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Reviewable control</span>
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">How your files are protected</p>
              <p className="mt-2 leading-relaxed text-foreground">
                {`Files are encrypted in your browser before upload. ${branding.productName} stores the locked version, delivery metadata, and a record of access events so you can understand what happened without giving up control.`}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                If the server is breached, your files remain unreadable without the key material that never leaves your control.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-4">
                <p className="font-medium text-emerald-900 dark:text-emerald-100 mb-2">The server tracks</p>
                <ul className="space-y-1.5 text-emerald-800 dark:text-emerald-200">
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />File ownership and folder structure</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />When links and requests were created or revoked</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />Agent key activity and scope denials</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-4 py-4">
                <p className="font-medium text-sky-900 dark:text-sky-100 mb-2">The server cannot see</p>
                <ul className="space-y-1.5 text-sky-800 dark:text-sky-200">
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-sky-500 shrink-0" />Your file contents — only encrypted bytes</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-sky-500 shrink-0" />The decryption key in public share link fragments</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-sky-500 shrink-0" />Your PIN or the vault unlock material it derives</li>
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-4">
              <p className="font-medium text-foreground">Sharing and agent delegation</p>
              <p className="mt-1.5 leading-relaxed text-foreground">
                Every link, request, and agent key you create is reviewable and revocable. Agent keys carry explicit scopes for metadata and ciphertext operations, so delegation feels bounded instead of blind.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px] text-muted-foreground">
                <div className="rounded-xl border border-border bg-muted/90 px-3 py-2">Scope what an outside system can do</div>
                <div className="rounded-xl border border-border bg-muted/90 px-3 py-2">Review when it was last used</div>
                <div className="rounded-xl border border-border bg-muted/90 px-3 py-2">Revoke it instantly when the job is done</div>
              </div>
            </div>
          </CardContent>
        </Card>

        </TabPanel>

        {/* Advanced Tab */}
        <TabPanel id="advanced" activeTab={activeTab} className="space-y-6">
        <AgentApiKeysSection />

        <ControlPlaneStatusSection />

        <AgentOperationsSection />

        <ApiSimulationSection />

        <CollapsibleSection
          title="Agent API reference"
          description="Expand when you need endpoint details, curl examples, or the response envelope."
        >
          <AgentDeveloperPortalSection />
        </CollapsibleSection>

        <CollapsibleSection
          title="Pipeline examples"
          description="Expand when you want copy-paste workflows for search, download, and decrypt handoff."
        >
          <PipelineExamplesSection />
        </CollapsibleSection>

        <CollapsibleSection
          title="Raw audit log"
          description="Expand for the low-level record after the live surfaces above tell you the story."
        >
          <AuditLogSection />
        </CollapsibleSection>
        </TabPanel>

        {/* Governance Tab */}
        <TabPanel id="governance" activeTab={activeTab} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Retention &amp; governance
              </CardTitle>
              <CardDescription>
                Control how long audit data is kept and when stale access is automatically revoked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Audit retention */}
              <div className="space-y-2">
                <Label htmlFor="gov-retention">Audit log retention period</Label>
                <select
                  id="gov-retention"
                  value={govRetentionDays}
                  onChange={(e) => setGovRetentionDays(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                  <option value={3650}>Forever (10 years)</option>
                </select>
                <p className="text-xs text-muted-foreground">Audit events older than this period are pruned on the next export cycle.</p>
              </div>

              {/* Auto-expire stale links */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gov-stale-toggle">Auto-expire stale links</Label>
                  <Switch
                    id="gov-stale-toggle"
                    checked={govStaleEnabled}
                    onCheckedChange={setGovStaleEnabled}
                  />
                </div>
                {govStaleEnabled && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Revoke links inactive for</span>
                    <input
                      type="number"
                      min={7}
                      max={365}
                      value={govStaleDays}
                      onChange={(e) => setGovStaleDays(Number(e.target.value))}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                )}
              </div>

              {/* Failure alert threshold */}
              <div className="space-y-2">
                <Label htmlFor="gov-threshold">Failed access alert threshold</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="gov-threshold"
                    type="number"
                    min={1}
                    max={100}
                    value={govAlertThreshold}
                    onChange={(e) => setGovAlertThreshold(Number(e.target.value))}
                    className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-sm text-muted-foreground">failed attempts before surfacing in governance alerts</span>
                </div>
              </div>

              <Button
                onClick={() => void saveGovernanceSettings()}
                disabled={govSaving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {govSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                ) : govSaved ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Saved</>
                ) : (
                  "Save governance settings"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabPanel>
    </div>
  );
}
