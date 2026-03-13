import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './api';
import {
  generateSalt,
  deriveKeyFromPassword,
  encryptFile,
  decryptFile,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './crypto';

export interface FileData {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
  metadata: string;
  starred?: boolean;
}

export function useFiles() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await fetch(`${API_URL}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return { files, setFiles, loading, error, refetch: fetchFiles };
}

export type EncryptionStage = 'idle' | 'generating-key' | 'encrypting' | 'uploading' | 'complete';

export function useUpload({ onUploadSuccess }: { onUploadSuccess: () => void }) {
    const navigate = useNavigate();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [encryptionStage, setEncryptionStage] = useState<EncryptionStage>('idle');

    const performUpload = async (file: File, password: string): Promise<boolean> => {
        if (!file) return false;

        setUploading(true);
        setError(null);

        try {
            setEncryptionStage('generating-key');
            const salt = generateSalt();
            const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);

            setEncryptionStage('encrypting');
            const { encryptedData, iv } = await encryptFile(file, encryptionKey);

            const formData = new FormData();
            const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });
            formData.append('file', encryptedBlob, file.name);

            const metadata = {
                salt: arrayBufferToBase64(salt),
                iv: arrayBufferToBase64(iv),
                algorithm: 'AES-256-GCM',
            };
            formData.append('metadata', JSON.stringify(metadata));
            
            setEncryptionStage('uploading');

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                if (response.status === 401) {
                    navigate('/login');
                    return false;
                }
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to upload file');
            }
            
            setEncryptionStage('complete');
            await new Promise(resolve => setTimeout(resolve, 1000));
            onUploadSuccess();
            return true;

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during upload');
            return false;
        } finally {
            setUploading(false);
            setEncryptionStage('idle');
        }
    };

    return { uploading, error, encryptionStage, performUpload, setError };
}

export function useDownload() {
    const navigate = useNavigate();
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const performDownload = async (file: FileData, password: string): Promise<boolean> => {
        if (!file) return false;

        setDownloading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/files/${file.id}/download`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                if (response.status === 401) navigate('/login');
                throw new Error('Failed to download file');
            }

            const metadataStr = file.metadata;
            if (!metadataStr) throw new Error('File metadata not found');

            const metadata = JSON.parse(metadataStr);
            if (!metadata.salt || !metadata.iv) throw new Error('Invalid encryption metadata');

            const salt = new Uint8Array(base64ToArrayBuffer(metadata.salt));
            const iv = new Uint8Array(base64ToArrayBuffer(metadata.iv));

            const encryptionKey = await deriveKeyFromPassword(password, salt, 100000);
            const encryptedData = await response.arrayBuffer();
            const decryptedData = await decryptFile(encryptedData, encryptionKey, iv);

            const decryptedBlob = new Blob([decryptedData]);
            const url = window.URL.createObjectURL(decryptedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Download or decryption failed. Check password.');
            return false;
        } finally {
            setDownloading(false);
        }
    };
    
    return { downloading, error, performDownload, setError };
}
