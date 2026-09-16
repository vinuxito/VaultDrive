import { useState, useEffect, useCallback, useRef } from "react";
import { useSessionVault } from "../context/SessionVaultContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { X, Users, User, Lock, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { API_URL, getUserPublicKey } from "../utils/api";
import {
  importRSAPublicKey,
  wrapKeyWithRSA,
} from "../utils/crypto";
import { recoverVerifiedOwnerFileKey } from "../utils/access-link-recovery";
import {
  getNormalizedErrorMessage,
  getStoredUserFromLocalStorage,
} from "../utils/browser-storage";
import { useTranslation } from "react-i18next";

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

class ShareOutcomeUnconfirmedError extends Error {}

function isCompleteUserResult(value: unknown): value is UserResult {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<UserResult>;
  return [user.id, user.username, user.email, user.first_name, user.last_name]
    .every((field) => typeof field === "string");
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  fileMetadata?: string;
  pinWrappedKey?: string;
  folderId?: string | null;
  onShareComplete: () => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  fileMetadata,
  pinWrappedKey,
  folderId,
  onShareComplete,
}: ShareModalProps) {
  const { t } = useTranslation(["drive"]);
  const copy = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };
  const [tab, setTab] = useState<"users" | "groups">("users");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recipient, setRecipient] = useState<UserResult | Group | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [ignoreCachedCredential, setIgnoreCachedCredential] = useState(false);
  const searchGeneration = useRef(0);

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

  const sessionVault = useSessionVault();
  const { getCredential } = sessionVault;
  const cachedCred = getCredential();
  const hasCachedCred = !ignoreCachedCredential && cachedCred !== null && cachedCred.type === credentialMode;

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Groups are unavailable. Try again.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Groups returned an unexpected response.");
      setGroups(data);
    } catch {
      setError("Groups are unavailable. Try again.");
    }
  }, []);

  useEffect(() => {
    if (isOpen && tab === "groups") void fetchGroups();
  }, [fetchGroups, isOpen, tab]);

  const searchUsers = useCallback(async (query: string, generation: number) => {
    setLoading(true);
    setSearchMessage("");
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/user-by-username?username=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (generation !== searchGeneration.current) return;
      if (response.status === 404) {
        setSearchResults([]);
        setSearchMessage(`No user found for “${query}”.`);
        return;
      }
      if (!response.ok) throw new Error("User lookup is unavailable. Try again.");
      const data = await response.json();
      if (generation !== searchGeneration.current) return;
      const results = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
      const normalizedResults = results.filter(isCompleteUserResult);
      setSearchResults(normalizedResults);
      if (normalizedResults.length === 0) {
        if (results.length > 0) setError("User lookup returned incomplete recipient details. Try again.");
        else setSearchMessage(`No user found for “${query}”.`);
      }
    } catch (cause) {
      if (generation !== searchGeneration.current) return;
      setSearchResults([]);
      setError(getNormalizedErrorMessage(cause, "User lookup is unavailable. Try again."));
    } finally {
      if (generation === searchGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search.length >= 2 && tab === "users") {
        const generation = ++searchGeneration.current;
        void searchUsers(search, generation);
      } else {
        searchGeneration.current += 1;
        setLoading(false);
        setSearchMessage("");
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
      searchGeneration.current += 1;
    };
  }, [search, searchUsers, tab]);

  async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch group members");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Group members returned an unexpected response.");
    return data;
  }

  async function postRecipientGrant(token: string, userId: string, wrappedKey: string) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/files/${fileId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, wrapped_key: wrappedKey }),
      });
    } catch {
      throw new ShareOutcomeUnconfirmedError("The share outcome was not confirmed. Review file access before retrying.");
    }
    if (response.status >= 500) {
      throw new ShareOutcomeUnconfirmedError("The share outcome was not confirmed. Review file access before retrying.");
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || "Failed to share file");
    }
  }

  async function handleShare() {
    if (!recipient) return;
    setSharing(true);
    setError("");

    try {
      const token = localStorage.getItem("token") || "";
      const cached = getCredential();
      const usingCachedCredential = !ignoreCachedCredential && cached?.type === credentialMode;
      const credential = usingCachedCredential
        ? cached.value
        : (credentialMode === "pin" ? pinInput : passwordInput);
      if (!credential) {
          setError("Enter the credential needed to authorize sharing.");
        setSharing(false);
        return;
      }

      const downloadResponse = await fetch(`${API_URL}/files/${fileId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!downloadResponse.ok) {
        throw new Error("Could not verify this file's encryption key. Try again.");
      }
      let recovered;
      try {
        recovered = await recoverVerifiedOwnerFileKey({
          file: {
            id: fileId,
            metadata: fileMetadata || "{}",
            pin_wrapped_key: pinWrappedKey,
            folder_id: folderId,
          },
          credential,
          encryptedData: await downloadResponse.arrayBuffer(),
          wrappedKey: downloadResponse.headers.get("X-Wrapped-Key"),
          cachedFileKey: sessionVault.getFileKey(fileId),
          folderKey: folderId ? sessionVault.getFolderKey(folderId) : null,
        });
      } catch (cause) {
        if (usingCachedCredential) {
          sessionVault.clearCredential();
          setIgnoreCachedCredential(true);
        }
        throw cause;
      }
      sessionVault.setFileKey(fileId, recovered.key);
      const aesKey = recovered.key;

      if (tab === "users") {
        const user = recipient as UserResult;
        const { public_key: recipientPublicKeyPem } = await getUserPublicKey(user.id, token);
        const recipientPubKey = await importRSAPublicKey(recipientPublicKeyPem);
        const wrappedKey = await wrapKeyWithRSA(recipientPubKey, aesKey);

        await postRecipientGrant(token, user.id, wrappedKey);
      } else {
        const group = recipient as Group;
        const members = await fetchGroupMembers(group.id);

        let confirmedMemberGrants = 0;
        try {
          for (const member of members) {
            const { public_key: memberPublicKeyPem } = await getUserPublicKey(member.user_id, token);
            const memberPubKey = await importRSAPublicKey(memberPublicKeyPem);
            const wrappedKey = await wrapKeyWithRSA(memberPubKey, aesKey);

            await postRecipientGrant(token, member.user_id, wrappedKey);
            confirmedMemberGrants += 1;
          }
        } catch (cause) {
          if (confirmedMemberGrants > 0) {
            throw new Error(`Shared with ${confirmedMemberGrants} of ${members.length} group members. Review file access before retrying. ${getNormalizedErrorMessage(cause, "The remaining grants failed.")}`);
          }
          if (cause instanceof ShareOutcomeUnconfirmedError) {
            throw new Error("The first group member grant outcome is unconfirmed. Review file access before retrying.");
          }
          throw cause;
        }

        try {
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
            throw new Error(errData.error || "Failed to register file with group.");
          }
        } catch (cause) {
          throw new Error(`Shared with ${members.length} of ${members.length} group members, but the group registration was not confirmed. Review file access before retrying. ${getNormalizedErrorMessage(cause, "Failed to register file with group.")}`);
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
    setSearchMessage("");
    setIgnoreCachedCredential(false);
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
          className="border rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card border-border text-foreground"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-file-title"
          aria-busy={sharing}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 id="share-file-title" className="text-xl font-semibold text-foreground">{copy("drive:transfers.directShare.title", "Share File")}</h2>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={copy("drive:transfers.common.close", "Close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div
              className="mb-4 p-3 rounded-lg border flex items-start gap-2 text-sm bg-destructive/10 border-destructive/20 text-destructive"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <span role="alert" aria-live="assertive">{error}</span>
            </div>
          )}

          <div className="flex gap-2 p-1 rounded-lg mb-6 bg-muted">
            {(["users", "groups"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  setTab(t);
                  setSearch("");
                  setSearchResults([]);
                  setRecipient(null);
                  setSearchMessage("");
                  setError("");
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {t === "users" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {t === "users"
                  ? copy("drive:transfers.directShare.userTab", "Share with User")
                  : copy("drive:transfers.directShare.groupTab", "Share with Group")}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {!recipient && (
              <div>
                <label
                  htmlFor="share-search"
                  className="block text-sm font-medium mb-2 text-foreground"
                >
                  {tab === "users"
                    ? copy("drive:transfers.directShare.searchUsers", "Search users by username")
                    : copy("drive:transfers.directShare.selectGroup", "Select a group")}
                </label>
                <Input
                  id="share-search"
                  placeholder={tab === "users"
                    ? copy("drive:transfers.directShare.userPlaceholder", "Type at least 2 characters…")
                    : copy("drive:transfers.directShare.groupPlaceholder", "Search groups…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder-muted-foreground focus:border-primary focus:bg-background"
                />
              </div>
            )}

            {loading && <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{copy("drive:transfers.directShare.searching", "Searching…")}</p>}
            {searchMessage && <p className="text-sm text-muted-foreground" role="status">{searchMessage}</p>}

            {!recipient && tab === "users" && searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => setRecipient(u)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors bg-muted hover:bg-muted/80 text-foreground"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-medium bg-primary/10 text-foreground"
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
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
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors bg-muted hover:bg-muted/80 text-foreground"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-foreground"
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{g.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.member_count} members
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {recipient && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-semibold bg-primary/20 text-foreground"
                    >
                      {isUser(recipient) ? recipient.username.charAt(0).toUpperCase() : <Users className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isUser(recipient)
                          ? recipient.first_name && recipient.last_name
                            ? `${recipient.first_name} ${recipient.last_name}`
                            : recipient.username
                          : recipient.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isUser(recipient) ? recipient.email : `${recipient.member_count} members`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecipient(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {hasCachedCred ? (
                  <div className="p-3 rounded-lg flex items-center gap-2 text-sm bg-muted text-muted-foreground">
                    <Lock className="w-4 h-4 text-green-700 dark:text-green-300 shrink-0" />
                    <span>{copy("drive:transfers.directShare.cachedCredential", "Credential cached — sharing will proceed automatically.")}</span>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg space-y-3 bg-muted border border-border">
                    <p className="text-sm font-medium flex items-center gap-2 text-foreground">
                      <Lock className="w-4 h-4" />
                      {copy("drive:transfers.directShare.credentialTitle", "Your credential to authorize sharing")}
                    </p>

                    {credentialMode === "pin" ? (
                      <div>
                        <label
                          htmlFor="share-pin"
                          className="block text-xs mb-1 text-muted-foreground"
                        >
                          {copy("drive:transfers.directShare.pinLabel", "Your PIN")}
                        </label>
                        <Input
                          id="share-pin"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="4-digit PIN"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                          className="bg-background border-border text-foreground placeholder-muted-foreground focus:border-primary"
                        />
                        <p className="text-xs mt-1 text-muted-foreground">
                          Used to authorize this share without asking for a separate file password
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="share-credential"
                          className="block text-xs mb-1 text-muted-foreground"
                        >
                          {copy("drive:transfers.bulk.passwordLabel", "File credential")}
                        </label>
                        <Input
                          id="share-credential"
                          type="password"
                          placeholder="Credential used for this file"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="bg-background border-border text-foreground placeholder-muted-foreground focus:border-primary"
                        />
                        <p className="text-xs mt-1 text-muted-foreground">
                          Used to derive the file key and wrap it with the recipient's RSA public key
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="modal-cancel"
                onClick={handleClose}
              >
                {copy("drive:transfers.common.cancel", "Cancel")}
              </Button>
              <Button
                onClick={handleShare}
                disabled={
                  !recipient ||
                  sharing ||
                  (!hasCachedCred && (credentialMode === "pin" ? !pinInput : !passwordInput))
                }
                className="font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sharing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {copy("drive:transfers.directShare.sharing", "Sharing…")}
                  </span>
                ) : (
                  copy("drive:transfers.directShare.share", "Share File")
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
