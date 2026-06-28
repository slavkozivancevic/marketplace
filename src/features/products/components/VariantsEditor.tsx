"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useWatch, useFormState, type UseFormReturn } from "react-hook-form";
import { Plus, X, RefreshCw, ImageOff } from "lucide-react";
import Image from "next/image";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { PriceInput } from "./PriceInput";
import { useCurrencyStore } from "@/store/currency";
import { cn } from "@/lib/utils";
import { getLabel } from "@/features/attributes/utils/translations";
import type { AttributeSelectorItem } from "@/features/attributes/db/attributes";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import type { PresignedUploadedMedia } from "@/types/types";
import type { ProductFormData } from "./ProductForm";

type Form = UseFormReturn<ProductFormData, unknown, ProductFormData>;
type VariantRow = ProductFormData["variants"][number];

function indexTree(tree: CategoryTreeItem[]) {
  const parentOf = new Map<string, string | null>();
  const walk = (node: CategoryTreeItem, parentId: string | null) => {
    parentOf.set(node.id, parentId);
    for (const child of node.children) walk(child, node.id);
  };
  for (const root of tree) walk(root, null);
  return parentOf;
}

/**
 * Unified-model variant editor. Variant axes are the variant-defining
 * attributes (Color, Size...) applicable to the product's categories; each
 * variant picks one AttributeOption per axis (controlled vocabulary), so the
 * purchasable variations and the catalog facets share one dictionary.
 */
