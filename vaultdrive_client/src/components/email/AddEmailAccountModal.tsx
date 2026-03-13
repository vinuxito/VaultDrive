import React, { useState } from 'react';
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
import { createEmailAccount } from '../../utils/api';

interface AddEmailAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddEmailAccountModal: React.FC<AddEmailAccountModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<EmailAccountPayload>({
    email: '',
    imap_host: '',
    imap_port: 993,
    imap_user: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required. Please log in again.');
      return;
    }
    try {
      await createEmailAccount(formData, token);
      onClose();
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to create email account', err);
      if (err.status === 409) {
        setError('This email account is already configured');
      } else {
        setError('Failed to create email account. Please check your details and try again.');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Email Account</DialogTitle>
            <DialogDescription>
              Enter your IMAP account details below.
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
              <Input id="email" type="email" className="col-span-3" value={formData.email} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imap_host" className="text-right">
                IMAP Host
              </Label>
              <Input id="imap_host" className="col-span-3" value={formData.imap_host} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imap_port" className="text-right">
                IMAP Port
              </Label>
              <Input id="imap_port" type="number" className="col-span-3" value={formData.imap_port} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imap_user" className="text-right">
                IMAP User
              </Label>
              <Input id="imap_user" className="col-span-3" value={formData.imap_user} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input id="password" type="password" className="col-span-3" value={formData.password} onChange={handleChange} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmailAccountModal;
