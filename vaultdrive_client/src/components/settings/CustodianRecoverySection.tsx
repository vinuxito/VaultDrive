import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import {
  Users,
  Search,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { getStoredUserFromLocalStorage } from "../../utils/browser-storage";
import { branding } from "../../config/branding";
import {
  decryptPrivateKeyWithPIN,
  decryptPrivateKeyWithPassword,
  importRSAPublicKey,
  wrapKeyWithRSA,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  importRSAPrivateKey,
  unwrapKeyWithRSA,
} from "../../utils/crypto";
import { shamirSplit } from "../../utils/shamir";
import { useSessionVault } from "../../context/SessionVaultContext";

export function CustodianRecoverySection() {
  const { t } = useTranslation(["drive"]);
  const { getCredential } = useSessionVault();

  const [currentUser] = useState(() => getStoredUserFromLocalStorage());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [selectedCustodians, setSelectedCustodians] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(2);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeThreshold, setActiveThreshold] = useState<number | null>(null);
  const [activeCustodians, setActiveCustodians] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Custodian approvals list
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalPasswordInput, setApprovalPasswordInput] = useState("");
  const [showApprovalPromptId, setShowApprovalPromptId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveConfig();
    fetchPendingRequests();
  }, [currentUser]);

  const fetchActiveConfig = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(
        `${branding.apiBasePath}/v1/recovery/status?username=${currentUser.username}`
      );
      if (response.ok) {
        const data = await response.json();
        setActiveThreshold(data.threshold || null);
        setActiveCustodians(data.shares || []);
      }
    } catch (err) {
      console.error("Failed to fetch recovery config:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchPendingRequests = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch recovery requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${branding.apiBasePath}/users/search?q=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        // Exclude current user from search results
        setSearchResults(data.filter((u: any) => u.id !== currentUser?.id));
      } else {
        setError("Failed to search users.");
      }
    } catch (err) {
      setError("Search request failed.");
    } finally {
      setSearching(false);
    }
  };

  const addCustodian = (user: any) => {
    if (selectedCustodians.some((c) => c.id === user.id)) return;
    setSelectedCustodians([...selectedCustodians, user]);
    setSearchResults([]);
    setSearchQuery("");
  };

  const removeCustodian = (id: string) => {
    setSelectedCustodians(selectedCustodians.filter((c) => c.id !== id));
  };

  const handleEnableRecovery = async (passwordOrPinToUse?: string) => {
    setError("");
    setSuccess("");
    
    const credential = getCredential();
    const keyVal = passwordOrPinToUse || credential?.value;
    
    if (!keyVal) {
      setShowPasswordPrompt(true);
      return;
    }

    setSaving(true);
    try {
      // 1. Decrypt private key PEM
      let privateKeyPem = "";
      const isPin = keyVal.length === 4 && /^\d+$/.test(keyVal);
      
      if (isPin && currentUser?.private_key_pin_encrypted) {
        privateKeyPem = await decryptPrivateKeyWithPIN(
          keyVal,
          currentUser.private_key_pin_encrypted,
          currentUser.kek_envelope_version as number | undefined
        );
      } else if (currentUser?.private_key_encrypted) {
        privateKeyPem = await decryptPrivateKeyWithPassword(
          keyVal,
          currentUser.private_key_encrypted,
          currentUser.kek_envelope_version as number | undefined
        );
      } else {
        throw new Error("Unable to locate private key metadata.");
      }

      // 2. Convert private key PEM string to bytes
      const secretBytes = new TextEncoder().encode(privateKeyPem);

      // Sort custodians by ID lexicographically to ensure deterministic 1-based index (x coordinate) matching between split and reconstruction.
      const sortedCustodians = [...selectedCustodians].sort((a, b) => a.id.localeCompare(b.id));

      // 3. Split the key bytes using Shamir's Secret Sharing
      const shares = shamirSplit(secretBytes, sortedCustodians.length, threshold);

      // 4. Wrap each share with custodian's public key (hybrid encryption)
      const token = localStorage.getItem("token");
      const sharesPayload: any[] = [];

      for (let i = 0; i < sortedCustodians.length; i++) {
        const custodian = sortedCustodians[i];
        
        // Fetch custodian public key
        const pubKeyResponse = await fetch(
          `${branding.apiBasePath}/users/${custodian.id}/public-key`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!pubKeyResponse.ok) {
          throw new Error(`Failed to retrieve public key for ${custodian.username}`);
        }
        const pubKeyData = await pubKeyResponse.json();
        
        // Import custodian public RSA key
        const custodianPubKey = await importRSAPublicKey(pubKeyData.public_key);

        // Generate a random AES wrapping key for this share
        const aesKey = await window.crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );

        // Encrypt the share bytes with AES key
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedShare = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          aesKey,
          shares[i].y as any
        );

        // Wrap the AES key with custodian's public RSA key
        const wrappedKeyBase64 = await wrapKeyWithRSA(custodianPubKey, aesKey);

        const wrappedSharePayload = JSON.stringify({
          wrapped_key: wrappedKeyBase64,
          iv: arrayBufferToBase64(iv),
          ciphertext: arrayBufferToBase64(encryptedShare),
        });

        sharesPayload.push({
          custodian_id: custodian.id,
          wrapped_share_payload: wrappedSharePayload,
        });
      }

      // 5. Submit wrapped shares and threshold to backend
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          threshold: threshold,
          shares: sharesPayload,
        }),
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Failed to save recovery configuration.");
      }

      setSuccess(t("drive:recovery.savedSuccess"));
      setSelectedCustodians([]);
      setShowPasswordPrompt(false);
      setPasswordInput("");
      
      // Refresh configurations
      await fetchActiveConfig();
    } catch (err: any) {
      setError(err.message || "Failed to enable custodian recovery.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveRequest = async (request: any, passwordOrPinToUse?: string) => {
    setError("");
    setSuccess("");

    const credential = getCredential();
    const keyVal = passwordOrPinToUse || credential?.value;

    if (!keyVal) {
      setShowApprovalPromptId(request.id);
      return;
    }

    setApprovingId(request.id);
    try {
      // 1. Decrypt custodian's private key PEM
      let privateKeyPem = "";
      const isPin = keyVal.length === 4 && /^\d+$/.test(keyVal);
      
      if (isPin && currentUser?.private_key_pin_encrypted) {
        privateKeyPem = await decryptPrivateKeyWithPIN(
          keyVal,
          currentUser.private_key_pin_encrypted,
          currentUser.kek_envelope_version as number | undefined
        );
      } else if (currentUser?.private_key_encrypted) {
        privateKeyPem = await decryptPrivateKeyWithPassword(
          keyVal,
          currentUser.private_key_encrypted,
          currentUser.kek_envelope_version as number | undefined
        );
      } else {
        throw new Error("Unable to locate private key metadata.");
      }

      const custodianPrivateKey = await importRSAPrivateKey(privateKeyPem);

      // 2. Parse the wrapped share payload
      const shareEnvelope = JSON.parse(request.wrapped_share_payload);
      const wrappedKeyBytes = shareEnvelope.wrapped_key;
      const ivBytes = new Uint8Array(base64ToArrayBuffer(shareEnvelope.iv));
      const ciphertextBytes = new Uint8Array(base64ToArrayBuffer(shareEnvelope.ciphertext));

      // 3. Unwrap the AES key
      const aesKey = await unwrapKeyWithRSA(custodianPrivateKey, wrappedKeyBytes);

      // 4. Decrypt the share ciphertext
      const decryptedShareBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        aesKey,
        ciphertextBytes
      );

      const decryptedSharePartHex = Array.from(new Uint8Array(decryptedShareBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 5. Submit approval with decrypted share part
      const token = localStorage.getItem("token");
      const response = await fetch(`${branding.apiBasePath}/v1/recovery/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          owner_id: request.owner_id,
          decrypted_share_part: decryptedSharePartHex,
        }),
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Failed to submit approval.");
      }

      setSuccess(`Aprobación enviada con éxito para ${request.owner_username}.`);
      setShowApprovalPromptId(null);
      setApprovalPasswordInput("");
      
      // Refresh pending requests
      await fetchPendingRequests();
    } catch (err: any) {
      setError(err.message || "Approval failed.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {t("drive:recovery.setupTitle")}
          </CardTitle>
          <CardDescription>
            {t("drive:recovery.setupDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Active Configuration */}
          {loadingConfig ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading configuration...
            </div>
          ) : activeThreshold ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20 px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                    Custodian Recovery Active
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Threshold: {activeThreshold} of {activeCustodians.length} approvals
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-1.5">{t("drive:recovery.activeCustodians")}:</p>
                <div className="grid gap-1.5 sm:grid-cols-2 text-xs">
                  {activeCustodians.map((c) => (
                    <div key={c.custodian_id} className="rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{c.custodian_first_name} {c.custodian_last_name}</p>
                        <p className="text-[10px] text-muted-foreground">@{c.custodian_username}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        c.status === "approved" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/10 px-3 py-3 text-xs text-amber-800 dark:text-amber-400 leading-relaxed shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Account recovery is not set up</p>
                <p className="mt-0.5">Configure custodians below to secure a safety boundary for your account.</p>
              </div>
            </div>
          )}

          {/* Search section */}
          <div className="space-y-2">
            <Label htmlFor="custodian-search">{t("drive:recovery.custodianSearch")}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="custodian-search"
                  type="text"
                  placeholder="Type username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md bg-background border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} variant="outline" className="shrink-0 text-sm">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-md bg-popover text-popover-foreground shadow-md divide-y max-h-40 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => addCustodian(user)}
                    className="w-full px-3 py-2 text-left hover:bg-muted text-xs flex justify-between items-center transition-colors"
                  >
                    <div>
                      <p className="font-semibold">{user.first_name} {user.last_name}</p>
                      <p className="text-muted-foreground">@{user.username} • {user.email}</p>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected custodians */}
          {selectedCustodians.length > 0 && (
            <div className="space-y-3 p-3 border rounded-xl bg-muted/40">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Selected Custodians</Label>
              <div className="space-y-1.5">
                {selectedCustodians.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-card border px-3 py-1.5 rounded-lg text-xs">
                    <div>
                      <p className="font-semibold">{c.first_name} {c.last_name}</p>
                      <p className="text-[10px] text-muted-foreground">@{c.username} • {c.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustodian(c.id)}
                      className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Threshold Configuration */}
              <div className="space-y-1.5 pt-3 border-t">
                <Label htmlFor="threshold-select" className="text-xs font-semibold">{t("drive:recovery.thresholdLabel")}</Label>
                <select
                  id="threshold-select"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {selectedCustodians.map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {idx + 1} of {selectedCustodians.length} approvals
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  {t("drive:recovery.thresholdDesc")}
                </p>
              </div>

              {/* Password prompt if required */}
              {showPasswordPrompt && (
                <div className="space-y-2 p-3 border border-primary/20 bg-primary/5 dark:bg-primary/90 rounded-xl space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="setup-password">Account Password / PIN</Label>
                  <input
                    id="setup-password"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password or PIN to decrypt private key"
                    className="w-full px-3 py-2 border rounded-md bg-background border-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    Required to decrypt your private key PEM browser-side so it can be split into cryptographic shares.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </p>
              )}

              <Button
                onClick={() => handleEnableRecovery(passwordInput)}
                disabled={saving || selectedCustodians.length < 1}
                className="w-full text-xs"
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Creating Shares...</>
                ) : (
                  t("drive:recovery.saveConfig")
                )}
              </Button>
            </div>
          )}

          {success && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {success}
            </p>
          )}

        </CardContent>
      </Card>

      {/* Custodian Approvals Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            {t("drive:recovery.pendingRequests")}
          </CardTitle>
          <CardDescription>
            Approve account recovery requests for users who nominated you as a custodian.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {loadingRequests ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t("drive:recovery.noRequests")}</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{req.owner_first_name} {req.owner_last_name}</p>
                      <p className="text-xs text-muted-foreground">@{req.owner_username} • {req.owner_email}</p>
                    </div>
                    <span className="brand-badge bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px]">Pending approval</span>
                  </div>

                  {showApprovalPromptId === req.id && (
                    <div className="space-y-2 p-3 border rounded-xl bg-muted/40 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label htmlFor={`approve-password-${req.id}`} className="text-xs">Your Password / PIN</Label>
                      <input
                        id={`approve-password-${req.id}`}
                        type="password"
                        value={approvalPasswordInput}
                        onChange={(e) => setApprovalPasswordInput(e.target.value)}
                        placeholder="Enter password or PIN to approve"
                        className="w-full px-3 py-1.5 border rounded-md bg-background border-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <p className="text-[9px] text-muted-foreground leading-normal">
                        Required to decrypt your private key PEM browser-side so you can decrypt the owner's recovery share payload.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproveRequest(req, approvalPasswordInput)}
                      disabled={approvingId === req.id}
                      variant="outline"
                      className="text-xs border-primary/30 text-primary hover:bg-primary/5 w-full"
                    >
                      {approvingId === req.id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Decrypting &amp; Approving...</>
                      ) : (
                        "Approve Recovery"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
