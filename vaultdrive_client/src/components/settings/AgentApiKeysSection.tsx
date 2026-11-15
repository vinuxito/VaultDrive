import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Copy, FolderLock, GlobeLock, Gauge, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { API_URL } from "../../utils/api";
import { relativeTime } from "../../utils/format";
import { branding } from "../../config/branding";

interface AgentKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  key_kind?: "standard" | "delete_only";
  scopes: string[];
  status: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked_at?: string;
  created_by_ip?: string;
  last_used_ip?: string;
  last_used_user_agent?: string;
  notes?: string;
  usage_count: number;
  plaintext_key?: string;
  allowed_folder_ids?: string[];
  allowed_ips?: string[];
  rate_limit_rpm?: number;
}

interface FolderOption {
  id: string;
  name: string;
  parentId?: string | null;
}

function buildFolderLabelMap(folders: FolderOption[]): Record<string, string> {
  const byId = new Map<string, FolderOption>();
  for (const f of folders) {
    byId.set(f.id, f);
  }
  const labels: Record<string, string> = {};
  for (const f of folders) {
    const parts: string[] = [f.name];
    let cur = f.parentId ? byId.get(f.parentId) : undefined;
    let depth = 0;
    while (cur && depth < 6) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      depth += 1;
    }
    labels[f.id] = parts.join(" → ");
  }
  return labels;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
}

const scopeLabels: Record<string, string> = {
  "files:list": "Ver lista de archivos",
  "files:read_metadata": "Ver detalles de archivos",
  "files:upload_ciphertext": "Subir archivos cifrados",
  "files:download_ciphertext": "Descargar archivos cifrados",
  "files:write": "Mover, renombrar y organizar archivos",
  "files:soft_delete": "Solo mover a Papelera recuperable",
  "folders:read": "Ver carpetas",
  "folders:write": "Crear y organizar carpetas",
  "shares:create": "Crear enlaces compartidos",
  "shares:list": "Ver enlaces compartidos",
  "shares:revoke": "Revocar enlaces compartidos",
  "requests:create": "Crear enlaces para recibir archivos",
  "requests:list": "Ver enlaces para recibir archivos",
  "requests:revoke": "Desactivar enlaces para recibir archivos",
  "activity:read": "Leer historial de actividad",
  "trust:read": "Ver estado de seguridad",
  "api_keys:read": "Ver llaves de automatización",
  "api_keys:write": "Crear o revocar llaves normales",
};

const scopeCategories = [
  {
    label: "Archivos",
    description: "Leer, subir o acomodar archivos cifrados (jamás borrar)",
    scopes: [
      "files:list",
      "files:read_metadata",
      "files:upload_ciphertext",
      "files:download_ciphertext",
      "files:write",
    ],
  },
  {
    label: "Carpetas",
    description: "Navegar y ordenar la bóveda",
    scopes: ["folders:read", "folders:write"],
  },
  {
    label: "Enlaces compartidos",
    description: "Administrar enlaces públicos de salida",
    scopes: ["shares:create", "shares:list", "shares:revoke"],
  },
  {
    label: "Buzones de entrega (Drop)",
    description: "Administrar enlaces para recibir documentos",
    scopes: ["requests:create", "requests:list", "requests:revoke"],
  },
  {
    label: "Auditoría y seguridad",
    description: "Consultar actividad y estado de bóveda",
    scopes: ["activity:read", "trust:read"],
  },
  {
    label: "Llaves hijas",
    description: "Crear o revocar llaves normales (nunca llaves Solo Papelera)",
    scopes: ["api_keys:read", "api_keys:write"],
  },
];

interface ScopeTemplate {
  id: string;
  label: string;
  description: string;
  scopes: string[];
}

