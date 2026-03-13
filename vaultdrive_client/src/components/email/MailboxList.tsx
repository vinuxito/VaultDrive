import React from 'react';

interface Mailbox {
  id: string;
  name: string;
  messages: number;
  unseen: number;
}

interface MailboxListProps {
  mailboxes: Mailbox[];
  selectedMailbox: string | null;
  onSelectMailbox: (mailbox: string) => void;
}

const MailboxList: React.FC<MailboxListProps> = ({ mailboxes, selectedMailbox, onSelectMailbox }) => {
  return (
    <ul className="space-y-2">
      {mailboxes.map((mailbox) => (
        <li key={mailbox.id}>
          <button
            onClick={() => onSelectMailbox(mailbox.name)}
            className={`w-full text-left px-4 py-2 text-sm rounded-md ${selectedMailbox === mailbox.name ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          >
            <div className="flex justify-between items-center">
              <span>{mailbox.name}</span>
              <span className="text-gray-500">{mailbox.messages}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default MailboxList;
