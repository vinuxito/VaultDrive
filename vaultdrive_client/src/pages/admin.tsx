import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";

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
  const { t } = useTranslation(["drive"]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    body: "",
    confirmLabel: "",
    cancelLabel: "",
    onConfirm: () => {},
  });
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
    setConfirmDialog({
      open: true,
      title: t("drive:admin.confirmDeleteUsersTitle"),
      body: t("drive:admin.confirmDeleteUsersBody", { count }),
      confirmLabel: t("drive:admin.confirmDeleteUsersBtn"),
      cancelLabel: t("drive:admin.cancel"),
      onConfirm: async () => {
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
            addToast(data.error || t("drive:admin.errorDeleteUsers"), "error");
          }
        } catch (err) {
          console.error("Error bulk deleting:", err);
        } finally {
          setBulkDeleting(false);
        }
      },
    });
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
      setError(t("drive:admin.errorFieldsRequired"));
      return;
    }
    if (newUser.password.length < 8) {
      setError(t("drive:admin.errorPasswordLength"));
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
        setError(data.error || t("drive:admin.errorCreateUser"));
      }
    } catch (err) {
      console.error("Error creating user:", err);
      setError(t("drive:admin.networkError"));
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
        addToast(data.error || t("drive:admin.errorUpdateUser"), "error");
      }
    } catch (err) {
      console.error("Error updating user:", err);
      addToast(t("drive:admin.networkErrorUpdateUser"), "error");
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
        addToast(t("drive:admin.successResetPassword"), "success");
      } else {
        const data = await response.json();
        addToast(data.error || t("drive:admin.errorResetPassword"), "error");
      }
    } catch (err) {
      console.error("Error resetting password:", err);
      addToast(t("drive:admin.networkErrorResetPassword"), "error");
    }
  };

  const handleResetPIN = async (userId: string, userName: string) => {
    setConfirmDialog({
      open: true,
      title: t("drive:admin.confirmResetPinTitle"),
      body: t("drive:admin.confirmResetPinBody", { name: userName }),
      confirmLabel: t("drive:admin.confirmResetPinBtn"),
      cancelLabel: t("drive:admin.cancel"),
      onConfirm: async () => {
        try {
          const response = await fetch(
            `${API_URL}/admin/users/${userId}/reset-pin`,
            {
              method: "POST",
              headers: authHeaders(),
            }
          );

          if (response.ok) {
            addToast(t("drive:admin.successResetPin"), "success");
          } else {
            const data = await response.json();
            addToast(data.error || t("drive:admin.errorResetPin"), "error");
          }
        } catch (err) {
          console.error("Error resetting PIN:", err);
          addToast(t("drive:admin.networkErrorResetPin"), "error");
        }
      },
    });
  };

  const handleToggleAdmin = async (user: User) => {
    const userName = `${user.first_name} ${user.last_name}`;
    setConfirmDialog({
      open: true,
      title: t("drive:admin.confirmToggleAdminTitle"),
      body: t("drive:admin.confirmToggleAdminBody", { name: userName }),
      confirmLabel: t("drive:admin.confirmToggleAdminBtn"),
      cancelLabel: t("drive:admin.cancel"),
      onConfirm: async () => {
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
            addToast(data.error || t("drive:admin.errorToggleAdmin"), "error");
          }
        } catch (err) {
          console.error("Error toggling admin:", err);
        }
      },
    });
  };

  const handleForcePasswordChange = async (user: User) => {
    const userName = `${user.first_name} ${user.last_name}`;
    setConfirmDialog({
      open: true,
      title: t("drive:admin.confirmForcePassTitle"),
      body: t("drive:admin.confirmForcePassBody", { name: userName }),
      confirmLabel: t("drive:admin.confirmForcePassBtn"),
      cancelLabel: t("drive:admin.cancel"),
      onConfirm: async () => {
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
            addToast(t("drive:admin.successForcePass"), "success");
          } else {
            const data = await response.json();
            addToast(data.error || t("drive:admin.errorForcePass"), "error");
          }
        } catch (err) {
          console.error("Error forcing password change:", err);
          addToast(t("drive:admin.networkError"), "error");
        }
      },
    });
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmDialog({
      open: true,
      title: t("drive:admin.confirmDeleteUserTitle"),
      body: t("drive:admin.confirmDeleteUserBody"),
      confirmLabel: t("drive:admin.confirmDeleteUserBtn"),
      cancelLabel: t("drive:admin.cancel"),
      onConfirm: async () => {
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
            addToast(data.error || t("drive:admin.errorDeleteUser"), "error");
          }
        } catch (err) {
          console.error("Error deleting user:", err);
          addToast(t("drive:admin.networkErrorDeleteUser"), "error");
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{t("drive:admin.loading")}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t("drive:admin.dashboardTitle")}</h1>
        </div>
        <button
          onClick={() => {
            setShowCreateUser(true);
            setError("");
          }}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          {t("drive:admin.newUser")}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-4 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-destructive">
            {t("drive:admin.usersSelected", { count: selected.size })}
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-destructive text-white px-3 py-1.5 rounded-md hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2 text-sm cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleting ? t("drive:admin.deleting") : t("drive:admin.bulkDeleteTitle")}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-muted-foreground hover:text-foreground ml-auto cursor-pointer"
          >
            {t("drive:admin.clearSelection")}
          </button>
        </div>
      )}

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border" aria-label={t("drive:admin.tableLabel")}>
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  title={t("drive:admin.selectAll")}
                  aria-label={t("drive:admin.selectAll")}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("drive:admin.thName")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("drive:admin.thUsername")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("drive:admin.thEmail")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("drive:admin.thRole")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("drive:admin.thJoined")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("drive:admin.thActions")}
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
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        aria-label={t("drive:admin.selectUser", { name: `${user.first_name} ${user.last_name}` })}
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
                            ? t("drive:admin.cannotChangeOwnAdmin")
                            : t("drive:admin.revokeAdminHelp")
                        }
                        disabled={isSelf}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1 mt-0.5" />
                        {t("drive:admin.roleAdmin")}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-muted text-muted-foreground hover:bg-muted cursor-pointer"
                        title={t("drive:admin.grantAdminHelp")}
                      >
                        <ShieldOff className="h-3 w-3 mr-1 mt-0.5" />
                        {t("drive:admin.roleUser")}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-primary hover:text-primary/90 mr-3 cursor-pointer"
                      title={t("drive:admin.editUserHelp")}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setResetPasswordUser(user.id)}
                      className="text-green-600 hover:text-green-900 mr-3 cursor-pointer"
                      title={t("drive:admin.resetPasswordHelp")}
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
                      className="text-orange-500 hover:text-orange-700 mr-3 cursor-pointer"
                      title={t("drive:admin.resetPinHelp")}
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleForcePasswordChange(user)}
                        className={`mr-3 cursor-pointer ${
                          user.force_password_change
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-400"
                        }`}
                        title={
                          user.force_password_change
                            ? t("drive:admin.passwordChangeRequired")
                            : t("drive:admin.forcePasswordChangeHelp")
                        }
                        disabled={user.force_password_change}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:text-destructive/80 cursor-pointer"
                        title={t("drive:admin.deleteUserHelp")}
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
              <h2 className="text-xl font-bold">{t("drive:admin.createUserTitle")}</h2>
              <button
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUser(emptyNewUser);
                  setError("");
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
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
                    {t("drive:admin.firstName")}
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
                    {t("drive:admin.lastName")}
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
                  {t("drive:admin.username")}
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
                  {t("drive:admin.email")}
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
                  {t("drive:admin.password")}
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-md"
                  placeholder={t("drive:admin.passwordPlaceholder")}
                />
              </div>
              <button
                onClick={handleCreateUser}
                className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                {t("drive:admin.btnCreateUser")}
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
              <h2 className="text-xl font-bold">{t("drive:admin.editUserTitle")}</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("drive:admin.firstName")}
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
                  {t("drive:admin.lastName")}
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
                  {t("drive:admin.username")}
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
                  {t("drive:admin.email")}
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
                className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                {t("drive:admin.btnSaveChanges")}
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
              <h2 className="text-xl font-bold">{t("drive:admin.resetPasswordTitle")}</h2>
              <button
                onClick={() => {
                  setResetPasswordUser(null);
                  setNewPassword("");
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("drive:admin.newPassword")}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md"
                  placeholder={t("drive:admin.placeholderNewPassword")}
                />
              </div>
              <button
                onClick={handleResetPassword}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="h-4 w-4" />
                {t("drive:admin.btnResetPassword")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
              className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-md mr-2 transition-colors cursor-pointer"
            >
              {confirmDialog.cancelLabel}
            </button>
            <button
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
              className="px-4 py-2 text-sm font-medium bg-destructive hover:bg-destructive/90 text-white rounded-md transition-colors cursor-pointer"
            >
              {confirmDialog.confirmLabel}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
