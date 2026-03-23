import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { ABRNLogo } from "../components/branding";
import { API_URL } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useSessionVault } from "../context/SessionVaultContext";
import {
  decryptPrivateKeyWithPassword,
  encryptPrivateKeyWithPassword,
  importRSAPrivateKey,
} from "../utils/crypto";

/**
 * Full-screen password change gate.
 * No close button, no navigation, no escape.
 * The only action is submitting a new password.
 * Like a building that requires you to badge in with a new keycard
 * before the elevator doors will open.
 */
export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const { setPrivateKey, setCredential } = useSessionVault();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Guard: must be logged in with force_password_change flag
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
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
      setError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (oldPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

      // Re-encrypt private key with new password so file decryption continues to work
      let reEncryptedKey = "";
      if (storedUser.private_key_encrypted) {
        try {
          const pem = await decryptPrivateKeyWithPassword(
            oldPassword,
            storedUser.private_key_encrypted,
          );
          reEncryptedKey = await encryptPrivateKeyWithPassword(newPassword, pem);
        } catch {
          // If decryption fails (e.g. admin reset the password server-side
          // with a different encryption path), proceed without re-encryption.
          // The user may need to re-enroll their keys separately.
        }
      }

      const requestBody: Record<string, string> = {
        old_password: oldPassword,
        new_password: newPassword,
      };
      if (reEncryptedKey) {
        requestBody.private_key_encrypted = reEncryptedKey;
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
        throw new Error(data.error || "Failed to change password");
      }

      // Update localStorage: clear force flag + update encrypted key if re-encrypted
      const updatedUser = {
        ...storedUser,
        force_password_change: false,
        ...(reEncryptedKey ? { private_key_encrypted: reEncryptedKey } : {}),
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // Initialize SessionVault with the private key so file decryption works
      // after landing on dashboard (mirrors the login.tsx vault init flow)
      try {
        const keyToDecrypt = reEncryptedKey || storedUser.private_key_encrypted;
        if (keyToDecrypt) {
          const pem = await decryptPrivateKeyWithPassword(newPassword, keyToDecrypt);
          const cryptoKey = await importRSAPrivateKey(pem);
          setPrivateKey(cryptoKey);
          setCredential(newPassword, "password");
        }
      } catch {
        // Non-fatal: user can still access dashboard, but encrypted files
        // won't decrypt until next full login. Acceptable degradation.
      }

      // Redirect to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
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
    <div className="abrn-page-bg flex items-center justify-center p-4" style={{ minHeight: "100vh" }}>
      <div className="abrn-glass-card w-full max-w-md p-0 overflow-hidden border-white/70 shadow-[0_24px_60px_rgba(125,79,80,0.12)]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ABRNLogo className="w-16 h-16" />
          </div>
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-amber-100 p-3">
              <ShieldAlert className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Password Change Required</CardTitle>
          <CardDescription>
            Your administrator has required you to set a new password before you can continue.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="old-password" className="text-sm font-medium">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="old-password"
                  type={showOld ? "text" : "password"}
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#7d4f50] hover:bg-[#6b4345] text-white shadow-[0_12px_28px_rgba(125,79,80,0.25)]"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {loading ? "Changing password..." : "Set New Password"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out instead
            </button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
