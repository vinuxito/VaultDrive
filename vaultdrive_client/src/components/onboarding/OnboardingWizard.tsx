import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  createPinProtectedPrivateKey,
  getPinEnrollmentErrorMessage,
} from "../../utils/pin-enrollment";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { mergeUserPinState } from "../../utils/pin-trust";
import { branding } from "../../config/branding";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { setCredential } = useSessionVault();
  const { t } = useTranslation(['drive']);
  const [step, setStep] = useState<Step>(1);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [previousPassword, setPreviousPassword] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const token = localStorage.getItem("token");

  const handleSetPin = async () => {
    setPinError("");
    if (!/^\d{4}$/.test(pin)) {
      setPinError(t("drive:onboarding.pinMustBe4Digits"));
      return;
    }
    if (pin !== confirmPin) {
      setPinError(t("drive:onboarding.pinsDoNotMatch"));
      return;
    }
    if (!passwordInput) {
      setPinError(t("drive:onboarding.enterPasswordForPin"));
      return;
    }
    setSettingPin(true);
    try {
      const user = getStoredUserFromLocalStorage();
      const { privateKeyPinEncrypted, reEncryptedPrivateKey } = await createPinProtectedPrivateKey({
        privateKeyEncrypted: user?.private_key_encrypted ?? null,
        password: passwordInput,
        pin,
        previousPassword: showRecovery ? previousPassword : undefined,
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
      if (user) {
        const updatedUser = mergeUserPinState(user, privateKeyPinEncrypted);
        if (reEncryptedPrivateKey) {
          updatedUser.private_key_encrypted = reEncryptedPrivateKey;
        }
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      localStorage.setItem(`${branding.productSlug}_pin_hint`, "1");
      setCredential(pin, "pin");
      setPasswordInput("");
      setPreviousPassword("");
      setStep(3);
    } catch (err) {
      const msg = getPinEnrollmentErrorMessage(err);
      setPinError(msg);
      if (msg.includes("Incorrect password")) {
        setShowRecovery(true);
      }
    } finally {
      setSettingPin(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setFolderError(t("drive:onboarding.enterFolderName"));
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
    { num: 1, label: t("drive:onboarding.stepPrivacy"), icon: Lock },
    { num: 2, label: t("drive:onboarding.stepSetPin"), icon: Shield },
    { num: 3, label: t("drive:onboarding.stepCreateFolder"), icon: FolderPlus },
    { num: 4, label: t("drive:onboarding.stepReady"), icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="max-w-2xl w-full p-0 overflow-hidden rounded-[2rem] border border-white/20 shadow-[0_30px_80px_rgba(0,0,0,0.5)] my-auto"
        style={{ background: "var(--gradient-page)" }}
      >
        <div className="px-8 pt-8 pb-0">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-white/30 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary-foreground">
              {t("drive:onboarding.ownerSetup")}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {steps.map((s, idx) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-300 ${
                    step === s.num
                      ? "bg-primary text-white ring-2 ring-primary-foreground/30 scale-110 shadow-[0_0_0_10px_rgba(0,0,0,0.16)]"
                      : step > s.num
                      ? "bg-primary/90 text-primary-foreground"
                      : "bg-white/30 text-white/90"
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
                      ? "text-primary-foreground"
                      : step > s.num
                      ? "text-primary-foreground/90"
                      : "text-white/90"
                  }`}
                >
                  {s.label}
                </span>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-8 h-px transition-colors ${
                      step > s.num ? "bg-primary/80" : "bg-white/30"
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
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 mb-2">
                  <Lock className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="flex justify-center">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/30 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground">
                    {t("drive:onboarding.privacyTagline")}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {t("drive:onboarding.privacyTitle")}
                </h2>
                <p className="text-sm text-white/90 max-w-md mx-auto leading-relaxed">
                  {t("drive:onboarding.privacyDescription")}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl border border-white/20 bg-white/30 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="font-medium text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary-foreground" />
                    {t("drive:onboarding.whatStaysPrivate")}
                  </p>
                  <p className="mt-1 text-white/90 leading-relaxed">{t("drive:onboarding.whatStaysPrivateDesc")}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/30 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="font-medium text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary-foreground" />
                    {t("drive:onboarding.whatYouControl")}
                  </p>
                  <p className="mt-1 text-white/90 leading-relaxed">{t("drive:onboarding.whatYouControlDesc")}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/30 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="font-medium text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                    {t("drive:onboarding.agentsBounded")}
                  </p>
                  <p className="mt-1 text-white/90 leading-relaxed">{t("drive:onboarding.agentsBoundedDesc")}</p>
                </div>
              </div>

              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                onClick={() => setStep(2)}
              >
                {t("drive:onboarding.continue")} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 mb-2">
                  <Shield className="w-7 h-7 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {t("drive:onboarding.pinTitle")}
                </h2>
                <p className="text-sm text-white/90 max-w-xs mx-auto">
                  {t("drive:onboarding.pinDescription")}
                </p>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/30 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground">{t("drive:onboarding.afterThisStep")}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-left text-xs text-white/90">
                  <div className="rounded-xl border border-white/10 bg-black/70 px-3 py-2">{t("drive:onboarding.afterStep1")}</div>
                  <div className="rounded-xl border border-white/10 bg-black/70 px-3 py-2">{t("drive:onboarding.afterStep2")}</div>
                  <div className="rounded-xl border border-white/10 bg-black/70 px-3 py-2">{t("drive:onboarding.afterStep3")}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="onboarding-pin" className="text-white/90 text-xs font-medium uppercase tracking-wider">
                    {t("drive:onboarding.pinLabel")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="onboarding-pin"
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="bg-white/30 border-white/20 text-white placeholder:text-white/90 focus:border-primary/60 focus:ring-primary/20 text-center text-2xl tracking-[0.5em] h-12 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/90 hover:text-white transition-colors"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="onboarding-confirm-pin" className="text-white/90 text-xs font-medium uppercase tracking-wider">
                    {t("drive:onboarding.confirmPinLabel")}
                  </Label>
                  <Input
                    id="onboarding-confirm-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                    className="bg-white/30 border-white/20 text-white placeholder:text-white/90 focus:border-primary/60 focus:ring-primary/20 text-center text-2xl tracking-[0.5em] h-12"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="onboarding-account-password" className="text-white/90 text-xs font-medium uppercase tracking-wider">
                    {t("drive:onboarding.accountPasswordLabel")}
                  </Label>
                  <Input
                    id="onboarding-account-password"
                    type="password"
                    placeholder={t("drive:onboarding.accountPasswordPlaceholder")}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                    className="bg-white/30 border-white/20 text-white placeholder:text-white/90 focus:border-primary/60 focus:ring-primary/20 h-12"
                  />
                  <p className="text-xs text-white/90 leading-relaxed">
                    {t("drive:onboarding.accountPasswordHelp", { productName: branding.productName })}
                  </p>
                </div>

                {showRecovery && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="onboarding-previous-password" className="text-amber-200/90 text-xs font-medium uppercase tracking-wider">
                      {t("drive:onboarding.previousPasswordLabel")}
                    </Label>
                    <Input
                      id="onboarding-previous-password"
                      type="password"
                      placeholder={t("drive:onboarding.previousPasswordPlaceholder")}
                      value={previousPassword}
                      onChange={(e) => setPreviousPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                      className="bg-amber-500/30 border-amber-500/30 text-white placeholder:text-white/90 focus:border-amber-500/40 focus:ring-amber-500/10 h-12"
                    />
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      {t("drive:onboarding.previousPasswordHelp")}
                    </p>
                  </div>
                )}

                {pinError && (
                  <p className="text-red-400 text-sm text-center bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2">
                    {pinError}
                  </p>
                )}
              </div>

              <Button
                type="button"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                onClick={() => { void handleSetPin(); }}
                disabled={settingPin || pin.length !== 4 || confirmPin.length !== 4 || passwordInput.length === 0}
              >
                {settingPin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t("drive:onboarding.setPin")} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 mb-2">
                  <FolderPlus className="w-7 h-7 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {t("drive:onboarding.folderTitle")}
                </h2>
                <p className="text-sm text-white/90 max-w-xs mx-auto">
                  {t("drive:onboarding.folderDescription")}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="onboarding-folder-name" className="text-white/90 text-xs font-medium uppercase tracking-wider">
                    {t("drive:onboarding.folderNameLabel")}
                  </Label>
                  <Input
                    id="onboarding-folder-name"
                    type="text"
                    placeholder={t("drive:onboarding.folderNamePlaceholder")}
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    className="bg-white/30 border-white/20 text-white placeholder:text-white/90 focus:border-primary/60 focus:ring-primary/20 h-11"
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
                  data-testid="onboarding-create-folder"
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !folderName.trim()}
                >
                  {creatingFolder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t("drive:onboarding.createFolder")} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-white/90 hover:text-white hover:bg-white/30 rounded-xl text-sm"
                  onClick={handleSkipFolder}
                  disabled={creatingFolder}
                >
                  {t("drive:onboarding.skipForNow")}
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
                <div className="flex justify-center">
                  <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
                    {t("drive:onboarding.readyBadge")}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {t("drive:onboarding.readyTitle")}
                </h2>
                <p className="text-sm text-white/90 max-w-sm mx-auto leading-relaxed">
                  {t("drive:onboarding.readyDescription")}
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-white/20 bg-white/30 px-4 py-4 text-left">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground">{t("drive:onboarding.readyChecklist")}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/70 border border-white/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-sm text-white/90">{t("drive:onboarding.readyCheck1")}</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/70 border border-white/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-sm text-white/90">{t("drive:onboarding.readyCheck2")}</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/70 border border-white/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-sm text-white/90">{t("drive:onboarding.readyCheck3")}</p>
                  </div>
                </div>
              </div>

              <div className="text-left space-y-2">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/30 border border-white/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-sm text-white/90">{t("drive:onboarding.readyCheck4", { productName: branding.productName })}</p>
                </div>
              </div>

              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 gap-2"
                onClick={handleComplete}
              >
                {t("drive:onboarding.enterVault")} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