const scopeTemplates: ScopeTemplate[] = [
  {
    id: "read-only",
    label: "Solo lectura",
    description: "Ver archivos, detalles y bitácora. No modifica ni borra nada.",
    scopes: ["files:list", "files:read_metadata", "trust:read", "activity:read"],
  },
  {
    id: "reconciliation",
    label: "Contabilidad / Conciliación",
    description: "Lista, descarga archivos cifrados y revisa bitácora sin borrar.",
    scopes: ["files:list", "files:read_metadata", "files:download_ciphertext", "folders:read", "activity:read", "trust:read"],
  },
  {
    id: "upload",
    label: "Subida automática",
    description: "Sube archivos cifrados y ordena en carpetas. Sin descargas ni borrado.",
    scopes: ["files:upload_ciphertext", "files:write", "folders:read", "folders:write"],
  },
  {
    id: "share-manager",
    label: "Gestor de entregas y enlaces",
    description: "Crea y revoca enlaces compartidos o buzones Drop para clientes.",
    scopes: ["files:list", "files:read_metadata", "shares:create", "shares:list", "shares:revoke", "requests:create", "requests:list", "requests:revoke"],
  },
  {
    id: "full-ciphertext",
    label: "Operación completa (sin borrar)",
    description: "Todo archivo, carpeta, enlace y auditoría. Nunca puede eliminar archivos.",
    scopes: [
      "files:list", "files:read_metadata", "files:upload_ciphertext", "files:download_ciphertext", "files:write",
      "folders:read", "folders:write",
      "shares:create", "shares:list", "shares:revoke",
      "requests:create", "requests:list", "requests:revoke",
      "activity:read", "trust:read",
    ],
  },
];

