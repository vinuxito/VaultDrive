import { useCallback, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Plus, Settings, Trash2, X, UserPlus, Users } from "lucide-react";
import { API_URL } from "../utils/api";
import { FileWidget } from "../components/files";
import { DataState } from "../components/ui/data-state";
import { ElegantModal } from "../components/elegant";
import { useTranslation } from "react-i18next";

interface Group {
  id: string;
  name: string;
  description: string;
  member_count: number;
  file_count: number;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: string;
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface FileShare {
  id: string;
  file_id: string;
  filename: string;
  file_size: number;
  created_at: string;
  shared_at: string;
  shared_by: string;
  metadata?: string;
  is_owner?: boolean;
  group_name?: string;
  group_id?: string;
  shared_by_email?: string;
  shared_by_name?: string;
  owner_email?: string;
  owner_name?: string;
}

interface SearchResult {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface UserForSelection extends SearchResult {
  is_member: boolean;
}

export default function Groups() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(["common"]);
  const translateRef = useRef(t);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(id || null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState("");
  const [actionError, setActionError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchGroups = useCallback(async () => {
    setSourceError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 403) throw new Error(translateRef.current("common:groups.errors.forbidden"));
      if (!response.ok) throw new Error(translateRef.current("common:groups.errors.unavailable"));
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error(translateRef.current("common:groups.errors.unexpected"));
      setGroups(data);
    } catch (error) {
      console.error("Error fetching groups:", error);
      setSourceError(error instanceof Error ? error.message : translateRef.current("common:groups.errors.retry"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    setSelectedGroup(id || null);
  }, [id]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description }),
      });
      if (response.ok) {
        setName("");
        setDescription("");
        setShowCreateModal(false);
        fetchGroups();
      } else {
        throw new Error(t("common:groups.errors.create"));
      }
    } catch (error) {
      console.error("Error creating group:", error);
      setActionError(error instanceof Error ? error.message : t("common:groups.errors.createShort"));
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm(t("common:groups.confirmDelete"))) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups/${groupId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error(t("common:groups.errors.delete"));
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error("Error deleting group:", error);
      setActionError(error instanceof Error ? error.message : t("common:groups.errors.deleteShort"));
    }
  }

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="brand-page-bg p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-32 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted/70 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["g1","g2","g3"].map((k) => (
              <div key={k} className="brand-glass-card p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted/70 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-muted/70 rounded w-1/3 mb-4" />
                <div className="pt-4 border-t border-border flex gap-2">
                  <div className="h-8 w-20 bg-muted rounded" />
                  <div className="h-8 w-20 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-page-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t("common:groups.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("common:groups.description")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={t("common:groups.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-lg w-64"
                  autoFocus
                />
              </motion.div>
            )}
            <Button
              variant="default"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
              aria-label={t("common:groups.searchAction")}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="icon"
              aria-label={t("common:groups.createAction")}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {actionError && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{actionError}</p>}

        {sourceError && groups.length > 0 && (
          <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            {t("common:groups.showingCached")} {sourceError}
          </p>
        )}

        {sourceError && groups.length === 0 ? (
          <DataState error={sourceError} onRetry={() => void fetchGroups()}>
            {null}
          </DataState>
        ) : !selectedGroup ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="wait">
              {filteredGroups.length === 0 ? (
                <div className="text-center col-span-full py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-foreground text-lg font-medium">
                    {searchQuery ? t("common:groups.noSearchResults") : t("common:groups.empty")}
                  </p>
                  <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
                    {searchQuery ? t("common:groups.tryAnotherSearch") : t("common:groups.emptyDescription")}
                  </p>
                </div>
              ) : (
                filteredGroups.map((group, index) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/groups/${group.id}`)}
                    className="brand-glass-card p-6 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{group.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {t("common:groups.memberCount", { count: group.member_count || 0 })} • {t("common:groups.fileCount", { count: group.file_count || 0 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <span>{t("common:groups.created")} {new Date(group.created_at).toLocaleDateString(i18n.language)}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/groups/${group.id}`);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        {t("common:groups.manage")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {t("common:groups.delete")}
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        ) : (
          <GroupDetail
            groupId={selectedGroup}
            onBack={() => navigate('/groups')}
            onGroupDeleted={(deletedId) => {
              setGroups(groups.filter(g => g.id !== deletedId));
              navigate('/groups');
            }}
            onMemberAdded={fetchGroups}
            onMemberRemoved={fetchGroups}
          />
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <ElegantModal
            isOpen
            onClose={() => setShowCreateModal(false)}
            title={t("common:groups.createTitle")}
          >
              <form onSubmit={handleCreateGroup}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                      {t("common:groups.nameLabel")}
                    </label>
                    <Input
                      id="name"
                      placeholder={t("common:groups.namePlaceholder")}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                      {t("common:groups.descriptionLabel")}
                    </label>
                    <Input
                      id="description"
                      placeholder={t("common:groups.descriptionPlaceholder")}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="modal-cancel"
                      onClick={() => setShowCreateModal(false)}
                    >
                      {t("common:groups.cancel")}
                    </Button>
                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      {t("common:groups.createTitle")}
                    </Button>
                  </div>
                </div>
              </form>
          </ElegantModal>
        )}
      </AnimatePresence>
    </div>
  );
}

