import { useState, useEffect } from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';
import { ElegantModal } from '../elegant';
import { Button } from '../ui/button';
import { getFileVersions, restoreFileVersion } from '../../utils/api';
import { formatSize, formatDate } from '../../utils/format';

interface Version {
  id: string;
  version_number: number;
  file_size: number;
  created_at: string;
}

interface FileVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  filename: string;
  token: string;
  onVersionRestored?: () => void;
}

export function FileVersionsModal({
  isOpen,
  onClose,
  fileId,
  filename,
  token,
  onVersionRestored,
}: FileVersionsModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fileId) {
      loadVersions();
    }
  }, [isOpen, fileId]);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFileVersions(fileId, token);
      setVersions(data || []);
    } catch (err) {
      setError('Failed to load file versions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Restore version ${versionNumber}? This will create a new version with the restored content.`)) {
      return;
    }

    setRestoring(versionId);
    setError(null);
    try {
      await restoreFileVersion(fileId, versionId, token);
      alert('Version restored successfully!');
      onVersionRestored?.();
      onClose();
    } catch (err) {
      setError('Failed to restore version');
      console.error(err);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <ElegantModal isOpen={isOpen} onClose={onClose} title={`Version History: ${filename}`}>
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2" />
            <p>No versions found</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Version {version.version_number}</span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-600 text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>{formatSize(version.file_size)}</div>
                      <div>{formatDate(version.created_at)}</div>
                    </div>
                  </div>
                  {index !== 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(version.id, version.version_number)}
                      disabled={restoring === version.id}
                      className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {restoring === version.id ? 'Restoring...' : 'Restore'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </div>
    </ElegantModal>
  );
}
