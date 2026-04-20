"use client";

import { useState, useTransition, useRef } from "react";
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { bulkCreateProducts, type BulkCreateRow, type BulkCreateResult } from "@/features/products/actions/products";

// ---------------------------------------------------------------------------
// CSV template
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  "title",
  "description",
  "shortDescription",
  "price",
  "compareAtPrice",
  "costPrice",
  "stock",
  "barcode",
  "taxable",
  "requiresShipping",
  "isDigital",
  "weight",
  "weightUnit",
  "brandId",
  "metaTitle",
  "metaDescription",
] as const;

const EXAMPLE_ROW = [
  "My Product",
  "Full product description",
  "Short description",
  "29.99",
  "39.99",
  "",
  "100",
  "BARCODE123",
  "true",
  "true",
  "false",
  "",
  "",
  "",
  "",
  "",
];

function downloadTemplate() {
  const header = CSV_COLUMNS.join(",");
  const example = EXAMPLE_ROW.map((v) => (v.includes(",") ? `"${v}"` : v)).join(",");
  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// CSV parser (RFC 4180-compatible, handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && raw[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Row validation and coercion
// ---------------------------------------------------------------------------

type ParsedRow =
  | { ok: true; data: BulkCreateRow }
  | { ok: false; errors: string[] };

const VALID_WEIGHT_UNITS = new Set(["G", "KG", "LB", "OZ"]);

function parseRow(cells: string[], headerIndex: Map<string, number>): ParsedRow {
  const get = (col: string) => cells[headerIndex.get(col) ?? -1]?.trim() ?? "";

  const errors: string[] = [];

  const title = get("title");
  if (!title) errors.push("title is required");

  const description = get("description");
  if (!description) errors.push("description is required");

  const rawPrice = get("price");
  const price = parseFloat(rawPrice);
  if (!rawPrice || isNaN(price) || price < 0) errors.push("price must be a non-negative number");

  const rawCompare = get("compareAtPrice");
  const compareAtPrice = rawCompare ? parseFloat(rawCompare) : undefined;
  if (rawCompare && isNaN(compareAtPrice!)) errors.push("compareAtPrice must be a number");

  const rawCost = get("costPrice");
  const costPrice = rawCost ? parseFloat(rawCost) : undefined;
  if (rawCost && isNaN(costPrice!)) errors.push("costPrice must be a number");

  const rawStock = get("stock");
  const stock = rawStock ? parseInt(rawStock, 10) : undefined;
  if (rawStock && isNaN(stock!)) errors.push("stock must be an integer");

  const rawWeight = get("weight");
  const weight = rawWeight ? parseFloat(rawWeight) : undefined;
  if (rawWeight && isNaN(weight!)) errors.push("weight must be a number");

  const weightUnit = get("weightUnit").toUpperCase() || undefined;
  if (weightUnit && !VALID_WEIGHT_UNITS.has(weightUnit))
    errors.push("weightUnit must be G, KG, LB, or OZ");

  const parseBool = (v: string, def: boolean) => {
    if (!v) return def;
    return v.toLowerCase() === "true";
  };

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      title,
      description,
      shortDescription: get("shortDescription") || undefined,
      price,
      compareAtPrice,
      costPrice,
      stock,
      barcode: get("barcode") || undefined,
      taxable: parseBool(get("taxable"), true),
      requiresShipping: parseBool(get("requiresShipping"), true),
      isDigital: parseBool(get("isDigital"), false),
      weight,
      weightUnit,
      brandId: get("brandId") || undefined,
      metaTitle: get("metaTitle") || undefined,
      metaDescription: get("metaDescription") || undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type ImportResult = {
  totalRows: number;
  created: number;
  errors: { row: number; message: string }[];
};

export function CsvImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawCsv, setRawCsv] = useState("");
  const [parsed, setParsed] = useState<
    { rowIndex: number; result: ParsedRow }[]
  >([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, startImport] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  const processCsvText = (text: string) => {
    setRawCsv(text);
    setImportResult(null);

    if (!text.trim()) {
      setParsed([]);
      return;
    }

    const rows = parseCsv(text.trim());
    if (rows.length < 2) {
      setParsed([]);
      return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const headerIndex = new Map(header.map((h, i) => [h, i]));

    const results = rows.slice(1).map((cells, i) => ({
      rowIndex: i + 2, // 1-based, +1 for header
      result: parseRow(cells, headerIndex),
    }));

    setParsed(results);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => processCsvText(e.target?.result as string ?? "");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) {
      handleFile(file);
    }
  };

  const validRows = parsed.filter((p) => p.result.ok);
  const invalidRows = parsed.filter((p) => !p.result.ok);

  const handleImport = () => {
    const rows = validRows.map((p) => (p.result as { ok: true; data: BulkCreateRow }).data);
    if (rows.length === 0) return;

    startImport(async () => {
      const res = await bulkCreateProducts(rows);
      if (res.error) {
        setImportResult({ totalRows: rows.length, created: 0, errors: [{ row: 0, message: res.message }] });
        return;
      }
      const ok = res as { error: false; result: BulkCreateResult };
      setImportResult(ok.result);
      if (ok.result.errors.length === 0) {
        // Full success — reset the form
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
      {/* Step 1: Template */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">1. Download template</h3>
        <p className="text-sm text-muted-foreground">
          Fill in the CSV template with your product data. Images cannot be imported via
          CSV — add them after import.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="w-fit gap-2"
        >
          <Download className="h-4 w-4" />
          Download CSV template
        </Button>
      </div>

      {/* Step 2: Upload */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">2. Upload or paste CSV</h3>

        {/* Drop zone */}
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
          <p className="text-sm text-muted-foreground">
            Drop a <strong>.csv</strong> file here, or{" "}
            <span className="text-primary underline-offset-4 hover:underline">click to browse</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* Or paste */}
        <p className="text-xs text-muted-foreground text-center">or paste CSV directly</p>
        <Textarea
          placeholder={`title,description,price\nMy Product,Full description,29.99`}
          className="font-mono text-xs min-h-32 resize-y"
          value={rawCsv}
          onChange={(e) => processCsvText(e.target.value)}
        />
      </div>

      {/* Step 3: Preview & import */}
      {parsed.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              3. Review &amp; import{" "}
              <span className="font-normal text-muted-foreground">
                ({validRows.length} valid, {invalidRows.length} invalid)
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>

          {/* Validation errors */}
          {invalidRows.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation errors — {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} will be skipped</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {invalidRows.map(({ rowIndex, result }) =>
                    !result.ok
                      ? result.errors.map((err, i) => (
                          <li key={`${rowIndex}-${i}`}>
                            Row {rowIndex}: {err}
                          </li>
                        ))
                      : null,
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview table */}
          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Title</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map(({ rowIndex, result }) => (
                  <tr
                    key={rowIndex}
                    className={cn(
                      "border-b last:border-b-0",
                      !result.ok && "bg-destructive/5",
                    )}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{rowIndex}</td>
                    <td className="px-3 py-2 max-w-50 truncate">
                      {result.ok ? result.data.title : (
                        <span className="text-destructive italic">invalid</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {result.ok ? `$${result.data.price.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {result.ok ? (
                        <Badge variant="secondary" className="text-xs">DRAFT</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Error</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={handleImport}
            disabled={validRows.length === 0 || isImporting}
            className="w-fit gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import {validRows.length} product{validRows.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <Alert variant={importResult.errors.length > 0 ? "destructive" : "default"}>
          {importResult.errors.length === 0 ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {importResult.errors.length === 0
              ? `Successfully imported ${importResult.created} product${importResult.created !== 1 ? "s" : ""}`
              : `Imported ${importResult.created} of ${importResult.totalRows} products`}
          </AlertTitle>
          {importResult.errors.length > 0 && (
            <AlertDescription>
              <ul className="mt-1 space-y-0.5 text-xs">
                {importResult.errors.map(({ row, message }) => (
                  <li key={row}>Row {row}: {message}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
