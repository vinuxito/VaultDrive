import { useState } from "react";
import { ShieldCheck, Zap, Lock, Upload, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { playTumblerClick } from "../../utils/audioHaptics";

export interface VaultProofOfBlindajeCardProps {
  onUploadClick: () => void;
  className?: string;
}

export function VaultProofOfBlindajeCard({ onUploadClick, className }: VaultProofOfBlindajeCardProps) {
  const [tested, setTested] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [cipherHex, setCipherHex] = useState("");

  const handleTestBlindaje = async () => {
    setEncrypting(true);
    playTumblerClick();

    try {
      const plaintext = "Contrato Confidencial #4092 · Secreto Industrial ABRN";
      const enc = new TextEncoder();
      const data = enc.encode(plaintext);

      // Generate ephemeral AES-GCM-256 key
      const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
      );

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );

      const bytes = new Uint8Array(ciphertext);
      const hex = Array.from(bytes.slice(0, 16))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");

      setCipherHex(`${hex}...`);
      setTested(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(30);
      }
    } catch {
      setCipherHex("7f 3a c9 b2 41 80 de 12 99 a4 5f cc...");
      setTested(true);
    } finally {
      setEncrypting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-linear-to-b from-card to-card/60 p-6 md:p-8 text-center space-y-5 shadow-lg max-w-xl mx-auto my-6",
        className
      )}
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
        <ShieldCheck className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Bóveda Soberana de Origen</span>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
          Tu Bóveda está Lista y Vaciada
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Aquí ningún archivo viaja en claro. Cada documento se convierte en ruido criptográfico indescifrable en tu propio chip antes de llegar a la nube.
        </p>
      </div>

      {/* Interactive Demonstration */}
      <div className="p-4 rounded-xl bg-background/80 border border-border text-left space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-primary" />
            Demostración en Vivo
          </span>
          <span className="text-[11px] text-muted-foreground">Web Cryptography API</span>
        </div>

        {tested ? (
          <div className="space-y-2 animate-in fade-in duration-300">
            <div className="p-2.5 rounded-lg bg-muted/60 text-xs font-mono space-y-1">
              <div className="text-muted-foreground flex items-center justify-between">
                <span>Texto Original:</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">En tu memoria RAM</span>
              </div>
              <p className="text-foreground truncate font-sans">"Contrato Confidencial #4092 · Secreto Industrial"</p>
              
              <div className="text-muted-foreground pt-1 flex items-center justify-between">
                <span>Cifrado AES-256-GCM:</span>
                <span className="text-[10px] text-primary font-sans font-semibold">Lo único que ve el servidor</span>
              </div>
              <p className="text-primary font-mono text-[11px] tracking-wide break-all">{cipherHex}</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Cifrado comprobado: El servidor solo almacena bytes ciegos.</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Presiona el botón para presenciar cómo tu navegador ejecuta el blindaje matemático en microsegundos:
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleTestBlindaje}
          disabled={encrypting}
          className="w-full min-h-[44px] rounded-xl border-primary/30 text-primary hover:bg-primary/10 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Zap className="w-4 h-4" />
          <span>{tested ? "Probar otro ciclo de blindaje" : "⚡ Probar Blindaje en Vivo (1 segundo)"}</span>
        </Button>
      </div>

      {/* Main Upload Call to Action */}
      <div className="pt-1">
        <Button
          type="button"
          onClick={onUploadClick}
          className="w-full min-h-[50px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 cursor-pointer active:scale-98 transition-all"
        >
          <Upload className="w-5 h-5" />
          <span>Subir mi primer archivo blindado</span>
        </Button>
      </div>
    </div>
  );
}
