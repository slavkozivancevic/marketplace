"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import {
  detectDelimiter,
  parseCsv,
  TRANSLATION_CSV_COLUMNS,
} from "@/features/products/utils/csv";
import {
  exportTranslationsCsv,
  bulkUpsertTranslations,
  type TranslationImportRow,
  type TranslationImportResult,
} from "@/features/products/actions/translations";

type ParsedRow =
  | { ok: true; data: TranslationImportRow }
  | { ok: false; errors: string[] };

const SUPPORTED = new Set<string>(SUPPORTED_LOCALES);

export function TranslationsCsvPanel() {
  const t = useTranslations("csvTranslations");
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawCsv, setRawCsv] = useState("");
  const [parsed, setParsed] = useState<{ rowIndex: number; result: ParsedRow }[]>([]);
  const [importResult, setImportResult] = useState<TranslationImportResult | null>(null);
  const [isExporting, startExport] = useTransition();
  const [isImporting, startImport] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  const errLabel = (code: string) =>
    t(`err.${code}` as Parameters<typeof t>[0]) || code;

  const parseRow = (cells: string[], idx: Map<string, number>): ParsedRow => {
    const get = (col: string) => cells[idx.get(col) ?? -1]?.trim() ?? "";
    const errors: string[] = [];

    const productRef = get("productRef");
    if (!productRef) errors.push(errLabel("productRef"));

    const locale = get("locale").toLowerCase();
    if (!locale) errors.push(errLabel("localeRequired"));
    else if (!SUPPORTED.has(locale)) errors.push(errLabel("invalidLocale"));

    const title = get("title");
    if (!title) errors.push(errLabel("titleRequired"));

    if (errors.length > 0) return { ok: false, errors };

    return {
      ok: true,
      data: {
        productRef,
        locale,
        title,
        slug: get("slug") || undefined,
        shortDescription: get("shortDescription") || undefined,
        description: get("description") || undefined,
        metaTitle: get("metaTitle") || undefined,
        metaDescription: get("metaDescription") || undefined,
      },
    };
  };

  const processCsvText = (text: string) => {
    setRawCsv(text);
    setImportResult(null);
    if (!text.trim()) {
      setParsed([]);
      return;
    }

    const delimiter = detectDelimiter(text);
    const rows = parseCsv(text.trim(), delimiter);
    if (rows.length < 2) {
      setParsed([]);
      return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const headerIndex = new Map<string, number>();
    for (const col of TRANSLATION_CSV_COLUMNS) {
      const i = header.indexOf(col.toLowerCase());
      if (i !== -1) headerIndex.set(col, i);
    }

    setParsed(
      rows.slice(1).map((cells, i) => ({
        rowIndex: i + 2,
        result: parseRow(cells, headerIndex),
      })),
    );
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => processCsvText((e.target?.result as string) ?? "");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleExport = () => {
    startExport(async () => {
      const res = await exportTranslationsCsv();
      if ("error" in res && res.error) return;
      const csv = (res as { error: false; csv: string }).csv;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-translations.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const validRows = parsed.filter((p) => p.result.ok);
  const invalidRows = parsed.filter((p) => !p.result.ok);

  const handleImport = () => {
    const rows = validRows.map((p) => (p.result as { ok: true; data: TranslationImportRow }).data);
    if (rows.length === 0) return;
    startImport(async () => {
      const res = await bulkUpsertTranslations(rows);
      if ("error" in res && res.error) {
        setImportResult({ totalRows: rows.length, upserted: 0, errors: [{ row: 0, code: "unknown" }] });
        return;
      }
      const ok = res as { error: false; result: TranslationImportResult };
      setImportResult(ok.result);
      if (ok.result.errors.length === 0) {
        setRawCsv("");
        setParsed([]);
      }
    });
  };

  const reset = () => {
    setRawCsv("");
    setParsed([]);
    setImportResult(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Step 1: export current translations */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("step1Title")}</h3>
        <p className="text-sm text-muted-foreground">{t("step1Desc")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
          className="w-fit gap-2"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("exportBtn")}
        </Button>

        <details className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-sm">{t("fieldRefTitle")}</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li><strong>productRef</strong> - {t("hintRef")}</li>
            <li><strong>locale</strong> - {SUPPORTED_LOCALES.join(", ")}</li>
            <li><strong>slug</strong> - {t("hintSlug")}</li>
            <li><strong>title, description</strong> - {t("hintRequired")}</li>
          </ul>
        </details>
      </div>

      {/* Step 2: upload */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("step2Title")}</h3>
        <div
          className={cn(
            "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("dropHint")}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">{t("pasteDirect")}</p>
        <Textarea
          placeholder={t("textareaPlaceholder")}
          className="font-mono text-xs min-h-32 max-h-64 overflow-auto resize-y"
          value={rawCsv}
          onChange={(e) => processCsvText(e.target.value)}
        />
      </div>

      {/* Step 3: preview & import */}
      {parsed.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {t("step3Title")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("step3Summary", { valid: validRows.length, invalid: invalidRows.length })}
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              {t("clear")}
            </Button>
          </div>

          {invalidRows.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("validationErrors", { count: invalidRows.length })}</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-xs">
                  {invalidRows.map(({ rowIndex, result }) =>
                    !result.ok
                      ? result.errors.map((err, i) => (
                          <li key={`${rowIndex}-${i}`}>{t("rowError", { row: rowIndex, error: err })}</li>
                        ))
                      : null,
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b">
                  <th className="bg-muted px-3 py-2 text-left font-medium text-muted-foreground">{t("colHash")}</th>
                  <th className="bg-muted px-3 py-2 text-left font-medium text-muted-foreground">{t("colRef")}</th>
                  <th className="bg-muted px-3 py-2 text-left font-medium text-muted-foreground">{t("colLocale")}</th>
                  <th className="bg-muted px-3 py-2 text-left font-medium text-muted-foreground">{t("colTitle")}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map(({ rowIndex, result }) => (
                  <tr key={rowIndex} className={cn("border-b last:border-b-0", !result.ok && "bg-destructive/5")}>
                    <td className="px-3 py-2 text-muted-foreground">{rowIndex}</td>
                    <td className="px-3 py-2 max-w-40 truncate text-muted-foreground">
                      {result.ok ? result.data.productRef : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {result.ok ? (
                        <Badge variant="secondary" className="text-xs uppercase">{result.data.locale}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">{t("invalid")}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-50 truncate">
                      {result.ok ? result.data.title : <span className="text-destructive italic">{t("invalid")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={handleImport} disabled={validRows.length === 0 || isImporting} className="w-fit gap-2">
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("importing")}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {t("importBtn", { count: validRows.length })}
              </>
            )}
          </Button>
        </div>
      )}

      {importResult && (
        <Alert variant={importResult.errors.length > 0 ? "destructive" : "default"}>
          {importResult.errors.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>
            {importResult.errors.length === 0
              ? t("successTitle", { count: importResult.upserted })
              : t("partialTitle", { upserted: importResult.upserted, total: importResult.totalRows })}
          </AlertTitle>
          {importResult.errors.length > 0 && (
            <AlertDescription>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-xs">
                {importResult.errors.map(({ row, code }) => (
                  <li key={row}>{t("rowError", { row, error: errLabel(code) })}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
