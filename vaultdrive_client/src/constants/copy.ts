/**
 * QuantiX Drive — centralised user-facing copy.
 *
 * One source of truth for destructive confirmations, loading states, and empty
 * states. Every screen that asks "are you sure?", says "Loading…", or renders
 * an empty list MUST source its strings from here. New strings go here, not
 * inline. This keeps tone consistent across the product and makes future
 * localisation a single-file migration instead of a hunt.
 *
 * See: docs/roadmaps/2026-04-26-ui-ux-coherence-upgrade-roadmap.md (Step 2)
 */

export interface DestructiveCopy {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** True if the action cannot be undone (we say so explicitly to the user). */
  irreversible: boolean;
}

export interface EmptyStateCopy {
  title: string;
  body: string;
  primaryAction?: {
    label: string;
    /** Either a route to navigate to, or an internal action key consumed by the host. */
    route?: string;
    actionKey?: string;
  };
}

/**
 * Destructive confirmation copy. Keys are stable so future localisation can
 * map 1:1 against them.
 */
export const CONFIRM_DESTRUCTIVE = {
  deleteFile: {
    title: "Delete this file?",
    body:
      "The encrypted file and its metadata will be removed from your vault. " +
      "Active share links pointing to it will stop working.",
    confirmLabel: "Delete file",
    cancelLabel: "Keep file",
    irreversible: true,
  },
  deleteFiles: {
    title: "Delete selected files?",
    body:
      "All selected encrypted files will be removed from your vault. " +
      "Active share links pointing to them will stop working.",
    confirmLabel: "Delete files",
    cancelLabel: "Keep files",
    irreversible: true,
  },
  deleteFolder: {
    title: "Delete this folder?",
    body:
      "The folder and any files inside it will be removed from your vault. " +
      "Active share or upload links scoped to this folder will stop working.",
    confirmLabel: "Delete folder",
    cancelLabel: "Keep folder",
    irreversible: true,
  },
  revokeShareLink: {
    title: "Revoke this share link?",
    body:
      "Anyone holding the link will lose access immediately. " +
      "Downloads already in progress will continue, but no new ones can start.",
    confirmLabel: "Revoke link",
    cancelLabel: "Keep link",
    irreversible: true,
  },
  revokeFolderShare: {
    title: "Revoke this folder share?",
    body:
      "Recipients will lose access to the shared folder immediately. " +
      "Files they have already downloaded remain on their devices.",
    confirmLabel: "Revoke folder share",
    cancelLabel: "Keep folder share",
    irreversible: true,
  },
  revokeAllExternal: {
    title: "Revoke every external link to this file?",
    body:
      "All public share links and folder shares pointing to this file will be revoked. " +
      "Group memberships are not affected. This is your kill switch — use it freely.",
    confirmLabel: "Revoke all external access",
    cancelLabel: "Cancel",
    irreversible: true,
  },
  expireDropLink: {
    title: "Expire this drop link?",
    body:
      "No new uploads will be accepted on this link. " +
      "Files that were already delivered remain in your vault.",
    confirmLabel: "Expire drop link",
    cancelLabel: "Keep drop link",
    irreversible: true,
  },
  deleteFileRequest: {
    title: "Delete this file request?",
    body:
      "The recipient will no longer be able to upload through this request. " +
      "Files already delivered through it stay in your vault.",
    confirmLabel: "Delete request",
    cancelLabel: "Keep request",
    irreversible: true,
  },
  removeGroupMember: {
    title: "Remove this member from the group?",
    body:
      "They lose access to every file currently shared with the group. " +
      "Files they already downloaded remain on their devices.",
    confirmLabel: "Remove member",
    cancelLabel: "Keep member",
    irreversible: true,
  },
  deleteAgentKey: {
    title: "Delete this agent API key?",
    body:
      "Any system using this key will stop working immediately. " +
      "Audit history for the key is preserved.",
    confirmLabel: "Delete agent key",
    cancelLabel: "Keep agent key",
    irreversible: true,
  },
  deleteUser: {
    title: "Delete this user?",
    body:
      "Their account, files, share links, and group memberships are removed. " +
      "Audit entries naming them are preserved for compliance.",
    confirmLabel: "Delete user",
    cancelLabel: "Keep user",
    irreversible: true,
  },
  forceLogoutSession: {
    title: "End this session?",
    body:
      "The session is invalidated immediately. " +
      "The user will need to log in again on that device.",
    confirmLabel: "End session",
    cancelLabel: "Keep session",
    irreversible: true,
  },
} as const satisfies Record<string, DestructiveCopy>;