export function VariantsEditor({
  form,
  attributeLibrary,
  categoryAttributeMap,
  categoryTree,
  uploadedMedia,
}: {
  form: Form;
  attributeLibrary: AttributeSelectorItem[];
  categoryAttributeMap: Record<string, string[]>;
  categoryTree: CategoryTreeItem[];
  uploadedMedia: PresignedUploadedMedia[];
}) {
  const t = useTranslations("productForm");
  const locale = useLocale();
  const { rates, currency } = useCurrencyStore();

  const categoryIdsRaw = useWatch({ control: form.control, name: "categoryIds" });
  const categoryIds = useMemo(
    () => (categoryIdsRaw as string[] | undefined) ?? [],
    [categoryIdsRaw],
  );
  const variants =
    (useWatch({ control: form.control, name: "variants" }) as VariantRow[] | undefined) ?? [];

  // Per-variant field errors, so each row can surface its own validation message
  // inline (the inputs aren't `<FormField>`-wrapped, so there's no FormMessage).
  // Subscribed via useFormState so the editor re-renders when errors change.
  const { errors } = useFormState({ control: form.control });
  type VariantFieldErrors = Partial<
    Record<keyof VariantRow, { message?: string } | undefined>
  >;
  const variantErrors = errors.variants as
    | (VariantFieldErrors | undefined)[]
    | undefined;
  const errMsg = (i: number, field: keyof VariantRow) =>
    variantErrors?.[i]?.[field]?.message;

  const parentOf = useMemo(() => indexTree(categoryTree), [categoryTree]);

  // Variant-defining attributes applicable to the selected categories (own + inherited).
  const axes = useMemo(() => {
    const ids = new Set<string>();
    for (const catId of categoryIds) {
      let current: string | null = catId;
      const guard = new Set<string>();
      while (current && !guard.has(current)) {
        guard.add(current);
        for (const attrId of categoryAttributeMap[current] ?? []) ids.add(attrId);
        current = parentOf.get(current) ?? null;
      }
    }
    return attributeLibrary.filter((a) => ids.has(a.id) && a.isVariantDefining);
  }, [categoryIds, categoryAttributeMap, parentOf, attributeLibrary]);

  const writeVariants = (next: VariantRow[]) =>
    // shouldValidate so an invalid variant field (e.g. negative stock) surfaces
    // its error as soon as it's edited, instead of only on submit.
    form.setValue("variants", next, { shouldDirty: true, shouldValidate: true });

  const setField = (i: number, patch: Partial<VariantRow>) => {
    const cur = [...(form.getValues("variants") ?? [])];
    cur[i] = { ...cur[i], ...patch };
    writeVariants(cur);
  };

  const toggleMedia = (i: number, key: string) => {
    const cur = [...(form.getValues("variants") ?? [])];
    const v = { ...cur[i] };
    const keys = v.mediaKeys ?? [];
    v.mediaKeys = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
    cur[i] = v;
    writeVariants(cur);
  };

  const addVariant = () => {
    writeVariants([
      ...(form.getValues("variants") ?? []),
      {
        sku: "",
        price: form.getValues("price"),
        compareAtPrice: null,
        costPrice: null,
        stock: 0,
        barcode: "",
        weight: null,
        weightUnit: null,
        mediaKeys: [],
        options: [],
      },
    ]);
  };

  const removeVariant = (i: number) => {
    const cur = [...(form.getValues("variants") ?? [])];
    cur.splice(i, 1);
    writeVariants(cur);
  };

  // ---- Generate-from-options (cartesian) ----
  // Which option ids are checked per axis, seeded from the current variants so
  // editing a product pre-selects the options already in use.
  const seedPicked = (): Record<string, string[]> => {
    const init: Record<string, string[]> = {};
    for (const v of form.getValues("variants") ?? []) {
      for (const o of v.options ?? []) {
        (init[o.attributeId] ??= []).push(o.optionId);
      }
    }
    for (const k of Object.keys(init)) init[k] = [...new Set(init[k])];
    return init;
  };

  const [picked, setPicked] = useState<Record<string, string[]>>(seedPicked);

  // Snapshot of the option selection that the current variants were last
  // generated from. When `picked` drifts from this snapshot (user checks/
  // unchecks an option, or the applicable axes change), the generated variants
  // are stale and we prompt the user to regenerate. Seeded to match `picked`
  // so an unedited product shows no "needs regenerate" signal.
  const [syncedPicked, setSyncedPicked] = useState<Record<string, string[]>>(seedPicked);

  const toggleOption = (attributeId: string, optionId: string) => {
    setPicked((prev) => {
      const cur = prev[attributeId] ?? [];
      const next = cur.includes(optionId)
        ? cur.filter((id) => id !== optionId)
        : [...cur, optionId];
      return { ...prev, [attributeId]: next };
    });
  };

  const sigOf = (opts: { attributeId: string; optionId: string }[]) =>
    [...opts].map((o) => `${o.attributeId}:${o.optionId}`).sort().join("|");

  // Stable signature of a per-axis selection, scoped to the currently
  // applicable axes so a category change (which adds/removes axes) also counts
  // as drift. Used to detect when the generated variants are out of sync.
  const pickedSignature = (sel: Record<string, string[]>) =>
    axes
      .map((a) => `${a.id}:${[...(sel[a.id] ?? [])].sort().join(",")}`)
      .sort()
      .join("|");

  const optionsChanged = useMemo(
    () => pickedSignature(picked) !== pickedSignature(syncedPicked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picked, syncedPicked, axes],
  );

  const generate = () => {
    const activeAxes = axes
      .map((a) => ({ a, opts: picked[a.id] ?? [] }))
      .filter((x) => x.opts.length > 0);
    if (activeAxes.length === 0) {
      toast.error(t("addOptionFirst"));
      return;
    }

    // Cartesian product across the selected options of each active axis.
    let combos: { attributeId: string; optionId: string }[][] = [[]];
    for (const { a, opts } of activeAxes) {
      combos = combos.flatMap((combo) =>
        opts.map((optionId) => [...combo, { attributeId: a.id, optionId }]),
      );
    }

    const prev = form.getValues("variants") ?? [];
    const prevBySig = new Map(prev.map((v) => [sigOf(v.options ?? []), v]));
    const usedSkus = new Set<string>();
    const optionValue = (attributeId: string, optionId: string) =>
      attributeLibrary.find((x) => x.id === attributeId)?.options.find((o) => o.id === optionId)?.value ?? "";
    const makeSku = (combo: { attributeId: string; optionId: string }[]) => {
      const base =
        combo.map((o) => optionValue(o.attributeId, o.optionId).toUpperCase().replace(/[^A-Z0-9]+/g, "")).filter(Boolean).join("-") || "VARIANT";
      let sku = base;
      let n = 2;
      while (usedSkus.has(sku)) sku = `${base}-${n++}`;
      usedSkus.add(sku);
      return sku;
    };

    const defaultPrice = form.getValues("price");
    const next: VariantRow[] = combos.map((combo) => {
      const existing = prevBySig.get(sigOf(combo));
      if (existing) {
        usedSkus.add(existing.sku);
        return { ...existing, options: combo };
      }
      return {
        sku: makeSku(combo),
        price: defaultPrice,
        compareAtPrice: null,
        costPrice: null,
        stock: 0,
        barcode: "",
        weight: null,
        weightUnit: null,
        mediaKeys: [],
        options: combo,
      };
    });
    writeVariants(next);
    setSyncedPicked(picked);
    toast.success(t("generated", { count: next.length }));
  };

  // Saved baseline per variant, keyed by its option signature, so each row can
  // show its persisted SKU / price / stock when edited. The unified model keeps
  // option combos unique, making the signature a stable key across reorders.
  // Empty in create mode (no saved variants); added/new-combo rows have no match
  // and therefore show no hint.
  const savedBySig = new Map<string, Partial<VariantRow>>();
  for (const sv of (form.formState.defaultValues?.variants ?? []) as Partial<VariantRow>[]) {
    savedBySig.set(sigOf((sv.options ?? []) as VariantRow["options"]), sv);
  }
  const fmtUsd = (n: unknown) => `$${Number(n).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background pt-4 pb-3">
        <div>
          <h3 className="text-base font-semibold">{t("variants")}</h3>
          <p className="text-sm text-muted-foreground">{t("variantsDesc")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addVariant}>
          <Plus className="w-4 h-4 mr-1" />
          {t("addVariant")}
        </Button>
      </div>

      {axes.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("variantsNoAxes")}</p>
      )}

      {/* Generate from options (cartesian over selected axis values). */}
      {axes.length > 0 && (
        <div className="rounded-lg border border-border/60 p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-medium">{t("generateVariants")}</p>
          <div className="space-y-3">
            {axes.map((a) => (
              <div key={a.id} className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {getLabel(a.translations, locale)}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {a.options.map((o) => {
                    const on = (picked[a.id] ?? []).includes(o.id);
                    return (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => toggleOption(a.id, o.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer",
                          on
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {getLabel(o.translations, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant={optionsChanged ? "default" : "outline"}
            onClick={generate}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            {t("generateVariants")}
            {optionsChanged && ` ${t("required")}`}
          </Button>
        </div>
      )}

      {/* Signals that the option selection drifted from what the current
          variants were generated from; the variant list is stale until the
          user regenerates. */}
      {optionsChanged && variants.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30">
          <RefreshCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-800 dark:text-orange-300">
            {t("optionsChanged")}
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-400/90">
            {t("regenerateHint")}
          </AlertDescription>
        </Alert>
      )}

      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
          {t("noVariants")}
        </p>
      ) : (
        variants.map((v, i) => {
          const saved = savedBySig.get(sigOf(v.options ?? []));
          return (
          <div key={i} className="border rounded-md p-4 space-y-3 bg-background dark:bg-input/30">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(v.options ?? []).length > 0 ? (
                  (v.options ?? []).map((o) => {
                    const a = attributeLibrary.find((x) => x.id === o.attributeId);
                    const opt = a?.options.find((op) => op.id === o.optionId);
                    return (
                      <Badge key={o.attributeId} variant="outline">
                        {a ? getLabel(a.translations, locale) : ""}:{" "}
                        {opt ? getLabel(opt.translations, locale) : ""}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">{t("manualVariant")}</span>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("sku")}</label>
                <Input
                  placeholder={t("skuPlaceholder")}
                  value={v.sku}
                  onChange={(e) => setField(i, { sku: e.target.value })}
                />
                {errMsg(i, "sku") && (
                  <p className="text-xs text-destructive">{errMsg(i, "sku")}</p>
                )}
                {saved?.sku != null && (
                  <ChangedHint changed={saved.sku !== v.sku} savedText={saved.sku} />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("price")}</label>
                <PriceInput
                  value={v.price}
                  onChange={(usd) => setField(i, { price: usd })}
                  rates={rates}
                  defaultCurrency={currency}
                />
                {errMsg(i, "price") && (
                  <p className="text-xs text-destructive">{errMsg(i, "price")}</p>
                )}
                {saved?.price != null && (
                  <ChangedHint
                    changed={Number(saved.price) !== Number(v.price)}
                    savedText={fmtUsd(saved.price)}
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("stock")}</label>
                <NumberStepper
                  min={0}
                  value={v.stock}
                  onChange={(val) => setField(i, { stock: val ?? 0 })}
                />
                {errMsg(i, "stock") && (
                  <p className="text-xs text-destructive">{errMsg(i, "stock")}</p>
                )}
                {saved?.stock != null && (
                  <ChangedHint
                    changed={Number(saved.stock) !== Number(v.stock)}
                    savedText={String(saved.stock)}
                  />
                )}
              </div>
            </div>

            {/* Variant media - select which uploaded images/videos belong to
                this variant. The first selected item is the one the storefront
                carousel jumps to and the cart thumbnail uses. */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{t("variantMedia")}</span>
              {uploadedMedia.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  <ImageOff className="w-3.5 h-3.5" />
                  {t("uploadFirst")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uploadedMedia.map((m) => {
                    const sel = (v.mediaKeys ?? []).includes(m.key);
                    const isVideo = m.mediaType === "VIDEO";
                    const thumb = isVideo ? (m.posterUrl ?? m.url) : m.url;
                    return (
                      <button
                        type="button"
                        key={m.key}
                        onClick={() => toggleMedia(i, m.key)}
                        className={cn(
                          "relative w-16 h-16 rounded border-2 overflow-hidden shrink-0 transition-all cursor-pointer",
                          sel
                            ? "border-primary opacity-100 ring-2 ring-primary/30"
                            : "border-transparent opacity-60 hover:opacity-100",
                        )}
                      >
                        {isVideo && !m.posterUrl ? (
                          <video src={thumb} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <Image src={thumb} alt="Variant media" fill sizes="64px" className="object-cover" unoptimized={thumb.startsWith("blob:")} />
                        )}
                        {isVideo && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                            <span className="text-white text-[10px] font-semibold">VIDEO</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          );
        })
      )}
    </div>
  );
}