const DEFAULT_SELECTED_SCOPES = [
  "files:list",
  "files:read_metadata",
  "activity:read",
  "trust:read",
];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function CreateKeyModal({
  open,
  onClose,
  onCreated,
  returnFocusRef,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: AgentKeyRecord) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  folders: FolderOption[];
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [keyKind, setKeyKind] = useState<"standard" | "delete_only">("standard");
  const [expiryDays, setExpiryDays] = useState("30");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_SELECTED_SCOPES);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [allowedIpsInput, setAllowedIpsInput] = useState("");
  const [rateLimitRpm, setRateLimitRpm] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<AgentKeyRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmedCopy, setConfirmedCopy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const folderLabelMap = useMemo(() => buildFolderLabelMap(folders), [folders]);

  const resetModalState = useCallback(() => {
    setName("");
    setNotes("");
    setKeyKind("standard");
    setExpiryDays("30");
    setSelectedScopes(DEFAULT_SELECTED_SCOPES);
    setSelectedFolderIds([]);
    setAllowedIpsInput("");
    setRateLimitRpm("60");
    setLoading(false);
    setError("");
    setCreated(null);
    setCopied(false);
    setConfirmedCopy(false);
  }, []);

  const expiryIso = useMemo(() => {
    if (expiryDays === "never") return "";
    return new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString();
  }, [expiryDays]);

  const handleClose = useCallback(() => {
    if (created && !confirmedCopy) return;
    resetModalState();
    onClose();
    window.setTimeout(() => {
      returnFocusRef.current?.focus();
    }, 0);
  }, [confirmedCopy, created, onClose, resetModalState, returnFocusRef]);

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [] as HTMLElement[];

    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.hasAttribute("disabled")
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    const frameId = window.requestAnimationFrame(() => {
      const [firstFocusable] = getFocusableElements();
      const focusFallback = () => {
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          modalRef.current?.focus();
        }
      };
      focusFallback();
      if (created) {
        return;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [created, getFocusableElements, open]);

  useEffect(() => {
    if (!copied) return;

    const timeoutId = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleModalKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!created) {
          handleClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstFocusable || activeElement === modalRef.current) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    },
    [created, getFocusableElements, handleClose]
  );

  if (!open) return null;

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]
    );
  };

  const toggleFolder = (folderId: string) => {
    setSelectedFolderIds((current) =>
      current.includes(folderId) ? current.filter((item) => item !== folderId) : [...current, folderId]
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const effectiveScopes = keyKind === "delete_only" ? ["files:soft_delete"] : selectedScopes;
      const parsedIPs = allowedIpsInput
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedRpm = Math.max(1, Math.min(6000, Number(rateLimitRpm) || 60));
      const payloadBody: Record<string, unknown> = {
        name,
        notes,
        key_kind: keyKind,
        scopes: effectiveScopes,
        expires_at: expiryIso,
        rate_limit_rpm: parsedRpm,
      };
      if (selectedFolderIds.length > 0) {
        payloadBody.allowed_folder_ids = selectedFolderIds;
      }
      if (parsedIPs.length > 0) {
        payloadBody.allowed_ips = parsedIPs;
      }
      const response = await fetch(`${API_URL}/v1/agent-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadBody),
      });
      const payload = (await response.json().catch(() => null)) as Envelope<AgentKeyRecord> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message || "No se pudo crear la llave.");
      }
      setCopied(false);
      setConfirmedCopy(false);
      setCreated(payload.data);
      onCreated(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la llave.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-agent-key-title"
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
        className="w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-muted/50 to-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-agent-key-title" className="text-lg font-semibold text-foreground">Crear llave para automatización o agente</h3>
              <p className="text-sm text-muted-foreground">Permisos acotados y revocables al instante. Nunca expone contraseñas ni llaves privadas.</p>
            </div>
          </div>
        </div>

        {created ? (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="brand-receipt-surface rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <ShieldCheck className="w-4 h-4" />
                {created.key_kind === "delete_only"
                  ? "Llave especial Solo Papelera lista — guárdala ahora"
                  : "Llave lista — guárdala ahora"}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {`Es la única vez que ${branding.productName} te mostrará la llave completa. Al cerrar esta ventana solo verás el prefijo (${created.key_prefix}).`}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Llave secreta de una sola vista</p>
              <code className="block break-all rounded-xl bg-card px-3 py-3 text-sm text-foreground border border-border">
                {created.plaintext_key}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(created.plaintext_key || "");
                  setCopied(true);
                }}
                className="inline-flex items-center gap-2 text-sm text-foreground hover:text-foreground/90"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copiada" : "Copiar llave"}
              </button>
              <span className="sr-only" aria-live="polite">
                {copied ? "Llave copiada al portapapeles" : ""}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border px-4 py-3 bg-card">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prefijo visible</p>
                <p className="mt-1 font-medium text-foreground">{created.key_prefix}</p>
              </div>
              <div className="rounded-2xl border border-border px-4 py-3 bg-card">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vigencia</p>
                <p className="mt-1 font-medium text-foreground">
                  {created.expires_at ? new Date(created.expires_at).toLocaleString() : "Sin caducidad automática"}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/60 px-4 py-3 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedCopy}
                onChange={(event) => setConfirmedCopy(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary shrink-0"
              />
              <span>
                <span className="font-medium">Ya guardé esta llave en un lugar seguro</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Confirma antes de cerrar, porque no se volverá a mostrar completa.
                </span>
              </span>
            </label>

            <div className="flex justify-end">
              <Button
                onClick={handleClose}
                disabled={!confirmedCopy}
                className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:cursor-not-allowed"
              >
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Tipo de llave</p>
              <div className="grid gap-2.5 md:grid-cols-2">
                <button
                  type="button"
                  data-testid="key-kind-standard"
                  onClick={() => setKeyKind("standard")}
                  className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                    keyKind === "standard"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-semibold">Llave normal de automatización</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Para subir, listar, organizar o compartir. Nunca borra ni manda nada a la Papelera.
                  </p>
                </button>
                <button
                  type="button"
                  data-testid="key-kind-delete-only"
                  onClick={() => setKeyKind("delete_only")}
                  className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                    keyKind === "delete_only"
                      ? "border-amber-500 bg-amber-500/10 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-semibold">Llave especial Solo Papelera (100% recuperable)</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prefijo <code>abrnak_del_</code>. Solo envía archivos o carpetas a tu Papelera. Solo tú restauras o purgas.
                  </p>
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="agent-key-name" className="text-sm font-medium text-foreground">Nombre de la llave</label>
                <input
                  id="agent-key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={64}
                  placeholder={keyKind === "delete_only" ? "Ej. Robot de limpieza mensual" : "Ej. Subida automática de facturas"}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {name.length > 50 && (
                  <p className="text-xs text-muted-foreground text-right">{name.length}/64</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="agent-key-expiry" className="text-sm font-medium text-foreground">Vigencia</label>
                <select
                  id="agent-key-expiry"
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(event.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="7">7 días</option>
                  <option value="30">30 días</option>
                  <option value="90">90 días</option>
                  <option value="never">Sin caducidad</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="agent-key-notes" className="text-sm font-medium text-foreground">Para qué se usará</label>
              <textarea
                id="agent-key-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej. Mandar CFDIs duplicados a Papelera con motivo de auditoría"
                rows={2}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {keyKind === "delete_only" ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">Alcance único fijo: Solo mover a Papelera</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Esta llave especial (<code>abrnak_del_</code>) no puede leer archivos, ni descargar, ni compartir, ni crear otras llaves, ni borrar nada de forma permanente. Todo lo que marque queda en tu Papelera para que tú decidas desde la app.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Permisos</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Empieza con lo mínimo necesario. Estas llaves jamás pueden borrar ni desencriptar en secreto.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">Plantillas rápidas</p>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {scopeTemplates.map((tmpl) => {
                      const isActive = tmpl.scopes.length === selectedScopes.length &&
                        tmpl.scopes.every((s) => selectedScopes.includes(s));
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => setSelectedScopes([...tmpl.scopes])}
                          className={`text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "border-primary bg-muted text-foreground"
                              : "border-border bg-card text-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="font-medium">{tmpl.label}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{tmpl.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {scopeCategories.map((category) => (
                  <div key={category.label} className="space-y-1.5">
                    <div className="flex items-baseline gap-2">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">{category.label}</p>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                    <div className="grid gap-1.5 md:grid-cols-2">
                      {category.scopes.map((scope) => (
                        <label
                          key={scope}
                          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-muted transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope)}
                            onChange={() => toggleScope(scope)}
                            className="h-4 w-4 accent-primary shrink-0"
                          />
                          <span className="flex-1">{scopeLabels[scope] ?? scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Límites de seguridad (opcional)</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Encierra esta llave en carpetas puntuales, redes IP fijas o un tope de velocidad.
                  </p>
                </div>
                <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {selectedFolderIds.length > 0 ? "Carpeta limitada" : "Toda tu bóveda"}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">
                  Limitar a carpetas específicas
                </p>
                {folders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin carpetas creadas todavía (la llave aplicará a toda la bóveda).
                  </p>
                ) : (
                  <div className="grid gap-1.5 md:grid-cols-2 max-h-40 overflow-y-auto pr-1">
                    {folders.map((folder) => (
                      <label
                        key={folder.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground cursor-pointer hover:bg-muted transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFolderIds.includes(folder.id)}
                          onChange={() => toggleFolder(folder.id)}
                          className="h-4 w-4 accent-primary shrink-0"
                        />
                        <span className="truncate">{folderLabelMap[folder.id] ?? folder.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="agent-key-allowed-ips" className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">
                    IPs o redes permitidas (opcional)
                  </label>
                  <input
                    id="agent-key-allowed-ips"
                    value={allowedIpsInput}
                    onChange={(event) => setAllowedIpsInput(event.target.value)}
                    placeholder="Ej. 10.20.0.0/16, 198.51.100.4"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="agent-key-rpm" className="text-xs font-semibold text-foreground uppercase tracking-[0.1em]">
                    Límite por minuto (RPM)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {["30", "60", "120", "300"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRateLimitRpm(preset)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            rateLimitRpm === preset
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground hover:bg-muted"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      id="agent-key-rpm"
                      type="number"
                      min={1}
                      max={6000}
                      value={rateLimitRpm}
                      onChange={(event) => setRateLimitRpm(event.target.value)}
                      className="w-20 rounded-xl border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={loading || !name.trim() || (keyKind === "standard" && selectedScopes.length === 0)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                {keyKind === "delete_only" ? "Crear llave Solo Papelera" : "Crear llave"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentApiKeysSection() {
  const [keys, setKeys] = useState<AgentKeyRecord[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const createKeyTriggerRef = useRef<HTMLButtonElement | null>(null);

  const folderLabelMap = useMemo(() => buildFolderLabelMap(folders), [folders]);

  const fetchKeys = useCallback(async () => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/v1/agent-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => null)) as Envelope<AgentKeyRecord[]> | null;
    setKeys(payload?.data ?? []);
    setLoading(false);
  }, []);

  const fetchFolders = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${API_URL}/folders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const raw = (await response.json().catch(() => null)) as
        | Array<{ id: string; name: string; parent_id?: string | null; parentId?: string | null }>
        | { data?: Array<{ id: string; name: string; parent_id?: string | null; parentId?: string | null }> }
        | null;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setFolders(
        list.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId ?? f.parent_id ?? null,
        }))
      );
    } catch {
      // Non-fatal in offline or folderless environments.
    }
  }, []);

  useEffect(() => {
    void fetchKeys();
    void fetchFolders();
  }, [fetchFolders, fetchKeys]);

  const revokeKey = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const token = localStorage.getItem("token");
      const keyName = keys.find((entry) => entry.id === keyId)?.name ?? "Agent key";
      const response = await fetch(`${API_URL}/v1/agent-keys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Could not revoke agent key");
      }
      setError("");
      setReceipt(`Se revocó "${keyName}". Ningún agente podrá usarla de inmediato.`);
      void fetchKeys();
    } catch {
      setError("No se pudo revocar esta llave en este momento.");
    } finally {
      setRevokingId(null);
      setConfirmRevokeId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Llaves para automatización e IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Credenciales con permisos limitados para robots o scripts externos. Todo archivo sigue cifrado en tu poder.
          </p>
        </div>
        <Button
          onClick={(event) => {
            createKeyTriggerRef.current = event.currentTarget;
            setShowCreateModal(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          <KeyRound className="w-4 h-4 mr-2" />
          Nueva llave
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Tú conservas siempre el control</p>
        <p className="mt-1">
          Las llaves normales nunca pueden borrar archivos. Si quieres que un robot mande archivos vencidos a tu Papelera, crea una <strong>Llave especial Solo Papelera</strong>; solo tú puedes restaurar o borrar para siempre desde la app.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Permiso exacto</p>
          <p className="mt-2 text-foreground font-medium">Solo para lo que hace falta</p>
          <p className="mt-1 text-xs text-muted-foreground">Empieza con pocos permisos y sepáralos por tarea.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Uso visible</p>
          <p className="mt-2 text-foreground font-medium">Mira cuándo y desde dónde actuó</p>
          <p className="mt-1 text-xs text-muted-foreground">Cada llave registra última IP, agente y conteo de llamadas.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Freno inmediato</p>
          <p className="mt-2 text-foreground font-medium">Quítala en un clic</p>
          <p className="mt-1 text-xs text-muted-foreground">Si un robot ya no te sirve, revocas la llave al instante.</p>
        </div>
      </div>

      {receipt && (
        <div className="brand-receipt-surface rounded-2xl px-4 py-4 text-sm text-foreground">
          <p className="font-medium">Listo y bajo control.</p>
          <p className="mt-1 text-foreground">{receipt}</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-medium">No se pudo completar la acción.</p>
          <p className="mt-1 text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Cargando llaves…
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {`Todavía no creas llaves automáticas. Crea una cuando necesites conectar scripts o IA con ${branding.productName}.`}
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => {
            const isRevoked = key.status === "revoked";
            const isExpired = key.status === "expired";
            const isDeleteOnly = key.key_kind === "delete_only" || key.scopes.includes("files:soft_delete");

            return (
              <div
                key={key.id}
                className={`rounded-[1.5rem] border border-border bg-card px-4 py-4 space-y-3 shadow-sm ${
                  isRevoked ? "opacity-60" : isExpired ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`font-medium ${
                          isRevoked
                            ? "text-muted-foreground line-through"
                            : isExpired
                              ? "text-muted-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {key.name}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          key.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : key.status === "revoked"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {key.status}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                          isDeleteOnly
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {isDeleteOnly ? "Solo Papelera · 100% recuperable" : "Estándar · Nunca borra"}
                      </span>
                      <code className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{key.key_prefix}</code>
                      {(key.allowed_folder_ids?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-medium">
                          <FolderLock className="w-3.5 h-3.5" />
                          {`Carpeta limitada · ${key.allowed_folder_ids!.length}`}
                        </span>
                      )}
                      {(key.allowed_ips?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 px-2.5 py-1 text-xs font-medium">
                          <GlobeLock className="w-3.5 h-3.5" />
                          {`IP fija · ${key.allowed_ips!.length}`}
                        </span>
                      )}
                      {typeof key.rate_limit_rpm === "number" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-1 text-xs">
                          <Gauge className="w-3.5 h-3.5" />
                          {`${key.rate_limit_rpm} req/min`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Creada el {new Date(key.created_at).toLocaleString()}</p>
                  </div>

                  {key.status === "active" && (
                    confirmRevokeId === key.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmRevokeId(null)}
                          className="text-muted-foreground border-border"
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void revokeKey(key.id)}
                          disabled={revokingId === key.id}
                          className="text-destructive border-destructive/20 hover:bg-destructive/10"
                        >
                          {revokingId === key.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar revocación"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setConfirmRevokeId(key.id)}
                        className="text-destructive border-destructive/20 hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Revocar
                      </Button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {key.scopes.map((scope) => (
                    <span key={scope} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {scopeLabels[scope] ?? scope}
                    </span>
                  ))}
                </div>

                <div className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Qué puede hacer esta llave</p>
                  <p className="mt-1 leading-relaxed">
                    {isDeleteOnly
                      ? "Solo puede enviar archivos o carpetas a tu Papelera recuperable. No puede descargar ni borrar de forma definitiva."
                      : `Opera dentro de ${key.scopes.length} permiso${key.scopes.length !== 1 ? "s" : ""} autorizado${key.scopes.length !== 1 ? "s" : ""}. Nunca puede borrar archivos ni desencriptarlos sin tu llave.`}
                    {(key.allowed_folder_ids?.length ?? 0) > 0
                      ? ` Solo ve: ${key.allowed_folder_ids!.map((id) => folderLabelMap[id] ?? id.slice(0, 8)).join(", ")}.`
                      : " Puede ver toda tu bóveda según sus permisos."}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                  <div className="rounded-xl bg-muted px-3 py-3 border border-border">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Último uso</p>
                    <p className="mt-1 text-foreground font-medium">
                      {key.last_used_at ? relativeTime(key.last_used_at) : "Sin usar aún"}
                    </p>
                    {key.last_used_at && (
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(key.last_used_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-muted px-3 py-3 border border-border">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Última IP</p>
                    <p className="mt-1 text-foreground font-medium">{key.last_used_ip || "Sin peticiones aún"}</p>
                  </div>
                  <div className="rounded-xl bg-muted px-3 py-3 border border-border">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Llamadas</p>
                    <p className="mt-1 text-foreground font-medium">{key.usage_count}</p>
                  </div>
                </div>

                {key.last_used_user_agent && (
                  <p className="text-xs text-muted-foreground truncate">Último agente: {key.last_used_user_agent}</p>
                )}
              </div>
            )})}
        </div>
      )}

      <CreateKeyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        returnFocusRef={createKeyTriggerRef}
        folders={folders}
        onCreated={(record) => {
          setError("");
          setReceipt(`${record.name} quedó lista. Guarda el secreto de una sola vista ahora.`);
          setKeys((current) => [record, ...current]);
        }}
      />
    </div>
  );
}
