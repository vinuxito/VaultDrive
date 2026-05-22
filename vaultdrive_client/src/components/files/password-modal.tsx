import { useState } from 'react';
import { ElegantModal } from '../elegant';
import { CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Lock, Key, Loader2, AlertCircle } from 'lucide-react';
import { EncryptionPreview } from '../upload/encryption-preview';
import type { EncryptionStage } from '../upload/encryption-preview';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<boolean>;
  action: 'upload' | 'download';
  isLoading: boolean;
  error: string | null;
  selectedFile?: File | null;
  encryptionStage?: EncryptionStage;
}

export function PasswordModal({
  isOpen,
  onClose,
  onSubmit,
  action,
  isLoading,
  error,
  selectedFile,
  encryptionStage = 'idle',
}: PasswordModalProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    const success = await onSubmit(password);
    if (success) {
      setPassword('');
      onClose();
    }
  };

  const title = action === 'upload' ? 'Encrypt File' : 'Decrypt File';
  const description =
    action === 'upload'
      ? 'Enter a password to encrypt your file. This password will be required to decrypt it.'
      : 'Enter the password used to encrypt this file.';

  return (
    <ElegantModal isOpen={isOpen} onClose={onClose} className="w-full max-w-md">
      <CardHeader className="border-b-0">
        <CardTitle className="flex items-center gap-2 text-white">
          <Lock className="w-5 h-5 text-primary-foreground" />
          {title}
        </CardTitle>
        <CardDescription className="text-white/80">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {action === 'upload' && encryptionStage !== 'idle' ? (
          <EncryptionPreview
            isActive={true}
            fileName={selectedFile?.name}
            fileSize={selectedFile?.size}
            stage={encryptionStage}
          />
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-primary/20 border border-primary/30 text-primary-foreground text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary/60" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="encryption-password" className="text-sm font-medium flex items-center gap-2 text-white">
                <Key className="w-4 h-4" />
                Encryption Password
              </label>
              <Input
                id="encryption-password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="bg-white/15 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/20"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && password) {
                    handleSubmit();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="modal-cancel" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!password || isLoading} className="flex-1 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))/0.9] font-semibold">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {action === 'upload' ? 'Encrypting...' : 'Decrypting...'}
                  </>
                ) : (
                  action === 'upload' ? 'Encrypt & Upload' : 'Decrypt & Download'
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </ElegantModal>
  );
}
