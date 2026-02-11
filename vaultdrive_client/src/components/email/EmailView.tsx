import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { EmailSummary } from '../../utils/api';
import { getEmail } from '../../utils/api';

interface EmailViewProps {
  account: { id: string; email: string } | null;
  mailbox: string | null;
  email: EmailSummary | null;
}

const EmailView: React.FC<EmailViewProps> = ({ account, mailbox, email }) => {
  const [body, setBody] = useState<{ text: string; html: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account && mailbox && email) {
      const fetchEmail = async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const fetchedBody = await getEmail(account.id, mailbox, email.uid, token);
            setBody(fetchedBody);
          } catch (error) {
            setError('Failed to fetch email');
            console.error('Failed to fetch email', error);
          } finally {
            setIsLoading(false);
          }
        }
      };
      fetchEmail();
    }
  }, [account, mailbox, email]);

  if (!email) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <p className="text-gray-500">Select an email to view</p>
      </div>
    );
  }

  if (isLoading) {
    return <p>Loading email...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  const sanitizedHtml = DOMPurify.sanitize(body?.html || '');

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{email.subject}</h2>
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-300 mr-4" />
        <div>
          <p className="font-semibold">{email.from.join(', ')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">to: you@example.com</p>
        </div>
      </div>
      <div
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml || body?.text || '' }}
      />
    </div>
  );
};

export default EmailView;
