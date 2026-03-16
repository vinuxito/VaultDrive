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
  Sun,
  Moon,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../components/theme-provider";
import { getPINStatus, setPIN } from "../utils/api";
import { AgentApiKeysSection } from "../components/settings/AgentApiKeysSection";
import { AuditLogSection } from "../components/settings/AuditLogSection";
import { useSessionVault } from "../context/SessionVaultContext";
import { createPinProtectedPrivateKey } from "../utils/pin-enrollment";
import { mergeUserPinState } from "../utils/pin-trust";

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { setCredential } = useSessionVault();
  const [userData] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [orgName, setOrgName] = useState<string>("");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/abrn/api/users/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u?.organization_name) setOrgName(u.organization_name as string); })
      .catch(() => undefined);
  }, []);

  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [oldPinInput, setOldPinInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

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
      const stored = localStorage.getItem("user");
      const userObj = stored ? JSON.parse(stored) : null;
      const privateKeyEncrypted: string | null = userObj?.private_key_encrypted ?? null;

      let privateKeyPinEncrypted: string | undefined;
      try {
        privateKeyPinEncrypted = await createPinProtectedPrivateKey({
          privateKeyEncrypted,
          password: passwordInput,
          pin: pinInput,
        });
      } catch (err) {
        if (err instanceof Error && (err.message.includes("Decryption failed") || err.message.includes("decrypt"))) {
          throw new Error("Incorrect password — enter your account login password.");
        }
        throw err;
      }

      await setPIN(pinInput, token, pinSet ? oldPinInput : undefined, privateKeyPinEncrypted);
      setPinSet(true);
      setCredential(pinInput, "pin");
      setPinSuccess(pinSet ? "PIN changed successfully." : "PIN set successfully.");
      setShowPinForm(false);
      setPinInput("");
      setOldPinInput("");
      setPasswordInput("");
      if (stored && userObj) {
        localStorage.setItem(
          "user",
          JSON.stringify(mergeUserPinState(userObj, privateKeyPinEncrypted)),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save PIN.";
      setPinError(msg);
    } finally {
      setPinLoading(false);
    }
  };

  const saveOrgName = async () => {
    setOrgSaving(true);
    try {
      const token = localStorage.getItem("token");
      await fetch("/abrn/api/users/organization", {
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

  return (
    <div className="max-w-4xl space-y-6">
        <div className="rounded-[1.8rem] border border-[#e8d9d0] bg-[linear-gradient(180deg,#fffdfb_0%,#f8f3ef_100%)] px-6 py-6 shadow-[0_20px_50px_rgba(125,79,80,0.08)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(15,23,42,0.92)_100%)]">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="abrn-badge">Owner control</span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              Trust stays visible
            </span>
          </div>
          <h1 className="text-3xl font-bold abrn-section-heading">Settings</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            Keep the vault calm and predictable: one PIN, clear privacy boundaries, and delegated access you can inspect or revoke whenever needed.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 text-left text-[11px] text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">PIN trust flows across the vault, sharing, and Secure Drop</div>
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">The server stores ciphertext, metadata, and reviewable access events</div>
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">Agent credentials stay scoped, visible, and revocable</div>
          </div>
        </div>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
              Appearance
            </CardTitle>
<CardDescription>
              Customize your workspace preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                />
                <Moon className="w-4 h-4" />
              </div>
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
                placeholder="e.g. ABRN Asesores SC"
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Your Vault PIN
            </CardTitle>
            <CardDescription>
              A single 4-digit PIN used across your vault, shares, Secure Drop, and quick login
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[#e8d9d0] bg-[#fbf7f3] px-4 py-4 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">One-PIN doctrine</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50">Set once, then reuse it across normal owner flows</div>
                <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50">Protect your encrypted private key without rewrapping every action</div>
                <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50">Keep trust visible without adding daily friction</div>
              </div>
            </div>

            {pinSet === null ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking PIN status…
              </div>
            ) : pinSet ? (
              <div className="abrn-receipt-surface rounded-2xl flex items-start gap-3 p-4">
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
                className="border-[#d4a5a6] bg-white/80 text-[#7d4f50] hover:bg-[#f8efea] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              >
                {pinSet ? "Change PIN" : "Set PIN"}
              </Button>
            ) : (
              <div className="space-y-3 max-w-sm rounded-2xl border border-[#e8d9d0] bg-[#fbf7f3] p-4 dark:border-slate-700 dark:bg-slate-900/60">
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

        {/* Security Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
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

              <div className="flex items-start gap-3 p-3 bg-[#f2d7d8] dark:bg-[#6b4345] border border-[#d4a5a6] dark:border-[#7d4f50] rounded-lg">
                <Key className="w-5 h-5 text-[#7d4f50] dark:text-[#c4999b] mt-0.5" />
                <div>
                  <p className="font-medium text-[#6b4345] dark:text-[#f2d7d8]">
                    RSA-2048 Key Pair
                  </p>
                  <p className="text-sm text-[#7d4f50] dark:text-[#c4999b] mt-1">
                    Your encryption keys are secured with password-based
                    derivation (PBKDF2)
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Server never decrypts</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">All operations happen in your browser</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
                  <Users className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Sharing uses key exchange</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">RSA wrapping, revocable anytime</p>
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
              What ABRN Drive sees, what it protects, and what you control
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="rounded-[1.6rem] border border-[#e8d9d0] bg-[linear-gradient(180deg,#fffdfa_0%,#f8f2ee_100%)] px-5 py-5 shadow-[0_16px_36px_rgba(125,79,80,0.08)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.94)_0%,rgba(15,23,42,0.9)_100%)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-200">Ciphertext only</span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">Reviewable control</span>
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">How your files are protected</p>
              <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">
                Files are encrypted in your browser before upload. ABRN Drive stores the locked version, delivery metadata, and a record of access events so you can understand what happened without giving up control.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                If the server is breached, your files remain unreadable without the key material that never leaves your control.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="font-medium text-emerald-900 mb-2">The server tracks</p>
                <ul className="space-y-1.5 text-emerald-800">
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />File ownership and folder structure</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />When links and requests were created or revoked</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />Agent key activity and scope denials</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                <p className="font-medium text-sky-900 mb-2">The server cannot see</p>
                <ul className="space-y-1.5 text-sky-800">
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-sky-500 shrink-0" />Your file contents — only encrypted bytes</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-sky-500 shrink-0" />The decryption key in public share link fragments</li>
                  <li className="flex items-start gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-sky-500 shrink-0" />Your PIN or the vault unlock material it derives</li>
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-[#e8d9d0] bg-[#fbf7f3] px-4 py-4 dark:border-slate-700 dark:bg-slate-900/55">
              <p className="font-medium text-slate-900 dark:text-slate-100">Sharing and agent delegation</p>
              <p className="mt-1.5 leading-relaxed text-slate-700 dark:text-slate-300">
                Every link, request, and agent key you create is reviewable and revocable. Agent keys carry explicit scopes for metadata and ciphertext operations, so delegation feels bounded instead of blind.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/45">Scope what an outside system can do</div>
                <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/45">Review when it was last used</div>
                <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/45">Revoke it instantly when the job is done</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <AgentApiKeysSection />

        <AuditLogSection />
    </div>
  );
}
