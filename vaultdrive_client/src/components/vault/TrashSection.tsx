import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  FileText,
  Folder as FolderIcon,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { API_URL } from "../../utils/api";
import { formatBytes, relativeTime } from "../../utils/format";
import { Button } from "../ui/button";

export interface TrashFileEntry {
  id: string;
  filename: string;
  file_size: number;
  folder_id?: string | null;
  deleted_at?: string;
  deleted_by_actor_type?: string;
  deleted_by_key_id?: string;
  deleted_by_key_name?: string;
  deleted_by_key_prefix?: string;
  deleted_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface TrashFolderEntry {
  id: string;
  name: string;
  parent_id?: string | null;
  deleted_at?: string;
  deleted_by_actor_type?: string;
  deleted_by_key_id?: string;
  deleted_by_key_name?: string;
  deleted_by_key_prefix?: string;
  deleted_reason?: string;
  created_at: string;
}

interface TrashResponse {
  files?: TrashFileEntry[];
  folders?: TrashFolderEntry[];
}

interface TrashSectionProps {
  onRestored?: () => void;
  onCountChange?: (count: number) => void;
}

export function TrashSection({ onRestored, onCountChange }: TrashSectionProps) {
  const [files, setFiles] = useState<TrashFileEntry[]>([]);
  const [folders, setFolders] = useState<TrashFolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmPurgeKey, setConfirmPurgeKey] = useState<string | null>(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/trash`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404 || res.status === 501) {
        setUnavailable(true);
        setFiles([]);
        setFolders([]);
        onCountChange?.(0);
        return;
      }
      if (!res.ok) {
        throw new Error("No se pudo abrir la Papelera.");
      }
      const data = (await res.json()) as TrashResponse;
      const nextFiles = Array.isArray(data.files) ? data.files : [];
      const nextFolders = Array.isArray(data.folders) ? data.folders : [];
      setUnavailable(false);
      setFiles(nextFiles);
      setFolders(nextFolders);
      onCountChange?.(nextFiles.length + nextFolders.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la Papelera.");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  const handleRestore = async (kind: "files" | "folders", id: string, label: string) => {
    const busyId = `restore:${kind}:${id}`;
    setBusyKey(busyId);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/trash/${kind}/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`No se pudo restaurar "${label}".`);
      }
      setReceipt(`"${label}" volvió a tu bóveda tal como estaba.`);
      setConfirmPurgeKey(null);
      await loadTrash();
      onRestored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo restaurar "${label}".`);
    } finally {
      setBusyKey(null);
    }
  };

  const handlePurge = async (kind: "files" | "folders", id: string, label: string) => {
    const busyId = `purge:${kind}:${id}`;
    setBusyKey(busyId);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/trash/${kind}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`No se pudo eliminar para siempre "${label}".`);
      }
      setReceipt(`"${label}" se borró para siempre del servidor.`);
      setConfirmPurgeKey(null);
      await loadTrash();
      onRestored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo eliminar para siempre "${label}".`);
    } finally {
      setBusyKey(null);
    }
  };

  const renderAttribution = (
    actorType?: string,
    keyName?: string,
    keyPrefix?: string,
    reason?: string
  ) => (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
      {actorType === "agent_delete_key" ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 font-medium">
          <Bot className="w-3 h-3" />
          Llave Solo Papelera{keyName ? `: ${keyName}` : ""}
          {keyPrefix ? <code className="ml-1 opacity-80">{keyPrefix}</code> : null}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5">
          Eliminado desde la app
        </span>
      )}
      {reason ? (
        <span className="text-muted-foreground">
          Motivo: <strong className="font-medium text-foreground">{reason}</strong>
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5" data-testid="trash-section">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-primary" />
            Papelera recuperable
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Nada se pierde sin tu permiso. Las llaves automáticas nunca pueden borrar de forma definitiva.
          </p>
        </div>
        <span
          style={{
            background: "var(--abrn-emerald-bg)",
            color: "var(--abrn-emerald)",
            borderColor: "var(--abrn-emerald-bd)",
          }}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shrink-0 self-start sm:self-center"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Solo tú restauras o borras para siempre
        </span>
      </div>

      {receipt && (
        <div className="brand-receipt-surface rounded-2xl px-4 py-3 text-sm text-foreground">
          {receipt}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando Papelera…
        </div>
      ) : unavailable ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          La Papelera recuperable se activará cuando este servidor esté corriendo la versión nueva de bóveda. Tus archivos activos no han sufrido cambios.
        </div>
      ) : files.length === 0 && folders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Tu Papelera está limpia. Cualquier archivo o carpeta que quites de la bóveda aparecerá aquí primero para que puedas recuperarlo cuando quieras.
        </div>
      ) : (
        <div className="space-y-6">
          {folders.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Carpetas en Papelera ({folders.length})
              </h3>
              <div className="space-y-2.5">
                {folders.map((folder) => {
                  const purgeKey = `folders:${folder.id}`;
                  const isConfirming = confirmPurgeKey === purgeKey;
                  const restoring = busyKey === `restore:${purgeKey}`;
                  const purging = busyKey === `purge:${purgeKey}`;

                  return (
                    <div
                      key={folder.id}
                      data-testid={`trash-folder-${folder.id}`}
                      className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderIcon className="w-4 h-4 text-primary shrink-0" />
                          <p className="font-semibold text-foreground truncate">{folder.name}</p>
                          {folder.deleted_at && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              · {relativeTime(folder.deleted_at)}
                            </span>
                          )}
                        </div>
                        {renderAttribution(
                          folder.deleted_by_actor_type,
                          folder.deleted_by_key_name,
                          folder.deleted_by_key_prefix,
                          folder.deleted_reason
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoring || purging}
                          onClick={() => void handleRestore("folders", folder.id, folder.name)}
                        >
                          {restoring ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Restaurar carpeta
                        </Button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={purging}
                              onClick={() => setConfirmPurgeKey(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={purging}
                              onClick={() => void handlePurge("folders", folder.id, folder.name)}
                            >
                              {purging ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                              Confirmar borrado definitivo
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoring || purging}
                            onClick={() => setConfirmPurgeKey(purgeKey)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                            Eliminar para siempre
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Archivos en Papelera ({files.length})
              </h3>
              <div className="space-y-2.5">
                {files.map((file) => {
                  const purgeKey = `files:${file.id}`;
                  const isConfirming = confirmPurgeKey === purgeKey;
                  const restoring = busyKey === `restore:${purgeKey}`;
                  const purging = busyKey === `purge:${purgeKey}`;

                  return (
                    <div
                      key={file.id}
                      data-testid={`trash-file-${file.id}`}
                      className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <p className="font-semibold text-foreground truncate">{file.filename}</p>
                          <span className="text-xs text-muted-foreground">
                            · {formatBytes(file.file_size)}
                          </span>
                          {file.deleted_at && (
                            <span className="text-xs text-muted-foreground">
                              · {relativeTime(file.deleted_at)}
                            </span>
                          )}
                        </div>
                        {renderAttribution(
                          file.deleted_by_actor_type,
                          file.deleted_by_key_name,
                          file.deleted_by_key_prefix,
                          file.deleted_reason
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoring || purging}
                          onClick={() => void handleRestore("files", file.id, file.filename)}
                        >
                          {restoring ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Restaurar
                        </Button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={purging}
                              onClick={() => setConfirmPurgeKey(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={purging}
                              onClick={() => void handlePurge("files", file.id, file.filename)}
                            >
                              {purging ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                              Confirmar borrado definitivo
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoring || purging}
                            onClick={() => setConfirmPurgeKey(purgeKey)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                            Eliminar para siempre
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
