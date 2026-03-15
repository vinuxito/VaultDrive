import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Shield,
  FolderPlus,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Bot,
} from "lucide-react";
import { API_URL } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import { createPinProtectedPrivateKey } from "../../utils/pin-enrollment";
import { mergeUserPinState } from "../../utils/pin-trust";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { setCredential } = useSessionVault();
  const [step, setStep] = useState<Step>(1);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const token = localStorage.getItem("token");

  const handleSetPin = async () => {
    setPinError("");
    if (!/^\d{4}$/.test(pin)) {
      setPinError("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setPinError("PINs do not match.");
      return;
    }
    if (!passwordInput) {
      setPinError("Enter your account password to finish PIN setup.");
      return;
    }
    setSettingPin(true);
    try {
      const stored = localStorage.getItem("user");
      const user = stored ? JSON.parse(stored) : null;
      const privateKeyPinEncrypted = await createPinProtectedPrivateKey({
        privateKeyEncrypted: user?.private_key_encrypted ?? null,
        password: passwordInput,
        pin,
      });

      const res = await fetch(`${API_URL}/users/pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin,
          private_key_pin_encrypted: privateKeyPinEncrypted,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to set PIN");
      }
      if (stored) {
        localStorage.setItem(
          "user",
          JSON.stringify(mergeUserPinState(user, privateKeyPinEncrypted)),
        );
      }
      setCredential(pin, "pin");
      setPasswordInput("");
      setStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set PIN";
      if (message.includes("Decryption failed") || message.includes("decrypt")) {
        setPinError("Incorrect password — enter your account login password.");
      } else {
        setPinError(message);
      }
    } finally {
      setSettingPin(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setFolderError("Please enter a folder name.");
      return;
    }
    setFolderError("");
    setCreatingFolder(true);
    try {
      const res = await fetch(`${API_URL}/folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: folderName.trim(), parent_id: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create folder");
      }
      setStep(4);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleSkipFolder = () => {
    setStep(4);
  };

  const handleComplete = () => {
    onComplete();
  };

  const steps = [
    { num: 1, label: "Privacy", icon: Lock },
    { num: 2, label: "Set PIN", icon: Shield },
    { num: 3, label: "Create Folder", icon: FolderPlus },
    { num: 4, label: "Ready!", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="max-w-lg w-full mx-4 p-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "linear-gradient(145deg, #2a1215 0%, #1a0a0c 100%)" }}
      >
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, idx) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 ${
                    step === s.num
                      ? "bg-[#7d4f50] text-white ring-2 ring-[#f2d7d8]/30 scale-110"
                      : step > s.num
                      ? "bg-[#7d4f50]/40 text-[#f2d7d8]"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {step > s.num ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    s.num
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block transition-colors ${
                    step === s.num
                      ? "text-[#f2d7d8]"
                      : step > s.num
                      ? "text-[#f2d7d8]/50"
                      : "text-white/30"
                  }`}
                >
                  {s.label}
                </span>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-8 h-px transition-colors ${
                      step > s.num ? "bg-[#7d4f50]/60" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 pb-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7d4f50]/20 border border-[#7d4f50]/30 mb-2">
                  <Lock className="w-7 h-7 text-[#f2d7d8]" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Calm by design
                </h2>
                <p className="text-sm text-white/50 max-w-md mx-auto leading-relaxed">
                  ABRN Drive encrypts files before upload, lets you see who can access them, and keeps risky access revocable.
                </p>
              </div>

              <div className="space-y-3 text-sm text-white/80">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-medium text-white">What the server can do</p>
                  <p className="mt-1 text-white/60">Store ciphertext, create links and requests, show access history, and let you revoke external reach quickly.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-medium text-white">What the server cannot do</p>
                  <p className="mt-1 text-white/60">It does not quietly become a plaintext superuser for your protected files.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-medium text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#f2d7d8]" />
                    External agents stay scoped
                  </p>
                  <p className="mt-1 text-white/60">Agent keys can automate control-plane work without silently dissolving the trust boundary.</p>
                </div>
              </div>

              <Button
                className="w-full h-11 bg-[#7d4f50] hover:bg-[#6b4345] text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7d4f50]/20 border border-[#7d4f50]/30 mb-2">
                  <Shield className="w-7 h-7 text-[#f2d7d8]" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Set your PIN
                </h2>
                <p className="text-sm text-white/50 max-w-xs mx-auto">
                  A 4-digit PIN secures your vault, future shares, Secure Drop, and quick login.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    4-Digit PIN
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#7d4f50]/60 focus:ring-[#7d4f50]/20 text-center text-2xl tracking-[0.5em] h-12 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    Confirm PIN
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#7d4f50]/60 focus:ring-[#7d4f50]/20 text-center text-2xl tracking-[0.5em] h-12"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    Account Password
                  </Label>
                  <Input
                    type="password"
                    placeholder="Enter your login password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#7d4f50]/60 focus:ring-[#7d4f50]/20 h-12"
                  />
                  <p className="text-xs text-white/40 leading-relaxed">
                    We use this once to re-wrap your private key so your one PIN works everywhere in ABRN Drive.
                  </p>
                </div>

                {pinError && (
                  <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {pinError}
                  </p>
                )}
              </div>

              <Button
                className="w-full h-11 bg-[#7d4f50] hover:bg-[#6b4345] text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                onClick={handleSetPin}
                disabled={settingPin || pin.length !== 4 || confirmPin.length !== 4 || passwordInput.length === 0}
              >
                {settingPin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Set PIN <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7d4f50]/20 border border-[#7d4f50]/30 mb-2">
                  <FolderPlus className="w-7 h-7 text-[#f2d7d8]" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Create a client folder
                </h2>
                <p className="text-sm text-white/50 max-w-xs mx-auto">
                  Organize incoming files from clients with a dedicated folder.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    Folder Name
                  </Label>
                  <Input
                    type="text"
                    placeholder="e.g. Client Uploads"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#7d4f50]/60 focus:ring-[#7d4f50]/20 h-11"
                  />
                </div>

                {folderError && (
                  <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {folderError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full h-11 bg-[#7d4f50] hover:bg-[#6b4345] text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !folderName.trim()}
                >
                  {creatingFolder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Create Folder <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-xl text-sm"
                  onClick={handleSkipFolder}
                  disabled={creatingFolder}
                >
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  You're ready!
                </h2>
                <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
                  Your vault is active. Share the button below to get files from
                  clients.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 space-y-3">
                <p className="text-xs text-white/40 uppercase tracking-wider font-medium">
                  Client Upload Link
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7d4f50]/20 border border-[#7d4f50]/30 rounded-lg text-[#f2d7d8] text-sm font-medium">
                  <FolderPlus className="w-4 h-4" />
                  Send me files
                </div>
                <p className="text-xs text-white/30">
                  Go to Files → Drop Links to create and share your upload link
                </p>
              </div>

              <Button
                className="w-full h-11 bg-[#7d4f50] hover:bg-[#6b4345] text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                onClick={handleComplete}
              >
                Go to Vault <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
