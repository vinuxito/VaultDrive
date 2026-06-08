import { useState, useEffect, useCallback } from "react";
import { useSessionVault } from "../context/SessionVaultContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { X, Users, User, Lock, Loader2, AlertCircle } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "../lib/utils";
import { API_URL, getUserPublicKey } from "../utils/api";
import {
  importRSAPublicKey,
  wrapKeyWithRSA,
  importKey,
  unwrapKey,
  deriveKeyFromPassword,
  base64ToArrayBuffer,
} from "../utils/crypto";
import {
  getNormalizedErrorMessage,
  getStoredUserFromLocalStorage,
} from "../utils/browser-storage";

interface UserResult {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Group {
  id: string;
  name: string;
  member_count: number;
}

interface GroupMember {
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface FileMetadata {
  iv: string;
  salt?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  fileMetadata?: string;
  pinWrappedKey?: string;
  onShareComplete: () => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  fileMetadata,
  pinWrappedKey,
  onShareComplete,
}: ShareModalProps) {
  const [tab, setTab] = useState<"users" | "groups">("users");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recipient, setRecipient] = useState<UserResult | Group | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const [pinInput, setPinInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const credentialMode = (() => {
    if (pinWrappedKey) return "pin";
    try {
      const meta = JSON.parse(fileMetadata ?? "{}") as { credential_scheme?: string };
      if (meta.credential_scheme === "pin") return "pin";
    } catch { /* ignore */ }
    return "password";
  })();

  const { getCredential } = useSessionVault();
  const cachedCred = getCredential();
  const hasCachedCred = cachedCred !== null && cachedCred.type === credentialMode;

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setGroups(data || []);
    } catch {
      setError("Failed to load groups");
    }
  }, []);

  useEffect(() => {
    if (isOpen && tab === "groups") void fetchGroups();
  }, [fetchGroups, isOpen, tab]);

  const searchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/user-by-username?username=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search.length >= 2 && tab === "users") {
        searchUsers();
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, searchUsers, tab]);

  async function resolveFileAESKey(credential: string): Promise<CryptoKey> {
    if (pinWrappedKey) {
      const rawHex = await unwrapKey(credential, pinWrappedKey);
      return importKey(rawHex);
    }

    const meta: FileMetadata = JSON.parse(fileMetadata || "{}");
    if (!meta.salt) throw new Error("File has no salt — cannot derive key. This may be a drop file.");
    const salt = new Uint8Array(base64ToArrayBuffer(meta.salt));
    return deriveKeyFromPassword(credential, salt, 100000);
  }

  async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch group members");
    return response.json();
  }

  async function handleShare() {
    if (!recipient) return;
    setSharing(true);
    setError("");

    try {
      const token = localStorage.getItem("token") || "";
      const cached = getCredential();
      const credential = (cached && cached.type === credentialMode)
        ? cached.value
        : (credentialMode === "pin" ? pinInput : passwordInput);
      if (!credential) {
          setError("Enter the credential needed to authorize sharing.");
        setSharing(false);
        return;
      }

      const aesKey = await resolveFileAESKey(credential);

      if (tab === "users") {
        const user = recipient as UserResult;
        const { public_key: recipientPublicKeyPem } = await getUserPublicKey(user.id, token);
        const recipientPubKey = await importRSAPublicKey(recipientPublicKeyPem);
        const wrappedKey = await wrapKeyWithRSA(recipientPubKey, aesKey);

        const response = await fetch(`${API_URL}/files/${fileId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ user_id: user.id, wrapped_key: wrappedKey }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to share file");
        }
      } else {
        const group = recipient as Group;
        const members = await fetchGroupMembers(group.id);

        for (const member of members) {
          const { public_key: memberPublicKeyPem } = await getUserPublicKey(member.user_id, token);
          const memberPubKey = await importRSAPublicKey(memberPublicKeyPem);
          const wrappedKey = await wrapKeyWithRSA(memberPubKey, aesKey);

          const memberShareResp = await fetch(`${API_URL}/files/${fileId}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ user_id: member.user_id, wrapped_key: wrappedKey }),
          });
          if (!memberShareResp.ok) {
            const errData = await memberShareResp.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to share with member ${member.user_id}`);
          }
        }

        const userObj = getStoredUserFromLocalStorage();
        if (!userObj?.public_key) {
          throw new Error("Your public key is missing. Please log out and log in again before sharing to a group.");
        }
        const ownerPubKey = await importRSAPublicKey(userObj.public_key);
        const ownerWrappedKey = await wrapKeyWithRSA(ownerPubKey, aesKey);

        const groupShareResp = await fetch(`${API_URL}/groups/${group.id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file_id: fileId, wrapped_key: ownerWrappedKey }),
        });
        if (!groupShareResp.ok) {
          const errData = await groupShareResp.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to register file with group");
        }
      }

      onShareComplete();
      handleClose();
    } catch (err) {
      setError(getNormalizedErrorMessage(err, "Failed to share file"));
    } finally {
      setSharing(false);
    }
  }

  function handleClose() {
    setSearch("");
    setSearchResults([]);
    setRecipient(null);
    setPinInput("");
    setPasswordInput("");
    setError("");
    onClose();
  }

  if (!isOpen) return null;

  const isUser = (r: UserResult | Group): r is UserResult => "username" in r;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "border rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto",
            isDark
              ? "bg-gradient-to-br from-primary to-primary/90 border-white/10 text-white"
              : "bg-card border-border text-foreground"
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={cn("text-xl font-semibold", isDark ? "text-white" : "text-foreground")}>Share File</h2>
              <p className={cn("text-sm", isDark ? "text-white/80" : "text-muted-foreground")}>{fileName}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "transition-colors",
                isDark ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div
              className={cn(
                "mb-4 p-3 rounded-lg border flex items-start gap-2 text-sm",
                isDark
                  ? "bg-red-500/20 border-red-400/30 text-red-200"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              )}
            >
              <AlertCircle className={cn("w-4 h-4 mt-0.5 shrink-0", isDark ? "text-red-300" : "text-destructive")} />
              <span>{error}</span>
            </div>
          )}

          <div className={cn("flex gap-2 p-1 rounded-lg mb-6", isDark ? "bg-white/12" : "bg-muted")}>
            {(["users", "groups"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  setTab(t);
                  setSearch("");
                  setSearchResults([]);
                  setRecipient(null);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  tab === t
                    ? isDark
                      ? "bg-[hsl(var(--primary-foreground))] text-[hsl(var(--primary))]"
                      : "bg-background text-foreground shadow-sm"
                    : isDark
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {t === "users" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {t === "users" ? "Share with User" : "Share with Group"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {!recipient && (
              <div>
                <label
                  htmlFor="share-search"
                  className={cn("block text-sm font-medium mb-2", isDark ? "text-white" : "text-foreground")}
                >
                  {tab === "users" ? "Search users by username" : "Select a group"}
                </label>
                <Input
                  id="share-search"
                  placeholder={tab === "users" ? "Type at least 2 characters..." : "Search groups..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    isDark
                      ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                      : "bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                  )}
                />
              </div>
            )}

            {loading && <p className={cn("text-sm", isDark ? "text-white/80" : "text-muted-foreground")}>Searching...</p>}

            {!recipient && tab === "users" && searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => setRecipient(u)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      isDark
                        ? "bg-white/12 hover:bg-white/20 text-white"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-medium",
                        isDark ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                      )}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>
                        {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                      </p>
                      <p className={cn("text-xs", isDark ? "text-white/80" : "text-muted-foreground")}>{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!recipient && tab === "groups" && groups.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {groups
                  .filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()))
                  .map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => setRecipient(g)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        isDark
                          ? "bg-white/12 hover:bg-white/20 text-white"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          isDark ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                        )}
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>{g.name}</p>
                        <p className={cn("text-xs", isDark ? "text-white/80" : "text-muted-foreground")}>
                          {g.member_count} members
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {recipient && (
              <div className="space-y-4">
                <div className={cn("flex items-center justify-between p-3 rounded-lg", isDark ? "bg-primary/20" : "bg-primary/10")}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                        isDark ? "bg-primary/30 text-primary" : "bg-primary/20 text-primary"
                      )}
                    >
                      {isUser(recipient) ? recipient.username.charAt(0).toUpperCase() : <Users className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-foreground")}>
                        {isUser(recipient)
                          ? recipient.first_name && recipient.last_name
                            ? `${recipient.first_name} ${recipient.last_name}`
                            : recipient.username
                          : recipient.name}
                      </p>
                      <p className={cn("text-xs", isDark ? "text-white/80" : "text-muted-foreground")}>
                        {isUser(recipient) ? recipient.email : `${recipient.member_count} members`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecipient(null)}
                    className={cn(isDark ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {hasCachedCred ? (
                  <div className={cn("p-3 rounded-lg flex items-center gap-2 text-sm", isDark ? "bg-white/12 text-white/80" : "bg-muted text-muted-foreground")}>
                    <Lock className="w-4 h-4 text-green-400 shrink-0" />
                    <span>Credential cached — sharing will proceed automatically.</span>
                  </div>
                ) : (
                  <div className={cn("p-4 rounded-lg space-y-3", isDark ? "bg-white/12" : "bg-muted border border-border")}>
                    <p className={cn("text-sm font-medium flex items-center gap-2", isDark ? "text-white" : "text-foreground")}>
                      <Lock className="w-4 h-4" />
                      Your credential to authorize sharing
                    </p>

                    {credentialMode === "pin" ? (
                      <div>
                        <label
                          htmlFor="share-pin"
                          className={cn("block text-xs mb-1", isDark ? "text-white/80" : "text-muted-foreground")}
                        >
                          Your PIN
                        </label>
                        <Input
                          id="share-pin"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="4-digit PIN"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                          className={cn(
                            isDark
                              ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                              : "bg-background border-border text-foreground placeholder-muted-foreground focus:border-primary"
                          )}
                        />
                        <p className={cn("text-xs mt-1", isDark ? "text-white/75" : "text-muted-foreground")}>
                          Used to authorize this share without asking for a separate file password
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="share-credential"
                          className={cn("block text-xs mb-1", isDark ? "text-white/80" : "text-muted-foreground")}
                        >
                          File credential
                        </label>
                        <Input
                          id="share-credential"
                          type="password"
                          placeholder="Credential used for this file"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className={cn(
                            isDark
                              ? "bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                              : "bg-background border-border text-foreground placeholder-muted-foreground focus:border-primary"
                          )}
                        />
                        <p className={cn("text-xs mt-1", isDark ? "text-white/75" : "text-muted-foreground")}>
                          Used to derive the file key and wrap it with the recipient's RSA public key
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={cn("flex justify-end gap-3 pt-4 border-t", isDark ? "border-white/10" : "border-border")}>
              <Button
                type="button"
                variant="modal-cancel"
                onClick={handleClose}
                className={cn(isDark ? "bg-white/15 border-white/20 text-white hover:bg-white/25 border" : "")}
              >
                Cancel
              </Button>
              <Button
                onClick={handleShare}
                disabled={
                  !recipient ||
                  sharing ||
                  (!hasCachedCred && (credentialMode === "pin" ? !pinInput : !passwordInput))
                }
                className={cn(
                  "font-semibold",
                  isDark
                    ? "bg-white text-primary hover:bg-primary/10"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {sharing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sharing...
                  </span>
                ) : (
                  "Share File"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
