"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useWatch, useFormState, type UseFormReturn } from "react-hook-form";
import { Plus, X, RefreshCw, ImageOff } from "lucide-react";
import { RetryImage } from "@/components/RetryImage";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { Label } from "@/components/ui/label";
import { PriceInput } from "./PriceInput";
import { useCurrencyStore } from "@/store/currency";
import { cn } from "@/lib/utils";
import { formatPrice, convertCents, decimalToCents } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
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

  // Each row's PriceInput has its own inline currency selector - track what
  // each is currently showing (keyed by row index, same as everything else
  // in this list) so that row's saved-value hint can match it instead of
  // always showing raw USD.
  const [priceCurrencyByRow, setPriceCurrencyByRow] = useState<Record<number, Currency>>({});
  const priceCurrencyFor = (i: number): Currency => priceCurrencyByRow[i] ?? currency;

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

  // `validate` defaults to false: bulk operations (generate, add, remove) can
  // populate a row with a not-yet-valid inherited value (e.g. price 0 before
  // Pricing is filled in) and shouldn't flag it before the user has actually
  // touched that row - same "no error until submit or direct edit" rule every
  // other required field in this form follows. Direct field edits (`setField`)
  // opt back in so an invalid value surfaces its error as soon as it's edited,
  // instead of only on submit.
  const writeVariants = (next: VariantRow[], validate = false) =>
    form.setValue("variants", next, { shouldDirty: true, shouldValidate: validate });

  const setField = (i: number, patch: Partial<VariantRow>) => {
    const cur = [...(form.getValues("variants") ?? [])];
    cur[i] = { ...cur[i], ...patch };
    writeVariants(cur, true);
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
    // Unlike generate/addVariant, removing a row never introduces new
    // not-yet-valid data - it can only drop the row an existing error belonged
    // to. Validate so that error (and the tab's red icon, once no row is left
    // invalid) actually clears instead of lingering for an index that's gone.
    writeVariants(cur, true);
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

  // Cartesian product across the selected options of each active (checked)
  // axis. Shared by the staleness check below and by `generate()` itself, so
  // "what regenerating would produce" can never drift from "what we compare
  // against" the way two independently-updated snapshots can.
  const activeAxes = axes
    .map((a) => ({ a, opts: picked[a.id] ?? [] }))
    .filter((x) => x.opts.length > 0);
  const cartesianCombos = (axesToCombine: typeof activeAxes) => {
    let combos: { attributeId: string; optionId: string }[][] = [[]];
    for (const { a, opts } of axesToCombine) {
      combos = combos.flatMap((combo) =>
        opts.map((optionId) => [...combo, { attributeId: a.id, optionId }]),
      );
    }
    return combos;
  };

  // Staleness is a direct comparison of ground truth - the set of combos the
  // checked pills currently imply vs. the set actually present in `variants`
  // - rather than a separately-tracked "last synced selection" snapshot. A
  // snapshot only updates where `generate()` explicitly touches it, so it
  // goes stale itself the moment variants are added/removed by hand (edit a
  // row, delete one, delete all) without ever re-checking a pill; comparing
  // directly against `variants` stays correct through any of that. Manual
  // (axis-less) variants are ignored on the "present" side - they aren't part
  // of the checkbox bookkeeping at all.
  const needsRegenerate = useMemo(() => {
    // No axis has a checked option: `cartesianCombos([])` returns `[[]]` (the
    // empty combo is the identity element of the product, not "zero combos"),
    // which would otherwise register as one bogus "expected" signature and
    // flag staleness before the user has picked anything.
    if (activeAxes.length === 0) return false;
    const expected = new Set(cartesianCombos(activeAxes).map(sigOf));
    const present = new Set(
      variants.filter((v) => (v.options ?? []).length > 0).map((v) => sigOf(v.options ?? [])),
    );
    if (expected.size !== present.size) return true;
    for (const sig of expected) if (!present.has(sig)) return true;
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, axes, variants]);

  const generate = () => {
    if (activeAxes.length === 0) {
      toast.error(t("addOptionFirst"));
      return;
    }

    const combos = cartesianCombos(activeAxes);
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
  // Variant prices live in USD-base dollars in the form, but the saved-value
  // hint should match whatever currency that row's PriceInput is currently
  // showing (see priceCurrencyByRow above) - not raw USD.
  const fmtPrice = (fieldCurrency: Currency) => (n: unknown) =>
    formatPrice(
      convertCents(decimalToCents(Number(n)), fieldCurrency, rates[fieldCurrency] ?? 1),
      fieldCurrency,
    );

  // Saved baseline for the option pills themselves (as opposed to the saved
  // variant rows above) - what `picked` looked like right after the last
  // save, reconstructed the same way `seedPicked` derives the initial
  // selection, but from the saved baseline instead of the live form. Lets the
  // "generate from options" button surface a normal saved-value hint too,
  // the same way every other edited field in this form does, instead of only
  // the button's own "(needs regenerate)" label with nothing to compare to.
  const savedPicked: Record<string, string[]> = {};
  for (const sv of (form.formState.defaultValues?.variants ?? []) as Partial<VariantRow>[]) {
    for (const o of (sv.options ?? []) as { attributeId: string; optionId: string }[]) {
      (savedPicked[o.attributeId] ??= []).push(o.optionId);
    }
  }
  for (const k of Object.keys(savedPicked)) savedPicked[k] = [...new Set(savedPicked[k])];
  const hasSavedVariants = ((form.formState.defaultValues?.variants ?? []) as unknown[]).length > 0;
  const pickedSig = (p: Record<string, string[]>) =>
    Object.keys(p)
      .filter((k) => (p[k] ?? []).length > 0)
      .sort()
      .map((k) => `${k}:${[...p[k]].sort().join(",")}`)
      .join("|");
  const describePicked = (p: Record<string, string[]>) =>
    axes
      .map((a) => {
        const optIds = p[a.id] ?? [];
        if (optIds.length === 0) return null;
        const labels = optIds
          .map((id) => a.options.find((o) => o.id === id))
          .filter((o): o is (typeof a.options)[number] => o != null)
          .map((o) => getLabel(o.translations, locale));
        return labels.length > 0 ? `${getLabel(a.translations, locale)}: ${labels.join(", ")}` : null;
      })
      .filter((s): s is string => s != null)
      .join(" · ") || null;

  // Saved baseline for a variant's media selection, so a changed selection
  // gets the same saved-value hint as every other row field. Media items
  // have no display name, so the saved set is described by thumbnail
  // position (stable - `uploadedMedia` order doesn't change within a
  // session) rather than a name list.
  const mediaKeysSig = (keys: string[] | undefined) => [...(keys ?? [])].sort().join(",");
  const describeMediaKeys = (keys: string[] | undefined) => {
    const labels = (keys ?? [])
      .map((key) => uploadedMedia.findIndex((m) => m.key === key))
      .filter((idx) => idx >= 0)
      .sort((a, b) => a - b)
      .map((idx) => `#${idx + 1}`);
    return labels.length > 0 ? labels.join(", ") : null;
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-lg border p-4 bg-background dark:bg-input/30">
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
            variant={needsRegenerate ? "default" : "outline"}
            onClick={generate}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            {t("generateVariants")}
            {needsRegenerate && ` ${t("needsRegenerate")}`}
          </Button>
          {hasSavedVariants && (
            <ChangedHint
              changed={pickedSig(picked) !== pickedSig(savedPicked)}
              savedText={describePicked(savedPicked)}
            />
          )}
        </div>
      )}

      {/* Signals that the option selection drifted from what the current
          variants were generated from; the variant list is stale until the
          user regenerates. */}
      {needsRegenerate && (
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium" required>{t("sku")}</Label>
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
                <Label className="text-xs font-medium" required>{t("price")}</Label>
                <PriceInput
                  value={v.price}
                  onChange={(usd) => setField(i, { price: usd })}
                  rates={rates}
                  defaultCurrency={currency}
                  onCurrencyChange={(c) => setPriceCurrencyByRow((prev) => ({ ...prev, [i]: c }))}
                />
                {errMsg(i, "price") && (
                  <p className="text-xs text-destructive">{errMsg(i, "price")}</p>
                )}
                {saved?.price != null && (
                  <ChangedHint
                    changed={Number(saved.price) !== Number(v.price)}
                    savedText={fmtPrice(priceCurrencyFor(i))(saved.price)}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t("stock")}</Label>
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
                          <RetryImage src={thumb} alt="Variant media" fill sizes="64px" className="object-cover" unoptimized={thumb.startsWith("blob:")} />
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
              {saved?.mediaKeys != null && (
                <ChangedHint
                  changed={mediaKeysSig(saved.mediaKeys) !== mediaKeysSig(v.mediaKeys)}
                  savedText={describeMediaKeys(saved.mediaKeys)}
                />
              )}
            </div>
          </div>
          );
        })
      )}
    </div>
  );
}
