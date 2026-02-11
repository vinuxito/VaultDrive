import React, { useState, useEffect } from 'react';
import type { EmailSummary } from '../../utils/api';
import { listEmails } from '../../utils/api';

interface EmailListProps {
  account: { id: string; email: string } | null;
  mailbox: string | null;
  onSelectEmail: (email: EmailSummary) => void;
}

const EmailList: React.FC<EmailListProps> = ({ account, mailbox, onSelectEmail }) => {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account && mailbox) {
      const fetchEmails = async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const fetchedEmails = await listEmails(account.id, mailbox, token);
            setEmails(fetchedEmails);
          } catch (error) {
            setError('Failed to fetch emails');
            console.error('Failed to fetch emails', error);
          } finally {
            setIsLoading(false);
          }
        }
      };
      fetchEmails();
    }
  }, [account, mailbox]);

  if (isLoading) {
    return <p>Loading emails...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div>
      {emails.map((email) => (
        <div
          key={email.uid}
          onClick={() => onSelectEmail(email)}
          className="border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <div className="flex justify-between">
            <p className="font-semibold">{email.from.join(', ')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(email.date).toLocaleDateString()}</p>
          </div>
          <p className="text-gray-600 dark:text-gray-300">{email.subject}</p>
        </div>
      ))}
    </div>
  );
};

export default EmailList;
