import { Lock } from "lucide-react";
import { formatSize } from "../../utils/format";
import type { CryptoEvent } from "../../utils/crypto";

interface EncryptionProofProps {
  event: CryptoEvent | null;
}

export function EncryptionProof({ event }: EncryptionProofProps) {
  if (!event) return null;

  return (
    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-lg p-4 font-mono text-xs space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden group">
      {/* Liquid glass shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-emerald-400 animate-pulse" />
        <span className="text-emerald-400 font-semibold uppercase tracking-wider">Zero-Knowledge Encryption</span>
      </div>

      <div className="text-zinc-300">
        {event.type === "generating-key" && (
          <div>Generating {event.algorithm} ({event.keyLength} bits) key...</div>
        )}
        
        {event.type === "encrypting" && (
          <div className="animate-pulse">Encrypting {formatSize(event.inputSize)}...</div>
        )}

        {event.type === "encrypted" && (
          <div className="space-y-1">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-500">Input:</span>
              <span>{formatSize(event.inputSize)} (Plaintext)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-500">Output:</span>
              <span>{formatSize(event.outputSize)} (+16B auth tag)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-500">Performance:</span>
              <span className="text-emerald-400">⚡ {event.durationMs.toFixed(0)}ms</span>
            </div>
            <div className="text-xs text-zinc-500 mt-2 italic border-l-2 border-emerald-500/30 pl-2">
              Server will receive ONLY ciphertext. The plaintext never leaves this device.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
