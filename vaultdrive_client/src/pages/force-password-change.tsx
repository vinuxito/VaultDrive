import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { BrandLogo } from "../components/branding";
import { API_URL } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useSessionVault } from "../context/SessionVaultContext";
import {
  decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPassword,
  importRSAPrivateKey,
} from "../utils/crypto";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import { useTranslation } from "react-i18next";

/**
 * Full-screen password change gate.
 * No close button, no navigation, no escape.
 * The only action is submitting a new password.
 * Like a building that requires you to badge in with a new keycard
 * before the elevator doors will open.
 */
export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const { setPrivateKey, setCredential } = useSessionVault();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [previousEnvelopePassword, setPreviousEnvelopePassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Guard: must be logged in with force_password_change flag
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = getStoredUserFromLocalStorage() ?? {};
    if (!token) {
      navigate("/login", { replace: true });
    } else if (!user.force_password_change) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError(t("forcePassword.tooShort", { defaultValue: "New password must be at least 8 characters" }));
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError(t("forcePassword.tooLong", { defaultValue: "New password must be 72 bytes or fewer" }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("forcePassword.mismatch", { defaultValue: "Passwords do not match" }));
      return;
    }

    if (oldPassword === newPassword) {
      setError(t("forcePassword.mustDiffer", { defaultValue: "New password must be different from current password" }));
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const storedUser = getStoredUserFromLocalStorage() ?? {};

      // Re-encrypt private key with new password so file decryption continues to work
      let reEncryptedKey = "";
      let verifiedPrivateKey: CryptoKey | null = null;
      let verifiedPrivateKeyPem = "";
      if (storedUser.private_key_encrypted) {
        try {
          const envelopeVersion = typeof storedUser.kek_envelope_version === "number"
            ? storedUser.kek_envelope_version
            : 1;
          const envelopePassword = previousEnvelopePassword || oldPassword;
          const pem = await decryptPrivateKeyWithPassword(
            envelopePassword,
            storedUser.private_key_encrypted,
            envelopeVersion,
          );
          reEncryptedKey = await encryptPrivateKeyWithPassword(newPassword, pem, envelopeVersion);
          verifiedPrivateKeyPem = await decryptPrivateKeyWithPassword(newPassword, reEncryptedKey, envelopeVersion);
          if (verifiedPrivateKeyPem !== pem) {
            throw new Error("new wrapper did not preserve the account key");
          }
          verifiedPrivateKey = await importRSAPrivateKey(verifiedPrivateKeyPem);
        } catch {
          throw new Error(
            t("forcePassword.keyUnlockFailed", { defaultValue: "We could not unlock your account key with the current password. Your password was not changed. Sign out and try again, or start account recovery." }),
          );
        }
      }

      const requestBody: Record<string, string | number> = {
        old_password: oldPassword,
        new_password: newPassword,
      };
      if (reEncryptedKey) {
        requestBody.private_key_encrypted = reEncryptedKey;
        requestBody.kek_envelope_version = typeof storedUser.kek_envelope_version === "number"
          ? storedUser.kek_envelope_version
          : 1;
      }

      const response = await fetch(`${API_URL}/users/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("forcePassword.changeFailed", { defaultValue: "Failed to change password" }));
      }

      // Update localStorage: clear force flag + update encrypted key if re-encrypted
      const updatedUser = {
        ...storedUser,
        force_password_change: false,
        ...(reEncryptedKey ? { private_key_encrypted: reEncryptedKey } : {}),
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // The wrapper and imported key were verified before the server mutation.
      if (verifiedPrivateKey && verifiedPrivateKeyPem) {
        setPrivateKey(verifiedPrivateKey, verifiedPrivateKeyPem);
        setCredential(newPassword, "password");
      }

      // Redirect to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("forcePassword.changeFailed", { defaultValue: "Failed to change password" }));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login", { replace: true });
  };

  return (
    <div className="brand-page-bg flex items-center justify-center p-4" style={{ minHeight: "100vh" }}>
      <div className="brand-glass-card w-full max-w-md p-0 overflow-hidden border-border shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BrandLogo className="w-16 h-16" />
          </div>
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-3">
              <ShieldAlert className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-xl">{t("forcePassword.title", { defaultValue: "Password Change Required" })}</CardTitle>
          <CardDescription>
            {t("forcePassword.description", { defaultValue: "Your administrator has required you to set a new password before you can continue." })}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="old-password" className="text-sm font-medium">
                {t("forcePassword.current", { defaultValue: "Current Password" })}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="old-password"
                  type={showOld ? "text" : "password"}
                  placeholder={t("forcePassword.currentPlaceholder", { defaultValue: "Enter current password" })}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  aria-label={showOld ? t("credentials.hidePassword") : t("credentials.showPassword")}
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="previous-envelope-password" className="text-sm font-medium">
                {t("forcePassword.previousEnvelope", { defaultValue: "Previous password (only if an administrator reset your login)" })}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("forcePassword.previousEnvelopeHelp", { defaultValue: "This stays in your browser and is used only to unlock your existing account key." })}
              </p>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="previous-envelope-password"
                  type={showPrevious ? "text" : "password"}
                  placeholder={t("forcePassword.previousEnvelopePlaceholder", { defaultValue: "Optional previous password" })}
                  value={previousEnvelopePassword}
                  onChange={(e) => setPreviousEnvelopePassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  autoComplete="off"
                />
                <button
                  type="button"
                  aria-label={showPrevious ? t("credentials.hidePreviousPassword") : t("credentials.showPreviousPassword")}
                  onClick={() => setShowPrevious(!showPrevious)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPrevious ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-medium">
                {t("forcePassword.new", { defaultValue: "New Password" })}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder={t("forcePassword.newPlaceholder", { defaultValue: "8–72 bytes" })}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  minLength={8}
                  maxLength={72}
                />
                <button
                  type="button"
                  aria-label={showNew ? t("credentials.hideNewPassword") : t("credentials.showNewPassword")}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                {t("forcePassword.confirm", { defaultValue: "Confirm New Password" })}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="confirm-password"
                  type="password"
                  placeholder={t("forcePassword.confirmPlaceholder", { defaultValue: "Re-enter new password" })}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  maxLength={72}
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">{t("forcePassword.mismatch", { defaultValue: "Passwords do not match" })}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_12px_28px_rgba(0,0,0,0.25)]"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {loading
                ? t("forcePassword.changing", { defaultValue: "Changing password..." })
                : t("forcePassword.submit", { defaultValue: "Set New Password" })}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("forcePassword.signOut", { defaultValue: "Sign out instead" })}
            </button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