interface GroupDetailProps {
  groupId: string;
  onBack: () => void;
  onGroupDeleted: (groupId: string) => void;
  onMemberAdded: () => void;
  onMemberRemoved: () => void;
}

function GroupDetail({ groupId, onBack, onGroupDeleted, onMemberAdded, onMemberRemoved }: GroupDetailProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common"]);
  const translateRef = useRef(t);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<FileShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailErrors, setDetailErrors] = useState<{ group?: string; members?: string; files?: string }>({});
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [availableUsers, setAvailableUsers] = useState<UserForSelection[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  const closeMemberModal = () => {
    setShowAddMemberModal(false);
    setMemberSearch("");
    setSelectedUserIds(new Set());
    setCurrentPage(1);
  };

  const loadAvailableUsers = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const users = await response.json();

      const memberIds = new Set(members.map((member) => member.user_id));
      const usersWithStatus: UserForSelection[] = (users || []).map((user: SearchResult) => ({
        ...user,
        is_member: memberIds.has(user.id),
      }));

      setAvailableUsers(usersWithStatus);
    } catch (error) {
      console.error("Error loading users:", error);
      setAvailableUsers([]);
    } finally {
      setSearching(false);
    }
  }, [members]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDetailErrors({});
    const token = localStorage.getItem("token");
    const sources = await Promise.allSettled([
      fetch(`${API_URL}/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` }}),
      fetch(`${API_URL}/groups/${groupId}/members`, { headers: { Authorization: `Bearer ${token}` }}),
      fetch(`${API_URL}/groups/${groupId}/files`, { headers: { Authorization: `Bearer ${token}` }}),
    ]);
    const keys = ["group", "members", "files"] as const;
    const nextErrors: { group?: string; members?: string; files?: string } = {};

    await Promise.all(sources.map(async (result, index) => {
      const key = keys[index];
      if (result.status === "rejected") {
        nextErrors[key] = translateRef.current(`common:groups.errors.${key}Unavailable`);
        return;
      }
      const response = result.value;
      if (!response.ok) {
        nextErrors[key] = response.status === 403
          ? translateRef.current(`common:groups.errors.${key}Forbidden`)
          : translateRef.current(`common:groups.errors.${key}Unavailable`);
        return;
      }
      try {
        const data = await response.json();
        if (key === "group") setGroup(data as Group);
        else if (key === "members") {
          if (!Array.isArray(data)) throw new Error("Unexpected members response");
          setMembers(data);
        } else {
          if (!Array.isArray(data)) throw new Error("Unexpected files response");
          setFiles(data);
        }
      } catch {
        nextErrors[key] = translateRef.current(`common:groups.errors.${key}Unexpected`);
      }
    }));
    setDetailErrors(nextErrors);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Load all users when modal opens
  useEffect(() => {
    if (showAddMemberModal) {
      loadAvailableUsers("");
    }
  }, [showAddMemberModal, loadAvailableUsers]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (showAddMemberModal) {
        loadAvailableUsers(memberSearch);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [memberSearch, showAddMemberModal, loadAvailableUsers]);

  async function handleAddMembers() {
    if (selectedUserIds.size === 0) return;

    try {
      const token = localStorage.getItem("token");

      // Add members one by one
      for (const userId of selectedUserIds) {
        await fetch(`${API_URL}/groups/${groupId}/members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId, role: "member" }),
        });
      }

      closeMemberModal();
      onMemberAdded();
      fetchMembers();
    } catch (error) {
      console.error("Error adding members:", error);
    }
  }

  function toggleUserSelection(userId: string, isMember: boolean) {
    if (isMember) return; // Can't select existing members

    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  }

  function toggleSelectAll() {
    const selectableUsers = availableUsers.filter(u => !u.is_member);
    const allSelected = selectableUsers.every(u => selectedUserIds.has(u.id));

    if (allSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(selectableUsers.map(u => u.id)));
    }
  }

  async function fetchMembers() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm(t("common:groups.confirmRemoveMember"))) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      onMemberRemoved();
      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
    }
  }

  async function handleDeleteGroup() {
    if (!confirm(t("common:groups.confirmDeleteDetailed"))) return;
    onGroupDeleted(groupId);
  }

  async function handleRemoveFile(fileId: string, filename: string) {
    if (!confirm(t("common:groups.confirmRemoveFile", { filename }))) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups/${groupId}/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setFiles(files.filter(f => f.file_id !== fileId));
      }
    } catch (error) {
      console.error("Error removing file:", error);
    }
  }

  async function handleDownload(_fileId: string, _filename: string, _metadata: string) {
    navigate("/files");
  }

  async function handleShare(_fileId: string, _filename: string) {
    navigate("/files");
  }

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {["r1","r2"].map((k) => (
          <div key={k} className="brand-glass-card p-6 animate-pulse">
            <div className="h-6 bg-muted rounded w-1/3 mb-3" />
            <div className="h-4 bg-muted/70 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!group) {
    return (
      <DataState error={detailErrors.group || t("common:groups.errors.groupUnavailable")} onRetry={() => void fetchData()}>
        {null}
      </DataState>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6"
      >
        {t("common:groups.back")}
      </Button>

      <div className="brand-glass-card p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold brand-gradient-text">{group.name}</h2>
            <p className="text-muted-foreground mt-1">{group.description}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("common:groups.memberCount", { count: members.length })} • {t("common:groups.fileCount", { count: files.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteGroup}
            className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t("common:groups.delete")}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t("common:groups.members")}</h3>
          <Button
            onClick={() => setShowAddMemberModal(true)}
            size="sm"
          >
            <UserPlus className="w-4 h-4 mr-1" />
            {t("common:groups.addMember")}
          </Button>
        </div>
        {detailErrors.members ? (
          <DataState error={detailErrors.members} onRetry={() => void fetchData()} density="compact">{null}</DataState>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("common:groups.noMembers")}</p>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => (
              <div key={member.id} className="brand-glass-card flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-foreground">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {member.first_name && member.last_name
                        ? `${member.first_name} ${member.last_name}`
                        : member.username}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMember(member.user_id)}
                  aria-label={t("common:groups.removeMember", { name: member.username })}
                  className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">{t("common:groups.sharedFiles")}</h3>
        {detailErrors.files ? (
          <DataState error={detailErrors.files} onRetry={() => void fetchData()} density="compact">{null}</DataState>
        ) : files.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("common:groups.noFiles")}</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <FileWidget
                key={file.id}
                file={{
                  ...file,
                  is_owner: false,
                  group_name: group?.name || "",
                  group_id: groupId,
                }}
                context="group-files"
                onDownload={handleDownload}
                onShare={handleShare}
                onDelete={handleRemoveFile}
                showActions={true}
                showDetails={true}
                enableExpand={true}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddMemberModal && (
          <ElegantModal
            isOpen
            onClose={closeMemberModal}
            title={t("common:groups.addMembersTitle")}
            size="2xl"
            className="flex flex-col"
          >
              <p className="mb-6 text-sm text-muted-foreground">
                {t("common:groups.selectedCount", { count: selectedUserIds.size })}
              </p>

              {/* Search Bar */}
              <div className="mb-4">
                <Input
                  placeholder={t("common:groups.searchUsers")}
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Content Area - Two Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 lg:min-h-0 lg:overflow-hidden">
                {/* Left: Available Users Table */}
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-foreground">
                      {t("common:groups.availableUsers", { count: availableUsers.filter(u => !u.is_member).length })}
                    </h3>
                    {availableUsers.filter(u => !u.is_member).length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {availableUsers.filter(u => !u.is_member).every(u => selectedUserIds.has(u.id))
                          ? t("common:groups.deselectAll")
                          : t("common:groups.selectAll")}
                      </Button>
                    )}
                  </div>

                  {searching ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">{t("common:groups.loadingUsers")}</div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-hidden rounded-lg border border-border bg-muted/40">
                      <div className="overflow-y-auto max-h-[400px]">
                        {(() => {
                          const startIdx = (currentPage - 1) * usersPerPage;
                          const endIdx = startIdx + usersPerPage;
                          const paginatedUsers = availableUsers.slice(startIdx, endIdx);

                          if (paginatedUsers.length === 0) {
                            return (
                              <div className="text-center py-12">
                                <p className="text-muted-foreground">{t("common:groups.noUsers")}</p>
                              </div>
                            );
                          }

                          return paginatedUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => toggleUserSelection(user.id, user.is_member)}
                              disabled={user.is_member}
                              className={`w-full flex items-center gap-3 p-3 border-b border-border hover:bg-muted transition-colors ${
                                user.is_member ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                              } ${selectedUserIds.has(user.id) ? 'bg-primary/10' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(user.id)}
                                disabled={user.is_member}
                                onChange={() => {}}
                                className="h-4 w-4 rounded border-border"
                              />
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-semibold text-foreground">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-sm font-medium">
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.username}
                                </p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                              {user.is_member && (
                                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                  {t("common:groups.alreadyMember")}
                                </span>
                              )}
                            </button>
                          ));
                        })()}
                      </div>

                      {/* Pagination */}
                      {availableUsers.length > usersPerPage && (
                        <div className="flex items-center justify-center gap-2 border-t border-border p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            {t("common:groups.previous")}
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {t("common:groups.page", { current: currentPage, total: Math.ceil(availableUsers.length / usersPerPage) })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setCurrentPage(
                                Math.min(Math.ceil(availableUsers.length / usersPerPage), currentPage + 1)
                              )
                            }
                            disabled={currentPage >= Math.ceil(availableUsers.length / usersPerPage)}
                          >
                            {t("common:groups.next")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Selected Users Preview */}
                <div className="flex flex-col overflow-hidden">
                  <h3 className="mb-3 text-sm font-medium text-foreground">
                    {t("common:groups.selected", { count: selectedUserIds.size })}
                  </h3>
                  <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
                    {selectedUserIds.size === 0 ? (
                      <div className="text-center py-8">
                        <UserPlus className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{t("common:groups.noUsersSelected")}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Array.from(selectedUserIds).map((userId) => {
                          const user = availableUsers.find((u) => u.id === userId);
                          if (!user) return null;
                          return (
                            <div
                              key={userId}
                              className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-foreground">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.username}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                              </div>
                              <button
                                onClick={() => toggleUserSelection(userId, false)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={t("common:groups.removeSelected", { name: user.username })}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 flex justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeMemberModal}
                >
                  {t("common:groups.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={selectedUserIds.size === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t("common:groups.addSelected", { count: selectedUserIds.size })}
                </Button>
              </div>
          </ElegantModal>
        )}
      </AnimatePresence>
    </div>
  );
}
