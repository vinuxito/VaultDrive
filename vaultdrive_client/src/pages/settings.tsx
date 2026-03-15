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
  User,
  Mail,
  Calendar,
  HardDrive,
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
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account preferences and settings
          </p>
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

        {/* Secure Drop PIN */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Secure Drop PIN
            </CardTitle>
            <CardDescription>
              4-digit PIN used to decrypt files uploaded via your Secure Drop links
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pinSet === null ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking PIN status…
              </div>
            ) : pinSet ? (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">PIN is set</p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                    Your Secure Drop links are protected. Use your 4-digit PIN to decrypt received files.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">No PIN set yet</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                    Set a PIN before creating Secure Drop links. You'll need it to decrypt uploaded files.
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
              >
                {pinSet ? "Change PIN" : "Set PIN"}
              </Button>
            ) : (
              <div className="space-y-3 max-w-xs">
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

              <div className="space-y-2">
                <Label className="text-muted-foreground">Security Features</Label>
                <ul className="text-sm space-y-2 ml-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    JWT-based authentication with refresh tokens
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Bcrypt password hashing
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Secure file sharing with public key cryptography
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Server never sees unencrypted files
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy explainer
            </CardTitle>
            <CardDescription>
              Plain-language answers about what ABRN Drive can and cannot see
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="font-medium text-slate-900">What ABRN Drive protects</p>
              <p className="mt-1">
                Your files are encrypted before upload. The server stores ciphertext, metadata needed for delivery, and audit records about what happened.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="font-medium text-emerald-900">The server can see</p>
                <ul className="mt-2 space-y-1 text-emerald-800">
                  <li>Who owns a file</li>
                  <li>When links, requests, or agent keys were created</li>
                  <li>Whether access was shared, revoked, or expired</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                <p className="font-medium text-sky-900">The server cannot see</p>
                <ul className="mt-2 space-y-1 text-sky-800">
                  <li>The plaintext contents of your protected files</li>
                  <li>The decryption key hidden after a public link fragment</li>
                  <li>Your PIN-derived unlock material for normal vault use</li>
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-[#e8d9d0] bg-[#fbf7f3] px-4 py-4">
              <p className="font-medium text-slate-900">Sharing, revocation, and outside agents</p>
              <p className="mt-1">
                ABRN Drive lets you create links, requests, and agent keys that you can review and revoke. Agent API keys are scoped for metadata, ciphertext movement, and control-plane actions. They do not quietly turn the server into a plaintext superuser.
              </p>
            </div>
          </CardContent>
        </Card>

        <AgentApiKeysSection />

        <AuditLogSection />

        {/* Storage Info (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Storage
            </CardTitle>
            <CardDescription>Your file storage information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-medium">View Files page for details</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload encrypted files to start using your secure vault
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
