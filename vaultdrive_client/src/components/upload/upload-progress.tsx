import { File, Lock, Cloud, Check, X, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type UploadStatus = 'pending' | 'encrypting' | 'uploading' | 'complete' | 'error';

export interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  encryptionProgress: number;
  uploadProgress: number;
  error?: string;
}

export interface UploadProgressProps {
  files: UploadingFile[];
  onCancel?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  onRemove?: (fileId: string) => void;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function UploadProgress({
  files,
  onCancel,
  onRetry,
  onRemove,
  className,
}: UploadProgressProps) {
  if (files.length === 0) return null;

  const completedCount = files.filter(f => f.status === 'complete').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const activeCount = files.filter(f => f.status === 'encrypting' || f.status === 'uploading').length;

  return (
    <div className={cn('glass rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#7d4f50]/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">
            {activeCount > 0 ? 'Uploading' : completedCount === files.length ? 'Complete' : 'Upload Queue'}
          </h3>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{files.length} files
          </span>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1 text-primary text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{activeCount} active</span>
            </div>
          )}
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-destructive text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{errorCount} failed</span>
            </div>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
        {files.map((file) => (
          <UploadFileItem
            key={file.id}
            file={file}
            onCancel={() => onCancel?.(file.id)}
            onRetry={() => onRetry?.(file.id)}
            onRemove={() => onRemove?.(file.id)}
          />
        ))}
      </div>

      {/* Footer with overall progress */}
      {activeCount > 0 && (
        <div className="px-4 py-2 border-t border-[#7d4f50]/15 bg-[#7d4f50]/3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Overall Progress</span>
            <span>{Math.round((completedCount / files.length) * 100)}%</span>
          </div>
          <div className="h-1 bg-[#7d4f50]/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / files.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface UploadFileItemProps {
  file: UploadingFile;
  onCancel?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
}

function UploadFileItem({ file, onCancel, onRetry, onRemove }: UploadFileItemProps) {
  const isComplete = file.status === 'complete';
  const isError = file.status === 'error';
  const isEncrypting = file.status === 'encrypting';
  const isUploading = file.status === 'uploading';
  const isPending = file.status === 'pending';
  const isActive = isEncrypting || isUploading;

  return (
    <div className={cn(
      'px-4 py-3 transition-colors duration-200',
      isComplete && 'bg-green-500/5',
      isError && 'bg-destructive/5'
    )}>
      {/* File info row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* File icon with status indicator */}
          <div className="relative flex-shrink-0">
            <File className={cn(
              'w-5 h-5',
              isComplete ? 'text-green-500' : isError ? 'text-destructive' : 'text-muted-foreground'
            )} />
            {isActive && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          
          {/* File name and size */}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {isComplete && (
            <div className="flex items-center gap-1 text-green-500">
              <div className="relative">
                <Check className="w-4 h-4" />
                <div className="absolute inset-0 animate-ping">
                  <Check className="w-4 h-4 text-green-500/50" />
                </div>
              </div>
              <span className="text-xs font-medium">Done</span>
            </div>
          )}
          
          {isError && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs font-medium">Retry</span>
            </button>
          )}
          
          {isActive && (
            <button
              onClick={onCancel}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-[#7d4f50]/10 rounded transition-colors"
              title="Cancel upload"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {(isComplete || isError) && onRemove && (
            <button
              onClick={onRemove}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-[#7d4f50]/10 rounded transition-colors"
              title="Remove from list"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bars */}
      {!isComplete && !isError && (
        <div className="space-y-2">
          {/* Encryption progress */}
          <div className="flex items-center gap-2">
            <Lock className={cn(
              'w-3 h-3 flex-shrink-0 transition-colors',
              file.encryptionProgress === 100 ? 'text-green-500' : 
              isEncrypting ? 'text-primary' : 'text-muted-foreground/50'
            )} />
            <div className="flex-1 h-1.5 bg-[#7d4f50]/15 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  file.encryptionProgress === 100 
                    ? 'bg-green-500' 
                    : 'bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%]',
                  isEncrypting && 'animate-gradient-x'
                )}
                style={{ width: `${file.encryptionProgress}%` }}
              />
            </div>
            <span className={cn(
              'text-xs w-10 text-right tabular-nums',
              file.encryptionProgress === 100 ? 'text-green-500' : 'text-muted-foreground'
            )}>
              {file.encryptionProgress}%
            </span>
          </div>

          {/* Upload progress */}
          <div className="flex items-center gap-2">
            <Cloud className={cn(
              'w-3 h-3 flex-shrink-0 transition-colors',
              file.uploadProgress === 100 ? 'text-green-500' : 
              isUploading ? 'text-primary' : 'text-muted-foreground/50'
            )} />
            <div className="flex-1 h-1.5 bg-[#7d4f50]/15 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  file.uploadProgress === 100 
                    ? 'bg-green-500' 
                    : 'bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%]',
                  isUploading && 'animate-gradient-x'
                )}
                style={{ width: `${file.uploadProgress}%` }}
              />
            </div>
            <span className={cn(
              'text-xs w-10 text-right tabular-nums',
              file.uploadProgress === 100 ? 'text-green-500' : 'text-muted-foreground'
            )}>
              {file.uploadProgress}%
            </span>
          </div>
        </div>
      )}

      {/* Status text */}
      {isPending && (
        <p className="text-xs text-muted-foreground mt-1">Waiting in queue...</p>
      )}
      
      {isEncrypting && (
        <p className="text-xs text-primary mt-1 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Encrypting with AES-256-GCM...
        </p>
      )}
      
      {isUploading && (
        <p className="text-xs text-primary mt-1 flex items-center gap-1">
          <Cloud className="w-3 h-3" />
          Uploading encrypted data...
        </p>
      )}

      {/* Error message */}
      {isError && file.error && (
        <div className="flex items-center gap-2 text-destructive text-xs mt-2 p-2 bg-destructive/10 rounded">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{file.error}</span>
        </div>
      )}
    </div>
  );
}

export default UploadProgress;
