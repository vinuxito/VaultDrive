import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Lock, Mail, User, Eye, EyeOff, Fingerprint } from "lucide-react";
import { ABRNLogo, PoweredByBadge } from "../components/branding";
import { API_URL } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useSessionVault } from "../context/SessionVaultContext";
import {
  decryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
} from "../utils/crypto";

export default function Login() {
  const navigate = useNavigate();
  const { setPrivateKey } = useSessionVault();
  const [isLogin, setIsLogin] = useState(true);
  const [loginMode, setLoginMode] = useState<"password" | "pin">("password");
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

      localStorage.setItem("token", data.token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          username: data.username,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          is_admin: data.is_admin,
          pin_set: data.pin_set,
          private_key_encrypted: data.private_key_encrypted,
          private_key_pin_encrypted: data.private_key_pin_encrypted || null,
          public_key: data.public_key,
        })
      );

      window.dispatchEvent(new Event("auth-change"));

      try {
        if (loginMode === "password" && data.private_key_encrypted) {
          const pem = await decryptPrivateKeyWithPassword(
            loginData.password,
            data.private_key_encrypted,
          );
          const cryptoKey = await importRSAPrivateKey(pem);
          setPrivateKey(cryptoKey);
        } else if (loginMode === "pin" && data.private_key_pin_encrypted) {
          const pem = await decryptPrivateKeyWithPIN(pinValue, data.private_key_pin_encrypted);
          const cryptoKey = await importRSAPrivateKey(pem);
          setPrivateKey(cryptoKey);
        }
      } catch {
      }

      navigate("/");
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
    <div className="abrn-page-bg flex items-center justify-center p-4" style={{ minHeight: "calc(100vh - 80px)" }}>
      <div className="abrn-glass-card w-full max-w-md p-0 overflow-hidden">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ABRNLogo className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Welcome to ABRN Drive" : "Join ABRN Drive"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Secure, encrypted cloud storage for your business"
              : "Create your account and start protecting your files"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex rounded-lg border border-input overflow-hidden">
                <button
                  type="button"
                  onClick={() => switchLoginMode("password")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    loginMode === "password"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
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
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  PIN
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {loginMode === "password" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
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
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Fingerprint className="w-4 h-4" />
                    4-digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={pinValue}
                    onChange={(e) =>
                      setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-widest text-xl"
                    required
                    autoFocus
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
                className="w-full"
                disabled={
                  loading ||
                  (loginMode === "pin" && pinValue.length !== 4)
                }
              >
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="John"
                      value={registerData.first_name}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          first_name: e.target.value,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    type="text"
                    placeholder="Doe"
                    value={registerData.last_name}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        last_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="johndoe"
                    value={registerData.username}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        username: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        email: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            {isLogin ? (
              <p>
                Don't have an account?{" "}
                <button
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
