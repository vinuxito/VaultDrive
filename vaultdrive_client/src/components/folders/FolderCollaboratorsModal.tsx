import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Users,
  UserPlus,
  Loader2,
  Trash2,
  AlertCircle,
  Search,
  Check,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { API_URL } from "../../utils/api";
import { useSessionVault } from "../../context/SessionVaultContext";
import {
  decryptPrivateKeyWithPIN,
  importRSAPrivateKey,
  unwrapKeyWithRSA,
  generateFileKey,
} from "../../utils/crypto";
import { wrapFolderKeyForRecipient } from "../../utils/folder-share-multiuser";
import { getFolderShareOwnerCredentialType } from "../../utils/folder-share-repair";

interface FolderCollaboratorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
}

interface ShareItem {
  id: string;
  user_id: string;
  username: string;
  wrapped_key: string;
  shared_by: string;
  created_at: string;
}

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
}

export function FolderCollaboratorsModal({
  isOpen,
  onClose,
  folderId,
  folderName,
}: FolderCollaboratorsModalProps) {
  const sessionVault = useSessionVault();
  const token = localStorage.getItem("token");

  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyShareUserId, setBusyShareUserId] = useState<string | null>(null);
  const [busyRevokeUserId, setBusyRevokeUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [pinInput, setPinInput] = useState("");
  const [needPin, setNeedPin] = useState(false);

  const currentUser = useMemo(() => {
    const stored = localStorage.getItem("user");
    return stored
      ? (JSON.parse(stored) as {
          id: string;
          username: string;
          pin_set?: boolean;
          private_key_encrypted?: string | null;
          private_key_pin_encrypted?: string | null;
          public_key?: string | null;
        })
      : null;
  }, []);

  const credentialType = getFolderShareOwnerCredentialType(currentUser);

  // Fetch active shares
  const fetchShares = useCallback(async () => {
    if (!token) return;
    setLoadingShares(true);
    setErrorMsg("");
    try {
      const response = await fetch(`${API_URL}/folders/${folderId}/shares`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setShares(data);
      } else {
        setErrorMsg("Failed to load active collaborators.");
      }
    } catch (err) {
      setErrorMsg("Network error loading collaborators.");
    } finally {
      setLoadingShares(false);
    }
  }, [folderId, token]);

  useEffect(() => {
    if (isOpen) {
      void fetchShares();
    }
  }, [isOpen, fetchShares]);

  // Attempt to recover or initialize folder key
  const getOrInitFolderKey = async (providedPin?: string): Promise<CryptoKey> => {
    // 1. Check cache
    const cachedKey = sessionVault.getFolderKey(folderId);
    if (cachedKey) return cachedKey;

    // 2. See if owner share exists in the shares list
    const ownerShare = shares.find((s) => s.user_id === currentUser?.id);
    if (ownerShare) {
      // Need private key to unwrap ownerShare.wrapped_key
      let privateKey = sessionVault.getPrivateKey();
      if (!privateKey) {
        if (!providedPin) {
          setNeedPin(true);
          throw new Error("unlocked_private_key_required");
        }
        if (!currentUser?.private_key_pin_encrypted) {
          throw new Error("Private key not configured for PIN access.");
        }
        const privateKeyPem = await decryptPrivateKeyWithPIN(
          providedPin,
          currentUser.private_key_pin_encrypted
        );
        privateKey = await importRSAPrivateKey(privateKeyPem);
        sessionVault.setPrivateKey(privateKey);
      }

      // Unwrap folder key
      const folderKey = await unwrapKeyWithRSA(privateKey, ownerShare.wrapped_key);
      sessionVault.setFolderKey(folderId, folderKey);
      return folderKey;
    }

    // 3. No owner share exists, generate a new folder key
    const folderKey = await generateFileKey();
    sessionVault.setFolderKey(folderId, folderKey);
    return folderKey;
  };

  // Search users
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setErrorMsg("");
      try {
        const response = await fetch(
          `${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = (await response.json()) as UserSearchResult[];
          // Exclude already shared users and the owner themselves
          const sharedUserIds = new Set(shares.map((s) => s.user_id));
          setSearchResults(
            data.filter(
              (u) => u.id !== currentUser?.id && !sharedUserIds.has(u.id)
            )
          );
        }
      } catch (err) {
        setErrorMsg("Failed to search users.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, shares, currentUser, token]);

  const handleShare = async (recipient: UserSearchResult) => {
    setErrorMsg("");
    setSuccessMsg("");
    setBusyShareUserId(recipient.id);

    try {
      // 1. Get or decrypt folder key
      let folderKey: CryptoKey;
      try {
        folderKey = await getOrInitFolderKey(pinInput);
      } catch (err) {
        if (err instanceof Error && err.message === "unlocked_private_key_required") {
          setBusyShareUserId(null);
          return;
        }
        throw err;
      }

      // 2. Fetch recipient's public key
      const keyRes = await fetch(`${API_URL}/users/${recipient.id}/public-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!keyRes.ok) {
        throw new Error("Failed to fetch recipient public key.");
      }
      const keyData = (await keyRes.json()) as { public_key: string };

      // 3. Wrap folder key with recipient's public key
      const wrappedKey = await wrapFolderKeyForRecipient(
        folderKey,
        keyData.public_key
      );

      // 4. Save collaborator share
      const shareRes = await fetch(`${API_URL}/folders/${folderId}/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: recipient.id,
          wrapped_key: wrappedKey,
        }),
      });
      if (!shareRes.ok) {
        throw new Error("Failed to register folder share on server.");
      }

      // 5. If this is the first share, also save the owner's share so the owner can recover it
      const hasOwnerShare = shares.some((s) => s.user_id === currentUser?.id);
      if (!hasOwnerShare && currentUser?.public_key) {
        const ownerWrappedKey = await wrapFolderKeyForRecipient(
          folderKey,
          currentUser.public_key
        );
        await fetch(`${API_URL}/folders/${folderId}/shares`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            wrapped_key: ownerWrappedKey,
          }),
        });
      }

      setSuccessMsg(`Successfully shared folder with ${recipient.username}.`);
      setSearchQuery("");
      setSearchResults([]);
      await fetchShares();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to share folder.");
    } finally {
      setBusyShareUserId(null);
    }
  };

  const handleRevoke = async (share: ShareItem) => {
    setErrorMsg("");
    setSuccessMsg("");
    setBusyRevokeUserId(share.user_id);

    try {
      const response = await fetch(
        `${API_URL}/folders/${folderId}/shares/${share.user_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to revoke collaborator share.");
      }
      setSuccessMsg(`Successfully revoked access for ${share.username}.`);
      await fetchShares();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to revoke share.");
    } finally {
      setBusyRevokeUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Manage Collaborators
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Folder: <span className="font-medium text-foreground">{folderName}</span>
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* PIN Prompt if private key is locked and owner share exists */}
        {needPin && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/40">
            <CardContent className="py-4 space-y-3">
              <label htmlFor="collab-unlock-credential" className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Unlock Vault Private Key
              </label>
              <div className="flex gap-2">
                <input
                  id="collab-unlock-credential"
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={credentialType === "pin" ? "Enter PIN" : "Enter Password"}
                  className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none"
                />
                <Button
                  onClick={async () => {
                    setErrorMsg("");
                    try {
                      await getOrInitFolderKey(pinInput);
                      setNeedPin(false);
                      setPinInput("");
                    } catch (err) {
                      setErrorMsg("Incorrect credential. Please try again.");
                    }
                  }}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  Unlock
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                A credentials prompt is required to unlock your private key to decrypt the folder key.
              </p>
            </CardContent>
          </Card>
        )}

        {/* User Search & Add */}
        {!needPin && (
          <div className="space-y-2 relative">
            <label htmlFor="collab-search" className="text-sm font-medium text-foreground">Invite Collaborator</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                id="collab-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or email..."
                className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-30">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => void handleShare(user)}
                    disabled={busyShareUserId === user.id}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted text-foreground transition-colors text-left"
                  >
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                    {busyShareUserId === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <UserPlus className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim().length >= 2 &&
              !searching &&
              searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No match found
                </p>
              )}
          </div>
        )}

        {/* Active Collaborators List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            Active Collaborators ({shares.filter((s) => s.user_id !== currentUser?.id).length})
          </h4>
          {loadingShares ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : shares.filter((s) => s.user_id !== currentUser?.id).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 italic">
              This folder is not shared with any collaborators yet.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/60 bg-muted/20">
              {shares
                .filter((s) => s.user_id !== currentUser?.id)
                .map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {share.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Shared {new Date(share.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRevoke(share)}
                      disabled={busyRevokeUserId === share.user_id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      {busyRevokeUserId === share.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
