import { useState, useEffect } from "react";
import {
  Shield,
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

interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_admin: boolean;
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

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

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
        alert(data.message);
        setSelected(new Set());
        await fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || "Error deleting users");
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
    if (newUser.password.length < 6) {
      setError("Password must be at least 6 characters");
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
      }
    } catch (err) {
      console.error("Error updating user:", err);
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
        alert("Password reset successfully!");
      }
    } catch (err) {
      console.error("Error resetting password:", err);
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
        alert("PIN cleared successfully.");
      }
    } catch (err) {
      console.error("Error resetting PIN:", err);
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
        alert(data.error || "Error updating admin status");
      }
    } catch (err) {
      console.error("Error toggling admin:", err);
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
      }
    } catch (err) {
      console.error("Error deleting user:", err);
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
          <Shield className="h-8 w-8 text-[#7d4f50]" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <button
          onClick={() => {
            setShowCreateUser(true);
            setError("");
          }}
          className="bg-[#7d4f50] text-white px-4 py-2 rounded-md hover:bg-[#6b4345] flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          New User
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-red-800">
            {selected.size} user{selected.size > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleting ? "Deleting..." : "Delete Selected"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-600 hover:text-gray-800 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-[#7d4f50] focus:ring-[#7d4f50]"
                  title="Select all"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const isSelected = selected.has(user.id);
              return (
                <tr
                  key={user.id}
                  className={isSelected ? "bg-red-50" : undefined}
                >
                  <td className="px-4 py-4 w-10">
                    {isSelf ? (
                      <div className="h-4 w-4" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(user.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#7d4f50] focus:ring-[#7d4f50]"
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_admin ? (
                      <button
                        onClick={() => !isSelf && handleToggleAdmin(user)}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-[#e2b9bb] text-[#7d4f50] ${
                          isSelf
                            ? "cursor-default"
                            : "hover:bg-[#d4a3a5] cursor-pointer"
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
                        className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
                        title="Click to grant admin"
                      >
                        <ShieldOff className="h-3 w-3 mr-1 mt-0.5" />
                        User
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-[#7d4f50] hover:text-[#6b4345] mr-3"
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
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New User</h2>
              <button
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUser(emptyNewUser);
                  setError("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, first_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, last_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Min. 6 characters"
                />
              </div>
              <button
                onClick={handleCreateUser}
                className="w-full bg-[#7d4f50] text-white px-4 py-2 rounded-md hover:bg-[#6b4345] flex items-center justify-center gap-2"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit User</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={handleUpdateUser}
                className="w-full bg-[#7d4f50] text-white px-4 py-2 rounded-md hover:bg-[#6b4345] flex items-center justify-center gap-2"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reset Password</h2>
              <button
                onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
