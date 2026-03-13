export const API_URL = import.meta.env.VITE_API_URL || "/abrn/api";

// Email Accounts API
export interface EmailAccountPayload {
  email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  password?: string;
}

export const createEmailAccount = async (account: EmailAccountPayload, token: string) => {
  const response = await fetch(`${API_URL}/email/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(account),
  });
  if (!response.ok) {
    const error: any = new Error('Failed to create email account');
    error.status = response.status;
    error.response = await response.json().catch(() => ({}));
    throw error;
  }
  return response.json();
};

export const listEmailAccounts = async (token: string) => {
  const response = await fetch(`${API_URL}/email/accounts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to list email accounts');
  }
  return response.json();
};

export const listMailboxes = async (accountId: string, token: string) => {
  const response = await fetch(`${API_URL}/email/accounts/${accountId}/mailboxes`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to list mailboxes');
  }
  return response.json();
};

export interface EmailSummary {
  uid: number;
  from: string[];
  subject: string;
  date: string;
}

export const listEmails = async (accountId: string, mailboxName: string, token: string): Promise<EmailSummary[]> => {
  const response = await fetch(`${API_URL}/email/accounts/${accountId}/mailboxes/${mailboxName}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to list emails');
  }
  return response.json();
};

export const getEmail = async (accountId: string, mailboxName: string, uid: number, token: string) => {
  const response = await fetch(`${API_URL}/email/accounts/${accountId}/mailboxes/${mailboxName}/${uid}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to get email');
  }
  return response.json();
};

export const updateEmailAccount = async (accountId: string, account: EmailAccountPayload, token: string) => {
  const response = await fetch(`${API_URL}/email/accounts/${accountId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(account),
  });
  if (!response.ok) {
    const error: any = new Error('Failed to update email account');
    error.status = response.status;
    error.response = await response.json().catch(() => ({}));
    throw error;
  }
  return response.json();
};

export const deleteEmailAccount = async (accountId: string, token: string) => {
  const response = await fetch(`${API_URL}/email/accounts/${accountId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to delete email account');
  }
  return response.json();
};

// File versions API (stub for compilation)
export const getFileVersions = async (fileId: string, token: string) => {
  const response = await fetch(`${API_URL}/files/${fileId}/versions`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch file versions');
  return response.json();
};

export const restoreFileVersion = async (fileId: string, versionId: string, token: string) => {
  const response = await fetch(`${API_URL}/files/${fileId}/versions/${versionId}/restore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to restore file version');
  return response.json();
};
