import {
  Check,
  Code2,
  Copy,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildSpreadsheetCellCitation,
  type FilemonOfficeDocumentContract,
  type OfficeCell,
} from "../../utils/filemon-office";

interface FilemonOfficeStageProps {
  doc: FilemonOfficeDocumentContract;
}

type OfficeViewMode = "twin" | "source" | "contract";

function isNumericLike(val: string): boolean {
  if (!val) return false;
  return /^[$+-]?[\d,]+(\.\d+)?%?$/.test(val.trim());
}

function formatCurrencyMxn(amount: string, currency = "MXN"): string {
  const num = Number(amount);
  if (amount === "NOT_EVALUABLE" || Number.isNaN(num)) {
    return `${amount} ${currency}`;
  }
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function FilemonOfficeStage({ doc }: FilemonOfficeStageProps) {
  const { t } = useTranslation("drive");
  const [viewMode, setViewMode] = useState<OfficeViewMode>("twin");
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [rowFilter, setRowFilter] = useState("");
  const [selectedCell, setSelectedCell] = useState<OfficeCell | null>(null);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [copiedAmarre, setCopiedAmarre] = useState(false);

  const activeSheet = useMemo(() => {
    const sheets = doc.spreadsheet?.sheets ?? [];
    return sheets[activeSheetIdx] ?? sheets[0] ?? null;
  }, [doc.spreadsheet, activeSheetIdx]);

  const activeCell: OfficeCell | null = useMemo(() => {
    if (selectedCell) return selectedCell;
    return activeSheet?.rows?.[0]?.[0] ?? null;
  }, [selectedCell, activeSheet]);

  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    const q = rowFilter.trim().toLowerCase();
    if (!q) {
      return activeSheet.rows.map((cells, idx) => ({ rowNumber: idx + 1, cells }));
    }
    return activeSheet.rows
      .map((cells, idx) => ({ rowNumber: idx + 1, cells }))
      .filter(({ cells, rowNumber }) => {
        if (rowNumber === 1) return true; // Keep header row visible during filter
        return cells.some((c) => c.value.toLowerCase().includes(q));
      });
  }, [activeSheet, rowFilter]);

  const currentCitation = useMemo(() => {
    if (doc.kind === "spreadsheet" && activeSheet && activeCell) {
      return buildSpreadsheetCellCitation(
        doc.identity.filename,
        doc.identity.sha256,
        activeSheet.name,
        activeCell,
      );
    }
    if (doc.cfdi) {
      return `${doc.identity.filename}#uuid:${doc.cfdi.timbre.uuid}#sha256:${doc.identity.sha256.slice(0, 12)}`;
    }
    return `${doc.identity.filename}#${doc.citation.locator}#sha256:${doc.identity.sha256.slice(0, 12)}`;
  }, [doc, activeSheet, activeCell]);

  const amarreContractPayload = useMemo(() => {
    if (doc.cfdi?.amarreFiscalRochePayload) {
      return doc.cfdi.amarreFiscalRochePayload;
    }
    return {
      plugin: doc.plugin.module,
      host: doc.plugin.host,
      target_modules: doc.plugin.targets,
      document_id: doc.identity.document_id,
      filename: doc.identity.filename,
      sha256: doc.identity.sha256,
      kind: doc.kind,
      headline: doc.headline,
      citation: currentCitation,
      sheets_summary: doc.spreadsheet?.sheets.map((s) => ({
        name: s.name,
        rows: s.totalRows,
        cols: s.totalCols,
        sample_row_1: s.rows[0]?.map((c) => c.value) ?? [],
      })),
    };
  }, [doc, currentCitation]);

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(currentCitation);
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    } catch {
      // Ignore clipboard failure in non-secure environments
    }
  };

  const handleCopyAmarreJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(amarreContractPayload, null, 2));
      setCopiedAmarre(true);
      setTimeout(() => setCopiedAmarre(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const whatsappHref = useMemo(() => {
    const summaryLines = [
      `📄 *Filemón Office • ${doc.identity.filename}*`,
      `🏛️ *Módulo:* Quantix ABRN SAT • Amarre Fiscal (Roche)`,
      `📊 *Resumen:* ${doc.headline}`,
      doc.cfdi ? `🧾 *UUID SAT:* ${doc.cfdi.timbre.uuid}` : null,
      `🔒 *Sello SHA-256:* ${doc.identity.sha256.slice(0, 16)}…`,
    ].filter(Boolean);
    return `https://wa.me/?text=${encodeURIComponent(summaryLines.join("\n"))}`;
  }, [doc]);

  return (
    <div className="flex flex-col gap-4 w-full" data-testid="filemon-office-stage">
      {/* 1-Click Instant Dispatch Deck */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-surface-subtle/90 p-2.5 shadow-sm">
        {/* View Mode Switcher */}
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-surface p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setViewMode("twin")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === "twin"
                ? "bg-accent text-white shadow-sm"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("office.viewGlassTwin", { defaultValue: "Vista Ejecutiva (Glass Twin)" })}
          </button>

          {doc.rawText !== undefined && (
            <button
              type="button"
              onClick={() => setViewMode("source")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "source"
                  ? "bg-accent text-white shadow-sm"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              {t("office.viewRawSource", { defaultValue: "Fuente Original" })}
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewMode("contract")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === "contract"
                ? "bg-accent text-white shadow-sm"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            {t("office.viewAmarreContract", {
              defaultValue: "Ficha SAT / Amarre Fiscal (Roche)",
            })}
          </button>
        </div>

        {/* 1-Click Dispatch Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyCitation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover transition-colors"
            title={currentCitation}
          >
            {copiedCitation ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-accent" />
            )}
            <span>
              {copiedCitation
                ? t("office.copiedCitation", { defaultValue: "¡Cita copiada!" })
                : t("office.copyCitation", { defaultValue: "Copiar Cita / UUID" })}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyAmarreJson()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
          >
            {copiedAmarre ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Receipt className="h-3.5 w-3.5" />
            )}
            <span>
              {copiedAmarre
                ? t("office.copiedAmarreJson", {
                    defaultValue: "¡JSON de Amarre Fiscal copiado!",
                  })
                : t("office.copyAmarreJson", {
                    defaultValue: "Copiar JSON Amarre Fiscal (Roche)",
                  })}
            </span>
          </button>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>
              {t("office.sendWhatsApp", { defaultValue: "Enviar Resumen WhatsApp" })}
            </span>
          </a>
        </div>
      </div>

      {/* Mode 3: Quantix ABRN SAT / Amarre Fiscal (Roche) Contract View */}
      {viewMode === "contract" && (
        <div
          className="rounded-xl border border-indigo-500/30 bg-surface p-4 shadow-sm space-y-3"
          data-testid="filemon-office-contract-view"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Quantix ABRN SAT • Amarre Fiscal (Roche)
              </span>
              <span className="text-xs text-foreground-muted font-mono">
                {currentCitation}
              </span>
            </div>
          </div>
          <pre className="max-h-[55vh] overflow-auto rounded-lg bg-surface-subtle p-4 text-xs font-mono text-foreground leading-relaxed">
            {JSON.stringify(amarreContractPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* Mode 2: Raw Original Source View */}
      {viewMode === "source" && doc.rawText !== undefined && (
        <div
          className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          data-testid="filemon-office-source-view"
        >
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground leading-relaxed">
            {doc.rawText}
          </pre>
        </div>
      )}

      {/* Mode 1: Executive Glass Twin View */}
      {viewMode === "twin" && (
        <>
          {/* Case A: Mexican CFDI 4.0 / 3.3 Live Glass Twin */}
          {doc.kind === "cfdi_xml" && doc.cfdi && (
            <div className="space-y-4" data-testid="filemon-office-cfdi-twin">
              {/* Executive Summary Banner */}
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-surface to-indigo-500/10 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        CFDI {doc.cfdi.version} • Tipo {doc.cfdi.tipoDeComprobante}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                        Serie/Folio:{" "}
                        {[doc.cfdi.serie, doc.cfdi.folio].filter(Boolean).join("-") || "S/F"}
                      </span>
                      <span className="text-xs text-foreground-muted font-mono">
                        Fecha: {doc.cfdi.fecha}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-secondary font-mono">
                      <strong className="text-foreground">
                        {t("office.uuidLabel", { defaultValue: "Folio Fiscal UUID (Timbre SAT)" })}:
                      </strong>{" "}
                      {doc.cfdi.timbre.uuid}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                      Total Comprobante
                    </div>
                    <div className="text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyMxn(doc.cfdi.total, doc.cfdi.moneda)}
                    </div>
                    <div className="text-[11px] text-foreground-secondary">
                      Método: {doc.cfdi.metodoPago} • Forma: {doc.cfdi.formaPago} • CP:{" "}
                      {doc.cfdi.lugarExpedicion}
                    </div>
                  </div>
                </div>
              </div>

              {/* Emisor & Receptor Cards */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-accent">
                    {t("office.emisorTitle", { defaultValue: "Emisor Fiscal (SAT)" })}
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    {doc.cfdi.emisor.nombre}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-secondary font-mono">
                    <span className="rounded bg-surface-subtle px-2 py-0.5 font-semibold text-foreground">
                      RFC: {doc.cfdi.emisor.rfc}
                    </span>
                    <span>Régimen: {doc.cfdi.emisor.regimenFiscal}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {t("office.receptorTitle", { defaultValue: "Receptor / Cliente Fiscal" })}
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    {doc.cfdi.receptor.nombre}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-secondary font-mono">
                    <span className="rounded bg-surface-subtle px-2 py-0.5 font-semibold text-foreground">
                      RFC: {doc.cfdi.receptor.rfc}
                    </span>
                    <span>Uso CFDI: {doc.cfdi.receptor.usoCFDI}</span>
                    <span>CP: {doc.cfdi.receptor.domicilioFiscalReceptor}</span>
                  </div>
                </div>
              </div>

              {/* Conceptos Table */}
              <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t("office.conceptosTitle", {
                      defaultValue: "Conceptos del Comprobante (CFDI)",
                    })}{" "}
                    ({doc.cfdi.conceptos.length})
                  </span>
                  <span className="text-[11px] font-mono text-foreground-muted">
                    Amarre Fiscal (Roche) • Partidas
                  </span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-subtle/60 text-[11px] uppercase text-foreground-muted">
                        <th className="py-2 px-3 font-semibold">Clave SAT</th>
                        <th className="py-2 px-3 font-semibold text-right">Cant.</th>
                        <th className="py-2 px-3 font-semibold">Unidad</th>
                        <th className="py-2 px-3 font-semibold">Descripción</th>
                        <th className="py-2 px-3 font-semibold text-right">V. Unitario</th>
                        <th className="py-2 px-3 font-semibold text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {doc.cfdi.conceptos.map((item, idx) => (
                        <tr key={idx} className="hover:bg-surface-hover/60">
                          <td className="py-2 px-3 font-mono text-foreground-secondary">
                            {item.claveProdServ}
                          </td>
                          <td className="py-2 px-3 font-mono text-right tabular-nums">
                            {item.cantidad}
                          </td>
                          <td className="py-2 px-3 font-mono text-foreground-secondary">
                            {item.claveUnidad}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {item.descripcion}
                          </td>
                          <td className="py-2 px-3 font-mono text-right tabular-nums">
                            {formatCurrencyMxn(item.valorUnitario, doc.cfdi?.moneda)}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-right tabular-nums text-foreground">
                            {formatCurrencyMxn(item.importe, doc.cfdi?.moneda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax Breakdown & Totals Footer */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] text-foreground-muted">Subtotal</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                    {formatCurrencyMxn(doc.cfdi.subTotal, doc.cfdi.moneda)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] text-foreground-muted">Descuento</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                    {formatCurrencyMxn(doc.cfdi.descuento, doc.cfdi.moneda)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] text-foreground-muted">IVA Trasladado</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                    {formatCurrencyMxn(
                      doc.cfdi.impuestos.totalImpuestosTrasladados,
                      doc.cfdi.moneda,
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] text-foreground-muted">Retenciones</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                    {formatCurrencyMxn(
                      doc.cfdi.impuestos.totalImpuestosRetenidos,
                      doc.cfdi.moneda,
                    )}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Total Neto
                  </div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatCurrencyMxn(doc.cfdi.total, doc.cfdi.moneda)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Case B: Spreadsheet Workbench (.xlsx / .csv / .tsv) */}
          {doc.kind === "spreadsheet" && doc.spreadsheet && (
            <div className="space-y-3" data-testid="filemon-office-spreadsheet-workbench">
              {/* Sheet Tabs & Row Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="tablist"
                  aria-label="Hojas del libro"
                >
                  {doc.spreadsheet.sheets.map((sheet, idx) => (
                    <button
                      key={sheet.name}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeSheetIdx}
                      onClick={() => {
                        setActiveSheetIdx(idx);
                        setSelectedCell(null);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                        idx === activeSheetIdx
                          ? "border-accent bg-accent/15 text-accent shadow-sm"
                          : "border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>{sheet.name}</span>
                      <span className="rounded bg-surface-subtle px-1.5 py-0.2 text-[10px] font-mono text-foreground-muted">
                        {sheet.totalRows}×{sheet.totalCols}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[240px] flex-1 max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
                  <input
                    type="search"
                    value={rowFilter}
                    onChange={(e) => setRowFilter(e.target.value)}
                    placeholder={t("office.filterRowsPlaceholder", {
                      defaultValue: "Filtrar filas en esta hoja (ej. RFC, folio, monto)…",
                    })}
                    className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Active Cell & Formula Inspector Bar */}
              {activeSheet && activeCell && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="inline-flex items-center rounded bg-accent/15 px-2 py-0.5 font-mono font-bold text-accent">
                      {activeSheet.name}!{activeCell.ref}
                    </span>
                    {activeCell.formula && (
                      <span className="inline-flex items-center rounded bg-amber-500/15 px-2 py-0.5 font-mono text-amber-700 dark:text-amber-300">
                        fx ={activeCell.formula}
                      </span>
                    )}
                    <span className="truncate font-mono text-foreground">
                      {activeCell.value || "—"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-foreground-muted truncate max-w-md">
                    {currentCitation}
                  </span>
                </div>
              )}

              {/* Data Grid Table */}
              {activeSheet ? (
                <div className="overflow-auto max-h-[54vh] rounded-xl border border-border bg-surface shadow-sm">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-surface-subtle border-b border-border">
                      <tr>
                        <th className="w-10 border-r border-border py-2 px-2 text-center font-mono text-[11px] text-foreground-muted">
                          #
                        </th>
                        {activeSheet.columns.map((col) => (
                          <th
                            key={col}
                            className="border-r border-border py-2 px-3 text-center font-mono text-[11px] font-bold text-foreground-secondary"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredRows.map(({ rowNumber, cells }) => (
                        <tr
                          key={rowNumber}
                          className={
                            rowNumber === 1
                              ? "bg-surface-subtle/60 font-semibold text-foreground"
                              : "hover:bg-surface-hover/50"
                          }
                        >
                          <td className="border-r border-border bg-surface-subtle/40 py-1.5 px-2 text-center font-mono text-[11px] text-foreground-muted">
                            {rowNumber}
                          </td>
                          {cells.map((cell) => {
                            const isSelected = activeCell?.ref === cell.ref;
                            const numeric = isNumericLike(cell.value);
                            return (
                              <td
                                key={cell.ref}
                                onClick={() => setSelectedCell(cell)}
                                className={`cursor-pointer border-r border-border/50 py-1.5 px-3 transition-colors ${
                                  isSelected
                                    ? "bg-accent/15 ring-1 ring-inset ring-accent"
                                    : ""
                                } ${
                                  cell.cacheMissing
                                    ? "text-amber-600 dark:text-amber-400 font-mono italic"
                                    : numeric && rowNumber > 1
                                      ? "text-right font-mono tabular-nums"
                                      : "text-left"
                                }`}
                              >
                                {cell.value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
                  {doc.headline}
                </div>
              )}
            </div>
          )}

          {/* Case C: Generic XML, JSON, Markdown, or Plain Text */}
          {(doc.kind === "generic_xml" ||
            doc.kind === "json" ||
            doc.kind === "markdown" ||
            doc.kind === "text") && (
            <div
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              data-testid="filemon-office-text-stage"
            >
              <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2 text-xs text-foreground-muted">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground-secondary">
                  <FileText className="h-3.5 w-3.5 text-accent" />
                  {doc.badgeLabel}
                </span>
                <span className="font-mono">{doc.headline}</span>
              </div>
              <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground leading-relaxed">
                {doc.rawText}
              </pre>
            </div>
          )}
        </>
      )}

      {/* Honest Notices Footer */}
      {doc.notices.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-surface-subtle/60 px-3 py-2 text-[11px] text-foreground-secondary">
          {doc.notices.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}
