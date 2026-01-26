import React, { useState, useEffect } from 'react';
import EmailAccountSettings from '../components/email/EmailAccountSettings';
import MailboxList from '../components/email/MailboxList';
import EmailList from '../components/email/EmailList';
import EmailView from '../components/email/EmailView';
import type { EmailSummary } from '../utils/api';
import { listEmailAccounts, listMailboxes } from '../utils/api';

interface EmailAccount {
  id: string;
  email: string;
}

const EmailPage: React.FC = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
        <EmailAccountSettings />
        <h2 className="mt-4 text-lg font-semibold">Accounts</h2>
        {error && <p className="text-red-500">{error}</p>}
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                onClick={() => setSelectedAccount(account)}
                className={`w-full text-left px-4 py-2 text-sm rounded-md ${selectedAccount?.id === account.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              >
                {account.email}
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
        <div className="flex-1 p-4 border-t border-gray-200 dark:border-gray-700">
          <EmailView account={selectedAccount} mailbox={selectedMailbox} email={selectedEmail} />
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
