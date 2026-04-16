import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Lock, Mail, User, Eye, EyeOff, Fingerprint } from "lucide-react";
import { BrandLogo, PoweredByBadge } from "../components/branding";
import { API_URL } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useSessionVault } from "../context/SessionVaultContext";
import { branding } from "../config/branding";
import {
  decryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
} from "../utils/crypto";

export default function Login() {
  const navigate = useNavigate();
  const { setPrivateKey, setCredential, clearVault } = useSessionVault();
  const [isLogin, setIsLogin] = useState(true);
  const [loginMode, setLoginMode] = useState<"password" | "pin">(
    localStorage.getItem(`${branding.productSlug}_pin_hint`) === "1" ? "pin" : "password"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [pinValue, setPinValue] = useState("");

  const [registerData, setRegisterData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body =
        loginMode === "pin"
          ? { email: loginData.email, pin: pinValue }
          : { email: loginData.email, password: loginData.password };

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      clearVault();

      localStorage.setItem("token", data.token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: data.id,
          username: data.username,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          is_admin: data.is_admin,
          pin_set: data.pin_set,
          force_password_change: data.force_password_change || false,
          private_key_encrypted: data.private_key_encrypted,
          private_key_pin_encrypted: data.private_key_pin_encrypted || null,
          public_key: data.public_key,
        })
      );

      window.dispatchEvent(new Event("auth-change"));

      // Force password change gate — no vault access until password is changed
      if (data.force_password_change) {
        navigate("/force-password-change", { replace: true });
        return;
      }

      try {
        if (loginMode === "password" && data.private_key_encrypted) {
          const pem = await decryptPrivateKeyWithPassword(
            loginData.password,
            data.private_key_encrypted,
          );
          const cryptoKey = await importRSAPrivateKey(pem);
          setPrivateKey(cryptoKey);
          setCredential(loginData.password, "password");
        } else if (loginMode === "pin" && data.private_key_pin_encrypted) {
          const pem = await decryptPrivateKeyWithPIN(pinValue, data.private_key_pin_encrypted);
          const cryptoKey = await importRSAPrivateKey(pem);
          setPrivateKey(cryptoKey);
          setCredential(pinValue, "pin");
          localStorage.setItem(`${branding.productSlug}_pin_hint`, "1");
        }
      } catch {
      }

      navigate(data.pin_set ? "/" : "/files");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Registration failed");
      }

      setLoginData({ email: registerData.email, password: registerData.password });
      setIsLogin(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const switchLoginMode = (mode: "password" | "pin") => {
    setLoginMode(mode);
    setError("");
    setPinValue("");
  };

  return (
    <div className="brand-page-bg flex items-center justify-center p-4" style={{ minHeight: "calc(100vh - 80px)" }}>
      <div className="brand-glass-card w-full max-w-md p-0 overflow-hidden shadow-[var(--shadow-glow-primary)]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <span className="brand-badge">Private access</span>
          </div>
          <div className="flex justify-center mb-4">
            <BrandLogo className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? `Welcome to ${branding.productName}` : `Join ${branding.productName}`}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "A calm, encrypted control plane for files you need to trust at a glance"
              : "Create your account and set up the trust-first vault experience"}
          </CardDescription>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 text-left text-[11px] text-muted-foreground">
            <div className="rounded-[var(--radius)] border-2 border-[var(--glass-border-strong)] bg-muted/30 px-3 py-2">Encryption happens in your browser</div>
            <div className="rounded-[var(--radius)] border-2 border-[var(--glass-border-strong)] bg-muted/30 px-3 py-2">One PIN after setup for normal owner flows</div>
            <div className="rounded-[var(--radius)] border-2 border-[var(--glass-border-strong)] bg-muted/30 px-3 py-2">Access stays visible and revocable</div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex rounded-[var(--radius)] border border-border overflow-hidden bg-muted/20">
                <button
                  type="button"
                  onClick={() => switchLoginMode("password")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    loginMode === "password"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => switchLoginMode("pin")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    loginMode === "pin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  PIN
                </button>
              </div>

              <div className="rounded-[var(--radius)] border-2 border-[var(--glass-border-strong)] bg-card/50 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <p className="font-medium text-foreground">
                  {loginMode === "password" ? "Use your account password to enter and finish setup." : "Use your 4-digit PIN when your trusted owner session is already set up."}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {loginMode === "password"
                    ? `Once your PIN is enrolled, ${branding.productName} can reuse that trust across the vault, secure links, and protected handoffs.`
                    : "Your PIN unlocks the owner trust path without reintroducing normal per-action friction."}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all"
                    required
                  />
                </div>
              </div>

              {loginMode === "password" ? (
                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                    className="w-full pl-10 pr-10 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="login-pin" className="text-sm font-medium flex items-center gap-2">
                    <Fingerprint className="w-4 h-4" />
                    4-digit PIN
                  </label>
                  <input
                    id="login-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={pinValue}
                    onChange={(e) =>
                      setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="w-full px-4 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all text-center tracking-widest text-xl"
                    required
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Don't have a PIN?{" "}
                    <button
                      type="button"
                      onClick={() => switchLoginMode("password")}
                      className="text-primary hover:underline"
                    >
                      Log in with password
                    </button>
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                disabled={
                  loading ||
                  (loginMode === "pin" && pinValue.length !== 4)
                }
              >
                {loading ? "Logging in..." : isLogin ? `Open ${branding.productName}` : "Continue securely"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="register-first-name" className="text-sm font-medium">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      id="register-first-name"
                      type="text"
                      placeholder="John"
                      value={registerData.first_name}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          first_name: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-last-name" className="text-sm font-medium">Last Name</label>
                  <input
                    id="register-last-name"
                    type="text"
                    placeholder="Doe"
                    value={registerData.last_name}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        last_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-username" className="text-sm font-medium">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="register-username"
                    type="text"
                    placeholder="johndoe"
                    value={registerData.username}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        username: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        email: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 bg-background/50 border-2 border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:shadow-[var(--shadow-glow-primary)] transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={registerData.password}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        password: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-glow-primary)] rounded-[var(--radius)] border-2 border-primary/50"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            {isLogin ? (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  Login
                </button>
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <PoweredByBadge />
          </div>
        </CardContent>
      </div>
    </div>
  );
}
