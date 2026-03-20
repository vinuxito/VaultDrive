import { useState, useRef, useCallback } from 'react';
import { Upload, FileUp, AlertCircle, Files } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropzoneProps {
  onFilesDrop: (files: File[]) => void;
  onUploadStart?: () => void;
  maxFileSize?: number;
  acceptedTypes?: string[];
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function Dropzone({
  onFilesDrop,
  onUploadStart,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  acceptedTypes,
  multiple = true,
  disabled = false,
  className,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    
    for (const file of files) {
      if (file.size > maxFileSize) {
        setError(`File "${file.name}" exceeds ${formatSize(maxFileSize)} limit`);
        continue;
      }
      if (acceptedTypes && acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
        setError(`File type "${file.type || 'unknown'}" not accepted`);
        continue;
      }
      validFiles.push(file);
    }
    
    return validFiles;
  }, [maxFileSize, acceptedTypes]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (!disabled && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    setError(null);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const filesToProcess = multiple ? files : [files[0]];
    const validFiles = validateFiles(filesToProcess);

    if (validFiles.length > 0) {
      onUploadStart?.();
      onFilesDrop(validFiles);
    }
  }, [disabled, multiple, onFilesDrop, onUploadStart, validateFiles]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files || []);
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onUploadStart?.();
      onFilesDrop(validFiles);
    }
    
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [onFilesDrop, onUploadStart, validateFiles]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label="Upload files by dropping them here or clicking to browse"
      aria-disabled={disabled}
      className={cn(
        // Base styles
        'relative rounded-xl p-8 text-center cursor-pointer',
        'transition-all duration-300 ease-out',
        // Glassmorphism
        'glass border-2 border-dashed',
        // Default state
        'border-[#7d4f50]/25 hover:border-[#7d4f50]/45 hover:bg-[#7d4f50]/5',
        // Focus state
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent',
        // Dragging state
        isDragging && [
          'border-primary bg-primary/10',
          'shadow-[0_0_30px_rgba(99,102,241,0.3)]',
          'scale-[1.02]',
        ],
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes?.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />

      {/* Animated background gradient on drag */}
      {isDragging && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 animate-gradient-x" />
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 transition-all duration-300',
          isDragging && 'scale-110'
        )}
      >
        {isDragging ? (
          <div className="relative">
            <FileUp className="w-14 h-14 mx-auto mb-4 text-primary animate-bounce" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/20 animate-ping" />
            </div>
          </div>
        ) : (
          <div className="relative">
            <Upload className="w-14 h-14 mx-auto mb-4 text-muted-foreground transition-colors group-hover:text-primary" />
            {multiple && (
              <Files className="w-6 h-6 absolute -right-2 -bottom-1 text-muted-foreground/60" />
            )}
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="relative z-10">
        <p className={cn(
          'text-lg font-semibold mb-2 transition-colors duration-300',
          isDragging ? 'text-primary' : 'text-foreground'
        )}>
          {isDragging ? 'Release to encrypt & upload' : 'Drop files here to encrypt & upload'}
        </p>

        <p className="text-sm text-muted-foreground mb-4">
          or <span className="text-primary hover:underline">click to browse</span> your files
        </p>

        {/* Error message */}
        {error && (
          <div className="flex items-center justify-center gap-2 text-destructive text-sm mb-4 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Info footer */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground/60">
          <span>All file types supported</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <span>Max {formatSize(maxFileSize)}</span>
          {multiple && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>Multiple files</span>
            </>
          )}
          <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <span>All files are encrypted before leaving your device</span>
        </div>
      </div>

      {/* Security badge */}
      <div className={cn(
        'absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full',
        'bg-green-500/10 text-green-500 text-xs font-medium',
        'transition-opacity duration-300',
        isDragging ? 'opacity-100' : 'opacity-60'
      )}>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>AES-256 Encrypted</span>
      </div>
    </div>
  );
}

export default Dropzone;
