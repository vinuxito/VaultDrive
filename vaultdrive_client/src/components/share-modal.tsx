import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { X, Users, User } from "lucide-react";
import { API_URL } from "../utils/api";

interface User {
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

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  onShareComplete: () => void;
}

export default function ShareModal({ isOpen, onClose, fileId, fileName, onShareComplete }: ShareModalProps) {
  const [tab, setTab] = useState<'users' | 'groups'>('users');
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[] | Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [wrappedKey, setWrappedKey] = useState("");
  const [recipient, setRecipient] = useState<User | Group | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (isOpen && tab === 'groups') {
      fetchGroups();
    }
  }, [isOpen, tab]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search.length >= 2) {
        searchRecipients();
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, tab]);

  async function fetchGroups() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setGroups(data || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  }

  async function searchRecipients() {
    try {
      const token = localStorage.getItem("token");
      let url = "";
      if (tab === 'users') {
        url = `${API_URL}/user-by-username?username=${encodeURIComponent(search)}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!recipient || !wrappedKey) return;
    setSharing(true);
    try {
      const token = localStorage.getItem("token");
      let url = "";
      let body = {};

      if (tab === 'users') {
        url = `${API_URL}/files/${fileId}/share`;
        body = {
          user_id: (recipient as User).id,
          wrapped_key: wrappedKey,
        };
      } else {
        url = `${API_URL}/groups/${(recipient as Group).id}/files/${fileId}/share`;
        body = {
          wrapped_key: wrappedKey,
        };
      }

      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      onShareComplete();
      handleClose();
    } catch (error) {
      console.error("Error sharing:", error);
      alert("Failed to share file");
    } finally {
      setSharing(false);
    }
  }

  function handleClose() {
    setSearch("");
    setSearchResults([]);
    setRecipient(null);
    setWrappedKey("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Share File</h2>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2 mb-6">
            <Button
              variant={tab === 'users' ? "default" : "ghost"}
              onClick={() => {
                setTab('users');
                setSearch("");
                setSearchResults([]);
                setRecipient(null);
              }}
              className="flex-1"
            >
              <User className="w-4 h-4 mr-2" />
              Share with User
            </Button>
            <Button
              variant={tab === 'groups' ? "default" : "ghost"}
              onClick={() => {
                setTab('groups');
                setSearch("");
                setSearchResults([]);
                setRecipient(null);
              }}
              className="flex-1"
            >
              <Users className="w-4 h-4 mr-2" />
              Share with Group
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-white mb-2">
                {tab === 'users' ? 'Search users by username/email' : 'Search groups'}
              </label>
              <Input
                id="search"
                placeholder={tab === 'users' ? 'Type at least 2 characters...' : 'Search groups...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>

            {loading && (
              <p className="text-sm text-muted-foreground">Searching...</p>
            )}

            {searchResults.length > 0 && !recipient && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((item) => ('id' in item ? (
                  (item as User).username ? (
                    <button
                      key={(item as User).id}
                      onClick={() => setRecipient(item as User)}
                      className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        {((item as User).username || "")?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">
                          {(item as User).first_name && (item as User).last_name
                            ? `${(item as User).first_name} ${(item as User).last_name}`
                            : (item as User).username}
                        </p>
                        <p className="text-xs text-muted-foreground">{(item as User).email}</p>
                      </div>
                    </button>
                  ) : null
                ) : (
                  <button
                    key={(item as Group).id}
                    onClick={() => setRecipient(item as Group)}
                    className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{(item as Group).name}</p>
                      <p className="text-xs text-muted-foreground">{(item as Group).member_count} members</p>
                    </div>
                  </button>
                )))}
              </div>
            )}

            {!loading && search.length >= 2 && searchResults.length === 0 && !recipient && (
              <p className="text-sm text-muted-foreground">No results found</p>
            )}

            {tab === 'groups' && groups.length > 0 && search.length === 0 && !recipient && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <p className="text-sm text-muted-foreground">Your groups:</p>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setRecipient(group)}
                    className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.member_count} members</p>
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
                      {'id' in recipient ? (
                        ((recipient as User).username || "")?.charAt(0).toUpperCase()
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {'id' in recipient && (recipient as User).username ? (
                          (recipient as User).first_name && (recipient as User).last_name
                            ? `${(recipient as User).first_name} ${(recipient as User).last_name}`
                            : (recipient as User).username
                        ) : (
                          (recipient as Group).name
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {'id' in recipient ? (recipient as User).email : `${(recipient as Group).member_count} members`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecipient(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <label htmlFor="wrapped-key" className="block text-sm font-medium text-white mb-2">
                    Wrapped Encryption Key *
                  </label>
                  <Input
                    id="wrapped-key"
                    placeholder="Enter the RSA-wrapped AES-256 key for this recipient"
                    value={wrappedKey}
                    onChange={(e) => setWrappedKey(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The file's AES-256 key, encrypted with the recipient's RSA public key
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={!recipient || !wrappedKey || sharing}>
                {sharing ? 'Sharing...' : 'Share File'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}