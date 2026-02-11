import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { EmailAccountPayload } from '../../utils/api';
import { updateEmailAccount } from '../../utils/api';

interface EmailAccount {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
}

interface EditEmailAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: EmailAccount | null;
  onUpdate: () => void;
}

const EditEmailAccountModal: React.FC<EditEmailAccountModalProps> = ({
  isOpen,
  onClose,
  account,
  onUpdate
}) => {
  const [formData, setFormData] = useState<EmailAccountPayload>({
    email: '',
    imap_host: '',
    imap_port: 993,
    imap_user: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setFormData({
        email: account.email,
        imap_host: account.imapHost,
        imap_port: account.imapPort,
        imap_user: account.imapUser,
        password: '', // Don't pre-fill password for security
      });
    }
  }, [account]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!account) {
      setError('No account selected');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required. Please log in again.');
      return;
    }

    // If password is empty, don't include it in the update
    // (backend should keep existing password)
    const updateData = formData.password
      ? formData
      : {
          email: formData.email,
          imap_host: formData.imap_host,
          imap_port: formData.imap_port,
          imap_user: formData.imap_user,
        };

    try {
      await updateEmailAccount(account.id, updateData as EmailAccountPayload, token);
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Failed to update email account', err);
      setError('Failed to update email account. Please check your details and try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Email Account</DialogTitle>
            <DialogDescription>
              Update your IMAP account details below. Leave password empty to keep current password.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input id="email" type="email" className="col-span-3" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imap_host" className="text-right">
                IMAP Host
              </Label>
              <Input id="imap_host" className="col-span-3" value={formData.imap_host} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imap_port" className="text-right">
                IMAP Port
              </Label>
              <Input id="imap_port" type="number" className="col-span-3" value={formData.imap_port} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imap_user" className="text-right">
                IMAP User
              </Label>
              <Input id="imap_user" className="col-span-3" value={formData.imap_user} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                className="col-span-3"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave empty to keep current password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Update</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmailAccountModal;
