import { Key, File, Lock, Cloud, Shield, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type EncryptionStage = 'idle' | 'generating-key' | 'encrypting' | 'uploading' | 'complete';

export interface EncryptionPreviewProps {
  isActive: boolean;
  fileName?: string;
  fileSize?: number;
  stage: EncryptionStage;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function EncryptionPreview({
  isActive,
  fileName,
  fileSize,
  stage,
  className,
}: EncryptionPreviewProps) {
  if (!isActive || stage === 'idle') return null;

  return (
    <div
      className={cn(
        'glass rounded-xl p-6 text-center animate-fade-in',
        className
      )}
    >
      {/* Animation container */}
      <div className="relative h-28 flex items-center justify-center mb-4">
        {stage === 'generating-key' && <KeyGenerationAnimation />}
        {stage === 'encrypting' && <EncryptingAnimation />}
        {stage === 'uploading' && <UploadingAnimation />}
        {stage === 'complete' && <CompleteAnimation />}
      </div>

      {/* Stage title */}
      <p className={cn(
        'text-lg font-semibold mb-2 transition-colors',
        stage === 'complete' ? 'text-green-500' : 'text-foreground'
      )}>
        {stage === 'generating-key' && 'Generating encryption key...'}
        {stage === 'encrypting' && `Encrypting ${fileName || 'file'}...`}
        {stage === 'uploading' && 'Uploading encrypted data...'}
        {stage === 'complete' && 'Encryption complete!'}
      </p>

      {/* Stage description */}
      <p className="text-sm text-muted-foreground mb-3">
        {stage === 'generating-key' && 'Your key never leaves your device'}
        {stage === 'encrypting' && 'AES-256-GCM • Military-grade encryption'}
        {stage === 'uploading' && 'Server sees only encrypted bytes'}
        {stage === 'complete' && 'Your file is securely stored'}
      </p>

      {/* File info */}
      {fileSize && (
        <p className="text-xs text-muted-foreground/60">
          {formatSize(fileSize)}
        </p>
      )}

      {/* Trust indicators */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-500" />
            <span>Zero-Knowledge</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-primary" />
            <span>End-to-End</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyGenerationAnimation() {
  // Static sparkle positions - no need for state
  const sparkleAngles = [0, 60, 120, 180, 240, 300];

  return (
    <div className="relative">
      {/* Central key icon */}
      <div className="relative z-10">
        <Key className="w-14 h-14 text-primary animate-pulse" />
      </div>

      {/* Sparkle particles */}
      <div className="absolute inset-0 flex items-center justify-center">
        {sparkleAngles.map((angle, i) => (
          <span
            key={i}
            className="absolute text-yellow-400 text-lg animate-sparkle"
            style={{
              animationDelay: `${i * 0.15}s`,
              transform: `rotate(${angle}deg) translateY(-32px)`,
            }}
          >
            ✨
          </span>
        ))}
      </div>

      {/* Rotating ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-primary/30 animate-spin-slow" />
      </div>

      {/* Pulsing glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 animate-ping" />
      </div>
    </div>
  );
}

function EncryptingAnimation() {
  return (
    <div className="flex items-center justify-center gap-6">
      {/* File icon moving */}
      <div className="relative animate-slide-right">
        <File className="w-10 h-10 text-muted-foreground" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/80" />
      </div>

      {/* Arrow/flow indicator */}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-flow"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>

      {/* Lock icon appearing */}
      <div className="relative animate-scale-in">
        <Lock className="w-12 h-12 text-primary" />
        <div className="absolute -inset-2 rounded-full bg-primary/20 animate-pulse" />
      </div>
    </div>
  );
}

function UploadingAnimation() {
  return (
    <div className="flex items-center justify-center gap-6">
      {/* Lock icon */}
      <div className="relative">
        <Lock className="w-10 h-10 text-green-500" />
        <CheckCircle className="w-4 h-4 text-green-500 absolute -top-1 -right-1" />
      </div>

      {/* Arrow/flow indicator */}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-flow"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>

      {/* Cloud icon */}
      <div className="relative animate-float">
        <Cloud className="w-12 h-12 text-primary" />
        <div className="absolute -inset-2 rounded-full bg-primary/10 animate-pulse" />
      </div>
    </div>
  );
}

function CompleteAnimation() {
  return (
    <div className="relative">
      {/* Success circle */}
      <div className="relative z-10 animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
          <Shield className="w-10 h-10 text-green-500" />
        </div>
      </div>

      {/* Checkmark overlay */}
      <div className="absolute top-0 right-0 animate-bounce-in" style={{ animationDelay: '0.3s' }}>
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Celebration particles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-green-500/60 animate-confetti"
            style={{
              animationDelay: `${i * 0.1}s`,
              transform: `rotate(${i * 45}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default EncryptionPreview;
