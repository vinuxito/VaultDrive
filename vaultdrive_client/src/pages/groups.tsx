import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Plus, Settings, Trash2, X, UserPlus, Users } from "lucide-react";
import { API_URL } from "../utils/api";
import { FileWidget } from "../components/files";

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(id || null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    setSelectedGroup(id || null);
  }, [id]);

  async function fetchGroups() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/groups`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setGroups(data || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
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
      }
    } catch (error) {
      console.error("Error creating group:", error);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/groups/${groupId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  }

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="abrn-page-bg p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["g1","g2","g3"].map((k) => (
              <div key={k} className="abrn-glass-card p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded w-1/3 mb-4" />
                <div className="pt-4 border-t border-black/8 flex gap-2">
                  <div className="h-8 w-20 bg-slate-200 rounded" />
                  <div className="h-8 w-20 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="abrn-page-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Groups</h1>
            <p className="text-muted-foreground mt-1">
              Groups let you share files with multiple people at once.
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
                  placeholder="Search groups..."
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
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="icon"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {!selectedGroup ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="wait">
              {filteredGroups.length === 0 ? (
                <div className="text-center col-span-full py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#7d4f50]/10 flex items-center justify-center">
                    <Users className="w-8 h-8 text-[#c4999b]" />
                  </div>
                  <p className="text-muted-foreground text-lg font-medium">
                    {searchQuery ? "No groups found" : "No groups yet"}
                  </p>
                  <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
                    {searchQuery ? "Try a different search term." : "Create your first group to share files with multiple people at once."}
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
                    className="abrn-glass-card p-6 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7d4f50] to-[#c4999b] flex items-center justify-center text-white font-semibold text-lg">
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{group.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {group.member_count || 0} members • {group.file_count || 0} files
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/8">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/groups/${group.id}`);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Manage
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border border-white/10 rounded-2xl p-6 max-w-md w-full text-white"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Create Group</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGroup}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                      Group Name *
                    </label>
                    <Input
                      id="name"
                      placeholder="e.g. Marketing Team"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                      Description
                    </label>
                    <Input
                      id="description"
                      placeholder="What is this group for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      Create Group
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
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
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<FileShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [availableUsers, setAvailableUsers] = useState<UserForSelection[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem("token");
        const [groupRes, membersRes, filesRes] = await Promise.all([
          fetch(`${API_URL}/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` }}),
          fetch(`${API_URL}/groups/${groupId}/members`, { headers: { Authorization: `Bearer ${token}` }}),
          fetch(`${API_URL}/groups/${groupId}/files`, { headers: { Authorization: `Bearer ${token}` }}),
        ]);

        const groupData = await groupRes.json();
        const membersData = await membersRes.json();
        const filesData = await filesRes.json();

        setGroup(groupData);
        setMembers(membersData || []);
        setFiles(filesData || []);
      } catch (error) {
        console.error("Error fetching group details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [groupId]);

  // Load all users when modal opens
  useEffect(() => {
    if (showAddMemberModal) {
      loadAvailableUsers("");
    }
  }, [showAddMemberModal]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (showAddMemberModal) {
        loadAvailableUsers(memberSearch);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [memberSearch, showAddMemberModal]);

  async function loadAvailableUsers(query: string) {
    setSearching(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const users = await response.json();

      // Mark users who are already members
      const memberIds = new Set(members.map(m => m.user_id));
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
  }

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

      setShowAddMemberModal(false);
      setSelectedUserIds(new Set());
      setMemberSearch("");
      setCurrentPage(1);
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
    if (!confirm("Remove this member from the group?")) return;
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
    if (!confirm("Are you sure you want to delete this group? All members will be removed and shared files will be unshared.")) return;
    onGroupDeleted(groupId);
  }

  async function handleRemoveFile(fileId: string, filename: string) {
    if (!confirm(`Remove "${filename}" from the group?`)) return;
    
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
          <div key={k} className="abrn-glass-card p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-3" />
            <div className="h-4 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Group not found</div>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6"
      >
        Back to Groups
      </Button>

      <div className="abrn-glass-card p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold abrn-gradient-text">{group.name}</h2>
            <p className="text-muted-foreground mt-1">{group.description}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {members.length} members • {files.length} files
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteGroup}
            className="text-red-500"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Members</h3>
          <Button
            onClick={() => setShowAddMemberModal(true)}
            size="sm"
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Add Member
          </Button>
        </div>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet. Add users to this group.</p>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => (
              <div key={member.id} className="abrn-glass-card flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
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
                  className="text-red-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Files Shared to Group</h3>
        {files.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files shared to this group yet.</p>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-[#7d4f50] to-[#6b4345] border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Add Members to Group</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setMemberSearch("");
                    setSelectedUserIds(new Set());
                    setCurrentPage(1);
                  }}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="mb-4">
                <Input
                  placeholder="Search by username, email, or name..."
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white/5 border-white/10"
                />
              </div>

              {/* Content Area - Two Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                {/* Left: Available Users Table */}
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white">
                      Available Users ({availableUsers.filter(u => !u.is_member).length})
                    </h3>
                    {availableUsers.filter(u => !u.is_member).length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {availableUsers.filter(u => !u.is_member).every(u => selectedUserIds.has(u.id))
                          ? 'Deselect All'
                          : 'Select All'}
                      </Button>
                    )}
                  </div>

                  {searching ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading users...</div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-black/10 overflow-hidden flex-1 bg-white/40">
                      <div className="overflow-y-auto max-h-[400px]">
                        {(() => {
                          const startIdx = (currentPage - 1) * usersPerPage;
                          const endIdx = startIdx + usersPerPage;
                          const paginatedUsers = availableUsers.slice(startIdx, endIdx);

                          if (paginatedUsers.length === 0) {
                            return (
                              <div className="text-center py-12">
                                <p className="text-muted-foreground">No users found</p>
                              </div>
                            );
                          }

                          return paginatedUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => toggleUserSelection(user.id, user.is_member)}
                              disabled={user.is_member}
                              className={`w-full flex items-center gap-3 p-3 border-b border-black/5 hover:bg-primary/5 transition-colors ${
                                user.is_member ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                              } ${selectedUserIds.has(user.id) ? 'bg-primary/10' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(user.id)}
                                disabled={user.is_member}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-white/20"
                              />
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7d4f50] to-[#c4999b] flex items-center justify-center text-white font-semibold">
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
                                <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                                  Already Member
                                </span>
                              )}
                            </button>
                          ));
                        })()}
                      </div>

                      {/* Pagination */}
                      {availableUsers.length > usersPerPage && (
                        <div className="flex items-center justify-center gap-2 p-3 border-t border-white/10">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {Math.ceil(availableUsers.length / usersPerPage)}
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
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Selected Users Preview */}
                <div className="flex flex-col overflow-hidden">
                  <h3 className="text-sm font-medium text-white mb-3">
                    Selected ({selectedUserIds.size})
                  </h3>
                  <div className="rounded-lg border border-black/10 flex-1 overflow-y-auto p-3 bg-white/40">
                    {selectedUserIds.size === 0 ? (
                      <div className="text-center py-8">
                        <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No users selected</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Array.from(selectedUserIds).map((userId) => {
                          const user = availableUsers.find((u) => u.id === userId);
                          if (!user) return null;
                          return (
                            <div
                              key={userId}
                              className="flex items-center gap-2 p-2 bg-white/50 rounded-lg border border-black/5"
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7d4f50] to-[#c4999b] flex items-center justify-center text-white text-sm font-semibold">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.username}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                              <button
                                onClick={() => toggleUserSelection(userId, false)}
                                className="text-muted-foreground hover:text-white"
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
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setMemberSearch("");
                    setSelectedUserIds(new Set());
                    setCurrentPage(1);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={selectedUserIds.size === 0}
                >
                  Add {selectedUserIds.size} Member{selectedUserIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}