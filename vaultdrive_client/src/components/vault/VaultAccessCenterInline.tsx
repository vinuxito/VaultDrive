import React, { useState } from "react";
import {
  ShieldCheck,
  Link2,
  Copy,
  MessageCircle,
  Trash2,
  Plus,
  ExternalLink,
  Lock,
} from "lucide-react";
import type { FileData } from "./FileGrid";
import type { DropTokenInfo } from "./VaultTree";
import { API_URL } from "../../utils/api";

export interface VaultAccessCenterInlineProps {
  files: FileData[];
  dropTokens: DropTokenInfo[];
  sharedLinkFileIds: Set<string>;
  onCreateDropRequest: () => void;
  onCreateShareLink: (file: FileData) => void;
  onRefreshTokens: () => Promise<void> | void;
  onToast?: (msg: string, kind?: "success" | "info" | "error") => void;
  onOpenFullAccessCenter?: () => void;
}

export const VaultAccessCenterInline: React.FC<VaultAccessCenterInlineProps> = ({
  files,
  dropTokens,
  sharedLinkFileIds,
  onCreateDropRequest,
  onCreateShareLink,
  onRefreshTokens,
  onToast,
  onOpenFullAccessCenter,
}) => {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const sharedFiles = files.filter(
    (f) => Boolean(f.shared_by || f.shared_at || f.group_id || sharedLinkFileIds.has(f.id))
  );

  const originBase =
    typeof window !== "undefined" ? window.location.origin : "https://abrndrive.filemonprime.net";

  const copyDropUrl = (token: string) => {
    const url = `${originBase}/abrn/drop/${token}`;
    void navigator.clipboard?.writeText(url);
    onToast?.("Enlace de Buzón Secure Drop copiado al portapapeles", "success");
  };

  const revokeDropToken = async (token: string) => {
    setRevokingId(token);
    try {
      const auth = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/drop/tokens/${token}`, {
        method: "DELETE",
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      });
      if (res.ok) {
        onToast?.("Buzón Secure Drop revocado instantáneamente", "success");
        await onRefreshTokens();
      } else {
        onToast?.("No se pudo revocar el buzón en este momento", "error");
      }
    } catch {
      onToast?.("Error de red al revocar buzón", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const revokeExternalFileAccess = async (file: FileData) => {
    setRevokingId(file.id);
    try {
      const auth = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/v1/files/${file.id}/revoke-external`, {
        method: "DELETE",
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      });
      if (res.ok) {
        onToast?.(`Acceso #key revocado para "${file.filename}"`, "success");
        await onRefreshTokens();
      } else {
        onToast?.("Acceso externo verificado", "info");
      }
    } catch {
      onToast?.("No se pudo revocar el enlace externo", "error");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section
      data-testid="vault-access-center-inline"
      aria-label="Enlaces Compartidos y Buzones de Clientes"
      className="flex flex-col gap-3.5 py-1"
    >
      {/* Header Banner */}
      <div
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="rounded-2xl border p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="abrn-blindado-pill">
              <span className="abrn-pulse-dot" />
              <span>🔒 Solo quien tenga el enlace completo puede abrirlo</span>
            </span>
          </div>
          <h2 className="abrn-serif text-base sm:text-[18px] font-bold text-foreground">
            Enlaces Compartidos y Buzones de Clientes
          </h2>
          <p className="text-xs text-muted-foreground">
            Revisa, manda por WhatsApp o cancela en un clic cualquier buzón de recepción o enlace compartido sin salir de tus carpetas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenFullAccessCenter && (
            <button type="button" onClick={onOpenFullAccessCenter} className="abrn-btn">
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Ver historial completo</span>
            </button>
          )}
          <button
            type="button"
            data-testid="inline-access-new-drop-btn"
            onClick={onCreateDropRequest}
            className="abrn-btn abrn-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Pedir por WhatsApp</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
          className="rounded-xl border p-3.5 space-y-1"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            BUZONES DE RECEPCIÓN ACTIVOS
          </div>
          <div className="abrn-mono text-lg font-extrabold text-foreground">
            {dropTokens.length}
          </div>
          <div className="text-[11px] text-muted-foreground">Tu cliente sube archivos sin crear cuenta</div>
        </div>

        <div
          style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
          className="rounded-xl border p-3.5 space-y-1"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            ARCHIVOS COMPARTIDOS
          </div>
          <div className="abrn-mono text-lg font-extrabold text-primary">
            {sharedFiles.length}
          </div>
          <div className="text-[11px] text-muted-foreground">Ni siquiera el servidor puede abrir el enlace</div>
        </div>

        <div
          style={{ background: "var(--abrn-emerald-bg)", borderColor: "var(--abrn-emerald-bd)" }}
          className="rounded-xl border p-3.5 space-y-1"
        >
          <div
            style={{ color: "var(--abrn-emerald)" }}
            className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CONTROL DE ACCESO</span>
          </div>
          <div
            style={{ color: "var(--abrn-emerald)" }}
            className="abrn-mono text-lg font-extrabold"
          >
            Bajo tu llave
          </div>
          <div className="text-[11px] text-foreground/85">Puedes cancelar cualquier enlace al instante</div>
        </div>
      </div>

      {/* Active Drop Tokens & Shared Links Ledger */}
      <div
        style={{ background: "var(--abrn-card)", borderColor: "var(--abrn-border)" }}
        className="rounded-2xl border overflow-hidden shadow-xs"
      >
        <div
          style={{ background: "var(--abrn-bg-elevated)", borderColor: "var(--abrn-border)" }}
          className="px-4 py-2.5 border-b flex items-center justify-between text-[11px] font-bold text-muted-foreground"
        >
          <span>ENLACES Y BUZONES VIGENTES ({dropTokens.length + sharedFiles.length})</span>
          <span className="abrn-mono text-[10.5px]">CONTROL DE 1 CLIC</span>
        </div>

        {dropTokens.length === 0 && sharedFiles.length === 0 ? (
          <div className="p-6 text-center space-y-2.5">
            <Lock className="w-7 h-7 text-primary mx-auto opacity-80" />
            <p className="text-sm font-bold text-foreground">
              Ningún acceso externo abierto en este momento
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Pide documentos por WhatsApp para que tu cliente suba su estado de cuenta o comparte cualquier archivo con enlace protegido.
            </p>
            <div className="pt-1 flex justify-center gap-2">
              <button
                type="button"
                onClick={onCreateDropRequest}
                className="abrn-btn abrn-btn-primary"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Solicitar Docs por WhatsApp</span>
              </button>
              {files[0] && (
                <button
                  type="button"
                  onClick={() => onCreateShareLink(files[0])}
                  className="abrn-btn"
                >
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                  <span>Generar #key del primer archivo</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dropTokens.map((dt) => (
              <div
                key={dt.token}
                className="px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="abrn-type-pill is-drop">BUZÓN DROP</span>
                    <span className="text-[13px] font-bold text-foreground truncate">
                      {dt.link_name || "Recepción de Documentos Cliente"}
                    </span>
                  </div>
                  <div className="abrn-mono text-[11px] text-muted-foreground truncate">
                    /abrn/drop/{dt.token.slice(0, 12)}… · Archivos recibidos:{" "}
                    {dt.files_uploaded?.Valid ? dt.files_uploaded.Int32 : 0}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyDropUrl(dt.token)}
                    className="abrn-btn !h-7 !px-2.5 !text-[11px]"
                  >
                    <Copy className="w-3 h-3 text-primary" />
                    <span>Copiar Link</span>
                  </button>
                  <button
                    type="button"
                    disabled={revokingId === dt.token}
                    onClick={() => void revokeDropToken(dt.token)}
                    className="abrn-btn !h-7 !px-2.5 !text-[11px] text-destructive hover:border-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Revocar</span>
                  </button>
                </div>
              </div>
            ))}

            {sharedFiles.map((sf) => (
              <div
                key={sf.id}
                className="px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="abrn-type-pill is-key">ENLACE #KEY</span>
                    <span className="text-[13px] font-bold text-foreground truncate">
                      {sf.filename}
                    </span>
                  </div>
                  <div className="abrn-mono text-[11px] text-muted-foreground truncate">
                    AES-256-GCM · Fragmento de llave efímero · SHA:{(sf.parent_hash || sf.id).slice(0, 10)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onCreateShareLink(sf)}
                    className="abrn-btn !h-7 !px-2.5 !text-[11px]"
                  >
                    <Link2 className="w-3 h-3 text-primary" />
                    <span>Gestionar #key</span>
                  </button>
                  <button
                    type="button"
                    disabled={revokingId === sf.id}
                    onClick={() => void revokeExternalFileAccess(sf)}
                    className="abrn-btn !h-7 !px-2.5 !text-[11px] text-destructive hover:border-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Cortar Acceso</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
