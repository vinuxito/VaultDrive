import { useState, useEffect } from "react";
import {
  Shield,
  ShieldAlert,
  Edit2,
  Trash2,
  Key,
  X,
  Save,
  UserPlus,
  Lock,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { API_URL } from "../utils/api";
import { getStoredUserFromLocalStorage } from "../utils/browser-storage";
import { useToast } from "../context/ToastContext";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_admin: boolean;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
}

interface NewUserForm {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
}

const emptyNewUser: NewUserForm = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  password: "",
};

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<string | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUser);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const currentUser = getStoredUserFromLocalStorage() ?? {};
  const { addToast } = useToast();

  // Users that can be selected for bulk delete (not self)
  const selectableUsers = users.filter(
    (u) => u.id !== currentUser?.id
  );
  const allSelectableSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((u) => selected.has(u.id));

  useEffect(() => {
    fetchUsers();
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (userId: string) => {
    const next = new Set(selected);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableUsers.map((u) => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;

    const count = selected.size;
    if (
      !confirm(
        `Are you sure you want to delete ${count} user${count > 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;

    setBulkDeleting(true);
    try {
      const response = await fetch(`${API_URL}/admin/users/bulk-delete`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ user_ids: Array.from(selected) }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast(data.message, "success");
        setSelected(new Set());
        await fetchUsers();
      } else {
        const data = await response.json();
        addToast(data.error || "Error deleting users", "error");
      }
    } catch (err) {
      console.error("Error bulk deleting:", err);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCreateUser = async () => {
    setError("");
    if (
      !newUser.first_name ||
      !newUser.last_name ||
      !newUser.username ||
      !newUser.email ||
      !newUser.password
    ) {
      setError("All fields are required");
      return;
    }
    if (newUser.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        await fetchUsers();
        setShowCreateUser(false);
        setNewUser(emptyNewUser);
      } else {
        const data = await response.json();
        setError(data.error || "Error creating user");
      }
    } catch (err) {
      console.error("Error creating user:", err);
      setError("Network error");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            first_name: editingUser.first_name,
            last_name: editingUser.last_name,
            email: editingUser.email,
            username: editingUser.username,
          }),
        }
      );

      if (response.ok) {
        await fetchUsers();
        setEditingUser(null);
      } else {
        const data = await response.json();
        addToast(data.error || "Error updating user", "error");
      }
    } catch (err) {
      console.error("Error updating user:", err);
      addToast("Network error updating user", "error");
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${resetPasswordUser}/reset-password`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ new_password: newPassword }),
        }
      );

      if (response.ok) {
        setResetPasswordUser(null);
        setNewPassword("");
        addToast("Password reset successfully!", "success");
      } else {
        const data = await response.json();
        addToast(data.error || "Error resetting password", "error");
      }
    } catch (err) {
      console.error("Error resetting password:", err);
      addToast("Network error resetting password", "error");
    }
  };

  const handleResetPIN = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Clear PIN for ${userName}? They will need to set a new one on next login.`
      )
    )
      return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/reset-pin`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      if (response.ok) {
        addToast("PIN cleared successfully.", "success");
      } else {
        const data = await response.json();
        addToast(data.error || "Error resetting PIN", "error");
      }
    } catch (err) {
      console.error("Error resetting PIN:", err);
      addToast("Network error resetting PIN", "error");
    }
  };

  const handleToggleAdmin = async (user: User) => {
    const action = user.is_admin ? "revoke admin from" : "grant admin to";
    if (
      !confirm(
        `Are you sure you want to ${action} ${user.first_name} ${user.last_name}?`
      )
    )
      return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${user.id}/admin-status`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ is_admin: !user.is_admin }),
        }
      );

      if (response.ok) {
        await fetchUsers();
      } else {
        const data = await response.json();
        addToast(data.error || "Error updating admin status", "error");
      }
    } catch (err) {
      console.error("Error toggling admin:", err);
    }
  };

  const handleForcePasswordChange = async (user: User) => {
    if (
      !confirm(
        `Require ${user.first_name} ${user.last_name} to change their password on next login?`
      )
    )
      return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${user.id}/force-password-change`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      if (response.ok) {
        await fetchUsers();
        addToast("User will be required to change password on next login.", "success");
      } else {
        const data = await response.json();
        addToast(data.error || "Error setting force password change", "error");
      }
    } catch (err) {
      console.error("Error forcing password change:", err);
      addToast("Network error", "error");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const next = new Set(selected);
        next.delete(userId);
        setSelected(next);
        await fetchUsers();
      } else {
        const data = await response.json();
        addToast(data.error || "Error deleting user", "error");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      addToast("Network error deleting user", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <button
          onClick={() => {
            setShowCreateUser(true);
            setError("");
          }}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          New User
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-4 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-destructive">
            {selected.size} user{selected.size > 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-destructive text-white px-3 py-1.5 rounded-md hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleting ? "Deleting..." : "Delete Selected"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  title="Select all"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const isSelected = selected.has(user.id);
              return (
                <tr
                  key={user.id}
                  className={isSelected ? "bg-destructive/10" : undefined}
                >
                  <td className="px-4 py-4 w-10">
                    {isSelf ? (
                      <div className="h-4 w-4" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(user.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">
                      {user.first_name} {user.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-muted-foreground">{user.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_admin ? (
                      <button
                        onClick={() => !isSelf && handleToggleAdmin(user)}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/20 text-primary ${
                          isSelf
                            ? "cursor-default"
                            : "hover:bg-primary/20 cursor-pointer"
                        }`}
                        title={
                          isSelf
                            ? "Cannot change own admin status"
                            : "Click to revoke admin"
                        }
                        disabled={isSelf}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1 mt-0.5" />
                        Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-muted text-muted-foreground hover:bg-muted cursor-pointer"
                        title="Click to grant admin"
                      >
                        <ShieldOff className="h-3 w-3 mr-1 mt-0.5" />
                        User
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-primary hover:text-primary/90 mr-3"
                      title="Edit user"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setResetPasswordUser(user.id)}
                      className="text-green-600 hover:text-green-900 mr-3"
                      title="Reset password"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        handleResetPIN(
                          user.id,
                          `${user.first_name} ${user.last_name}`
                        )
                      }
                      className="text-orange-500 hover:text-orange-700 mr-3"
                      title="Reset PIN"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleForcePasswordChange(user)}
                        className={`mr-3 ${
                          user.force_password_change
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-400"
                        }`}
                        title={
                          user.force_password_change
                            ? "Password change already required"
                            : "Force password change on next login"
                        }
                        disabled={user.force_password_change}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:text-destructive/80"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New User</h2>
              <button
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUser(emptyNewUser);
                  setError("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-2 bg-destructive/10 text-destructive text-sm rounded">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, first_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, last_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                  placeholder="Min. 6 characters"
                />
              </div>
              <button
                onClick={handleCreateUser}
                className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit User</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={editingUser.first_name}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      first_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={editingUser.last_name}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      last_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editingUser.username}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      username: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>
              <button
                onClick={handleUpdateUser}
                className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reset Password</h2>
              <button
                onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md"
                  placeholder="Enter new password"
                />
              </div>
              <button
                onClick={handleResetPassword}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Key className="h-4 w-4" />
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
