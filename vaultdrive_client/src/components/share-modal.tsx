import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { X, Users, User, Lock, Loader2, AlertCircle } from "lucide-react";
import { API_URL, getUserPublicKey } from "../utils/api";
import {
  importRSAPublicKey,
  wrapKeyWithRSA,
  importKey,
  unwrapKey,
  deriveKeyFromPassword,
  base64ToArrayBuffer,
} from "../utils/crypto";

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
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [recipient, setRecipient] = useState<UserResult | Group | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const [pinInput, setPinInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const credentialMode = pinWrappedKey ? "pin" : "password";

  useEffect(() => {
    if (isOpen && tab === "groups") fetchGroups();
  }, [isOpen, tab]);

  async function fetchGroups() {
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
  }

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
      const credential = credentialMode === "pin" ? pinInput : passwordInput;
      if (!credential) {
        setError("Enter your PIN or password to wrap the key.");
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

        const stored = localStorage.getItem("user");
        const userObj = stored ? JSON.parse(stored) : null;
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
      setError(err instanceof Error ? err.message : "Failed to share file");
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
          className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border border-white/10 rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Share File</h2>
              <p className="text-sm text-white/70">{fileName}</p>
            </div>
            <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/30 flex items-start gap-2 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 p-1 bg-white/5 rounded-lg mb-6">
            {(["users", "groups"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setSearch("");
                  setSearchResults([]);
                  setRecipient(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-white text-[#7d4f50]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {t === "users" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {t === "users" ? "Share with User" : "Share with Group"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {!recipient && (
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  {tab === "users" ? "Search users by username" : "Select a group"}
                </label>
                <Input
                  placeholder={tab === "users" ? "Type at least 2 characters..." : "Search groups..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40"
                />
              </div>
            )}

            {loading && <p className="text-sm text-white/70">Searching...</p>}

            {!recipient && tab === "users" && searchResults.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setRecipient(u)}
                    className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                      </p>
                      <p className="text-xs text-white/70">{u.email}</p>
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
                      key={g.id}
                      onClick={() => setRecipient(g)}
                      className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium">{g.name}</p>
                        <p className="text-xs text-white/70">{g.member_count} members</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {recipient && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-primary/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-primary">
                      {isUser(recipient) ? recipient.username.charAt(0).toUpperCase() : <Users className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {isUser(recipient)
                          ? recipient.first_name && recipient.last_name
                            ? `${recipient.first_name} ${recipient.last_name}`
                            : recipient.username
                          : recipient.name}
                      </p>
                      <p className="text-xs text-white/70">
                        {isUser(recipient) ? recipient.email : `${recipient.member_count} members`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRecipient(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="p-4 bg-white/5 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Your credential to authorize sharing
                  </p>

                  {pinWrappedKey ? (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Your PIN</label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="4-digit PIN"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                        className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40"
                      />
                      <p className="text-xs text-white/50 mt-1">
                        Used to decrypt this drop file and re-wrap it for the recipient
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">File encryption password</label>
                      <Input
                        type="password"
                        placeholder="Password used when uploading"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white/40"
                      />
                      <p className="text-xs text-white/50 mt-1">
                         Used to derive the file key and wrap it with the recipient's RSA public key
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-2 border-white/40 text-white hover:bg-white/10 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleShare}
                disabled={!recipient || sharing || (pinWrappedKey ? !pinInput : !passwordInput)}
                className="bg-white text-[#7d4f50] hover:bg-[#f2d7d8] font-semibold"
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
