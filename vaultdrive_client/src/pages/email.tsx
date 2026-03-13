import React, { useState, useEffect } from 'react';
import EmailAccountSettings from '../components/email/EmailAccountSettings';
import EditEmailAccountModal from '../components/email/EditEmailAccountModal';
import MailboxList from '../components/email/MailboxList';
import EmailList from '../components/email/EmailList';
import EmailView from '../components/email/EmailView';
import type { EmailSummary } from '../utils/api';
import { listEmailAccounts, listMailboxes, deleteEmailAccount } from '../utils/api';

import { Pencil, Trash2 } from 'lucide-react';

interface EmailAccount {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
}

const EmailPage: React.FC = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const fetchedAccounts = await listEmailAccounts(token);
          setAccounts(fetchedAccounts);
          if (fetchedAccounts.length > 0) {
            setSelectedAccount(fetchedAccounts[0]);
          }
        } catch (error) {
          setError('Failed to fetch email accounts');
          console.error('Failed to fetch email accounts', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      const fetchMailboxes = async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const fetchedMailboxes = await listMailboxes(selectedAccount.id, token);
            setMailboxes(fetchedMailboxes);
            if (fetchedMailboxes.length > 0) {
              setSelectedMailbox(fetchedMailboxes[0].name);
            }
          } catch (error) {
            setError('Failed to fetch mailboxes');
            console.error('Failed to fetch mailboxes', error);
          } finally {
            setIsLoading(false);
          }
        }
      };
      fetchMailboxes();
    }
  }, [selectedAccount]);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const fetchedAccounts = await listEmailAccounts(token);
        setAccounts(fetchedAccounts);
        if (fetchedAccounts.length > 0 && !selectedAccount) {
          setSelectedAccount(fetchedAccounts[0]);
        }
      } catch (error) {
        setError('Failed to fetch email accounts');
        console.error('Failed to fetch email accounts', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEditAccount = (account: EmailAccount) => {
    setEditingAccount(account);
    setIsEditModalOpen(true);
  };

  const handleUpdateComplete = () => {
    setIsEditModalOpen(false);
    setEditingAccount(null);
    fetchAccounts();
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (!window.confirm(`Are you sure you want to delete the email account "${account.email}"?`)) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required');
      return;
    }

    try {
      await deleteEmailAccount(account.id, token);
      if (selectedAccount?.id === account.id) {
        setSelectedAccount(null);
      }
      fetchAccounts();
    } catch (error) {
      setError('Failed to delete email account');
      console.error('Failed to delete email account', error);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#1e2330] via-[#2c3240] to-[#6b4345]">
      <EditEmailAccountModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        account={editingAccount}
        onUpdate={handleUpdateComplete}
      />
      <div className="w-64 bg-[#2c3240]/80 backdrop-blur-sm border-r border-white/10 p-4">
        <EmailAccountSettings />
        <h2 className="mt-4 text-lg font-semibold">Accounts</h2>
        {error && <p className="text-red-500">{error}</p>}
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-2">
              <button
                onClick={() => setSelectedAccount(account)}
                className={`flex-1 text-left px-4 py-2 text-sm rounded-md transition-colors ${
  selectedAccount?.id === account.id
    ? 'bg-[#7d4f50]/30 text-[#c4999b] border border-[#7d4f50]/50'
    : 'text-white/70 hover:bg-white/5 hover:text-white'
}`}
              >
                {account.email}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditAccount(account);
                }}
                className="p-2 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
                title="Edit account"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAccount(account);
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-md text-red-600 dark:text-red-400"
                title="Delete account"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {accounts.length === 0 && !isLoading && !error && (
          <p className="text-sm text-gray-500 mt-2">No email accounts configured</p>
        )}
        <h2 className="mt-4 text-lg font-semibold">Mailboxes</h2>
        <MailboxList
          mailboxes={mailboxes}
          selectedMailbox={selectedMailbox}
          onSelectMailbox={setSelectedMailbox}
        />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-4">
          <h2 className="text-lg font-semibold">Emails</h2>
          <EmailList
            account={selectedAccount}
            mailbox={selectedMailbox}
            onSelectEmail={setSelectedEmail}
          />
        </div>
        <div className="flex-1 p-4 border-t border-white/10">
          <EmailView account={selectedAccount} mailbox={selectedMailbox} email={selectedEmail} />
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
