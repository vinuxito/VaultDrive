import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Eye,
  Share2,
  Download,
  ShieldCheck,
  Folder,
  Sparkles,
  Copy,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { VaultSearchIndex, type SearchMatch } from "../../utils/vault-search-index";
import { formatBytes } from "../../utils/format";
import { playTumblerClick } from "../../utils/audioHaptics";
import { cn } from "../../lib/utils";

export interface VaultOmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (fileId: string, action?: "preview" | "share" | "download" | "copy") => void;
  searchIndex: VaultSearchIndex;
}

function getFileIcon(filename: string, mime?: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-5 h-5 text-rose-500" />;
  if (ext === "xml" || ext === "json" || ext === "html") return <FileCode className="w-5 h-5 text-amber-500" />;
  if (ext === "csv" || ext === "xlsx" || ext === "xls") return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
    return <ImageIcon className="w-5 h-5 text-blue-500" />;
  }
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[$#]+/, ""))
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return text;

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length <= 1) return text;

  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="bg-primary/25 text-foreground rounded-xs px-0.5 font-semibold">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export function VaultOmnibar({
  isOpen,
  onClose,
  onSelectFile,
  searchIndex,
}: VaultOmnibarProps) {
  const { t } = useTranslation("drive");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      playTumblerClick();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const matches = searchIndex.search(query.trim(), 20);
    setResults(matches);
    setSelectedIndex(0);
  }, [query, searchIndex]);

  useEffect(() => {
    if (results.length > 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, results.length]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }

    if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
      return;
    }

    const activeMatch = results[selectedIndex];
    if (!activeMatch) return;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSelectFile(activeMatch.doc.id, "share");
      onClose();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      onSelectFile(activeMatch.doc.id, "download");
      onClose();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      onSelectFile(activeMatch.doc.id, "copy");
      onClose();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      onSelectFile(activeMatch.doc.id, "preview");
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("omnibar.dialogLabel", "Omnibar de Bóveda Soberana")}
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-24 px-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh] ring-1 ring-border/50 animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/80 bg-muted/30">
          <Search className="w-5 h-5 text-primary shrink-0 animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("omnibar.placeholder", "Buscar por nombre, RFC, monto, cláusula o etiqueta…")}
            className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground text-sm sm:text-base focus:outline-none focus:ring-0"
          />
          {query.trim() !== "" && (
            <span
              data-testid="omnibar-match-count"
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary shrink-0"
            >
              {t("omnibar.matchCount", {
                count: results.length,
                defaultValue: results.length === 1 ? "1 coincidencia" : `${results.length} coincidencias`,
              })}
            </span>
          )}
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-border text-[11px] font-mono text-muted-foreground bg-muted/50">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {query.trim() === "" ? (
            <div className="py-10 px-4 text-center space-y-2 text-muted-foreground">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("omnibar.activeBadge", "Cerebro Ciego Activo")}</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("omnibar.ramTitle", "Búsqueda Soberana en Memoria RAM")}
              </p>
              <p className="text-xs max-w-sm mx-auto text-muted-foreground">
                {t(
                  "omnibar.ramSubtitle",
                  "Escribe cualquier palabra, monto ($), RFC o etiqueta. Tus archivos se indexan de forma 100% ciega y cifrada."
                )}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t("omnibar.noMatches", {
                  query,
                  defaultValue: `Sin coincidencias para “${query}”`,
                })}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {t(
                  "omnibar.noMatchesHint",
                  "Prueba buscando por extensión (.pdf, .xml), año (2026) o monto exacto."
                )}
              </p>
            </div>
          ) : (
            results.map((match, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={match.doc.id}
                  data-index={idx}
                  onClick={() => {
                    onSelectFile(match.doc.id, "preview");
                    onClose();
                  }}
                  className={cn(
                    "flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                    isSelected
                      ? "bg-primary/10 border-primary/40 shadow-xs"
                      : "border-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-background border border-border">
                      {getFileIcon(match.doc.filename, match.doc.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="sr-only">{match.doc.filename}</span>
                        <span
                          aria-hidden="true"
                          className="font-semibold text-sm text-foreground truncate"
                        >
                          {renderHighlightedText(match.doc.filename, query)}
                        </span>
                        {match.doc.detectedType && match.doc.detectedType !== "Documento Soberano" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium border border-primary/20">
                            <Sparkles className="w-2.5 h-2.5" />
                            {match.doc.detectedType}
                          </span>
                        )}
                        {match.doc.folderName && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border/60">
                            <Folder className="w-3 h-3" />
                            {match.doc.folderName}
                          </span>
                        )}
                      </div>

                      {/* Snippet / Match Reason */}
                      {match.snippet && (
                        <p className="text-xs text-muted-foreground mt-1 font-sans line-clamp-1 bg-muted/40 p-1 rounded">
                          {renderHighlightedText(match.snippet, query)}
                        </p>
                      )}

                      {/* Tags & Meta Badges */}
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground font-mono">
                        <span>{formatBytes(match.doc.filesize)}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          AES-256
                        </span>
                        {match.doc.tags && match.doc.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              #{match.doc.tags.slice(0, 4).join(" #")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1-Tap Quick Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <button
                      type="button"
                      title={t("omnibar.preview", "Vista Previa (Enter)")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFile(match.doc.id, "preview");
                        onClose();
                      }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={t("omnibar.share", "Compartir (⌘S)")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFile(match.doc.id, "share");
                        onClose();
                      }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={t("omnibar.copySeal", "Copiar Sello / Enlace (⌘⇧C)")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFile(match.doc.id, "copy");
                        onClose();
                      }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={t("omnibar.download", "Descargar (⌘D)")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFile(match.doc.id, "download");
                        onClose();
                      }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t("omnibar.navHint", "↑↓ navegar • ↵ abrir • ⌘S compartir • ⌘D descargar")}</span>
          </div>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {t("omnibar.localEncrypted", "100% Cifrado Local")}
          </span>
        </div>
      </div>
    </div>
  );
}