export type DestructiveAction = keyof typeof CONFIRM_DESTRUCTIVE;

/**
 * Loading-state labels. Always present-progressive ("Decrypting…", not
 * "Loading…"), so the user knows what work is happening.
 */
export const LOADING = {
  decryptingPrivateKey: "Decrypting your vault…",
  unwrappingFileKey: "Preparing this file for download…",
  uploadingFile: "Encrypting and uploading…",
  creatingShareLink: "Creating your share link…",
  creatingFolderShare: "Creating your folder share…",
  creatingDropLink: "Creating your drop link…",
  creatingFileRequest: "Creating your file request…",
  revokingLink: "Revoking access…",
  revokingAllExternal: "Revoking every external link…",
  loadingVault: "Loading your vault…",
  loadingAccess: "Loading access details…",
  loadingAuditEntries: "Loading audit entries…",
  deletingFile: "Removing the file from your vault…",
  workingDefault: "Working…",
} as const;

export type LoadingState = keyof typeof LOADING;

/**
 * Empty-state copy. Each empty state names a primary next action so the user
 * is never stuck on a blank screen with no narrated path forward.
 */
export const EMPTY = {
  vaultEmpty: {
    title: "Your vault is ready",
    body:
      "Your files are encrypted in your browser before they ever reach the server. " +
      "Upload your first file to see how it works.",
    primaryAction: { label: "Upload a file", actionKey: "open-upload" },
  },
  accessCenterEmpty: {
    title: "No outbound access yet",
    body:
      "Once you create a share link, folder share, or drop route, it will appear here so you can revoke it at any time.",
    primaryAction: { label: "Go to your files", route: "/files" },
  },
  shareLinksEmpty: {
    title: "No share links",
    body: "Share links you create will be listed here so you can revoke any of them in one click.",
  },
  folderSharesEmpty: {
    title: "No folder shares",
    body: "Folder shares you create will appear here. You can revoke them at any time.",
  },
  dropLinksEmpty: {
    title: "No drop links",
    body:
      "Drop links let people send you files without an account. " +
      "Files arrive encrypted and only you can decrypt them.",
    primaryAction: { label: "Create a drop link", actionKey: "create-drop-link" },
  },
  fileRequestsEmpty: {
    title: "No file requests",
    body:
      "File requests let you ask a specific person to upload required documents. " +
      "Each request has its own checklist.",
  },
  groupsEmpty: {
    title: "No groups yet",
    body:
      "Groups let you share with the same set of people without re-entering recipients each time.",
    primaryAction: { label: "Create a group", actionKey: "create-group" },
  },
  agentKeysEmpty: {
    title: "No agent API keys",
    body:
      "Agent keys grant scoped, revocable access for AI agents and external systems. " +
      "Each key can be limited to specific actions and audited.",
    primaryAction: { label: "Create an agent key", actionKey: "create-agent-key" },
  },
  auditLogEmpty: {
    title: "No audit entries match",
    body: "Try widening the time range or clearing filters to see more activity.",
  },
} as const satisfies Record<string, EmptyStateCopy>;

export type EmptyKind = keyof typeof EMPTY;

/**
 * Generic error copy used by `<DataState>` and inline error banners.
 * Specific endpoints can override the body, but the title and recovery action
 * stay consistent.
 */
export const ERROR_COPY = {
  generic: {
    title: "Something didn't load",
    body: "The server didn't respond as expected. Try again — your vault is safe.",
    retryLabel: "Try again",
  },
  network: {
    title: "Network problem",
    body: "We couldn't reach the server. Check your connection and try again.",
    retryLabel: "Try again",
  },
  unauthorized: {
    title: "Your session expired",
    body: "Sign in again to continue. Nothing was lost.",
    retryLabel: "Sign in",
  },
} as const;

export type ErrorKind = keyof typeof ERROR_COPY;
