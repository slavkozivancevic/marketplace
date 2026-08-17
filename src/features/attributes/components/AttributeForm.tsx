"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations, useLocale } from "next-intl";
import { useFieldArray, useForm, useFormState, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { Loader2, RefreshCw, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { FieldChangedHint, ChangedHintScope } from "@/components/forms/FieldChangedHint";
import { SlugAvailabilityIndicator } from "@/components/admin/SlugAvailabilityIndicator";
import { ChangedHint } from "@/components/forms/ChangedHint";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  attributeSchema,
  ATTRIBUTE_TYPES,
  OPTION_TYPES,
  type AttributeInput,
  type AttributeTypeValue,
  type AttributeOptionInput,
} from "../schema/attributes";
import {
  createAttributeAction,
  updateAttributeAction,
} from "../actions/attributes";
import { emptyLabelTranslations } from "../utils/form";
import { slugify } from "@/lib/utils";
import { deriveOrRestore } from "@/lib/forms/deriveOrRestore";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
import {
  NON_DEFAULT_LOCALES,
  LOCALE_LABELS,
  DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/config";
import { ATTRIBUTE_EXAMPLES, withEgPrefix } from "@/i18n/form-examples";

type CreateMode = { mode: "create" };
type EditMode = { mode: "edit"; attributeId: string };
type AttributeFormProps = (CreateMode | EditMode) & {
  defaultValues?: AttributeInput;
};

function isOptionType(type: AttributeTypeValue): boolean {
  return OPTION_TYPES.includes(type);
}

// ---------- Per-locale label inputs (attribute or option) ----------

function LocaleLabelInputs({
  form,
  basePath,
  uiLocale,
  examples,
  saved,
}: {
  form: ReturnType<typeof useForm<AttributeInput>>;
  basePath: `translations` | `options.${number}.translations`;
  uiLocale: string;
  examples: Record<Locale, string>;
  /**
   * Saved baseline for the changed-hint, keyed by locale. Only needed inside
   * an option row: `<FieldChangedHint>` compares against `defaultValues` at
   * this exact array *path*, which silently breaks once an earlier option is
   * removed and everything after it shifts down an index - the hint would
   * then compare a shifted-in option's translations against some OTHER
   * option's original ones. Passing the correct saved translations here
   * (looked up by the option's own stable id, not its current index) bypasses
   * that path lookup entirely. Omit for the top-level attribute translations,
   * which aren't inside an array and have no such shifting.
   */
  saved?: Record<string, { label?: string } | undefined> | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {NON_DEFAULT_LOCALES.map((loc) => (
        <FormField
          key={loc}
          control={form.control}
          name={`${basePath}.${loc}.label` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground font-normal">
                {LOCALE_LABELS[loc].emoji} {LOCALE_LABELS[loc].label}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={withEgPrefix(uiLocale, examples[loc])}
                  className="h-8"
                />
              </FormControl>
              {saved !== undefined ? (
                <ChangedHint
                  changed={(field.value ?? "") !== (saved?.[loc]?.label ?? "")}
                  savedText={saved?.[loc]?.label || null}
                />
              ) : (
                <FieldChangedHint />
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}

// ---------- Single option row ----------

function OptionRow({
  form,
  index,
  saved,
  onRemove,
  uiLocale,
  t,
}: {
  form: ReturnType<typeof useForm<AttributeInput>>;
  index: number;
  /**
   * This option's saved baseline (found by its own stable `id`), or
   * `undefined` in create mode / for a newly-added option with no baseline
   * yet. Passed through to the label + translations hints instead of letting
   * them read `defaultValues` by array index - `options.${index}` stops
   * meaning "this option" the moment an earlier option is removed and
   * everything after it shifts down, which produced false "changed" hints
   * on every option below the deleted one.
   */
  saved: AttributeOptionInput | undefined;
  onRemove: () => void;
  uiLocale: string;
  t: ReturnType<typeof useTranslations<"adminAttributes">>;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-2.5 shrink-0" />
        <FormField
          control={form.control}
          name={`options.${index}.label` as const}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  {...field}
                  placeholder={withEgPrefix(
                    uiLocale,
                    ATTRIBUTE_EXAMPLES.option[DEFAULT_LOCALE],
                  )}
                  className="h-9"
                />
              </FormControl>
              {saved ? (
                <ChangedHint
                  changed={field.value !== saved.label}
                  savedText={saved.label || null}
                />
              ) : (
                <FieldChangedHint />
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="sr-only">{t("removeOption")}</span>
        </Button>
      </div>
      <div className="pl-6">
        <LocaleLabelInputs
          form={form}
          basePath={`options.${index}.translations`}
          uiLocale={uiLocale}
          examples={ATTRIBUTE_EXAMPLES.option}
          saved={saved ? saved.translations : undefined}
        />
      </div>
    </div>
  );
}

// ---------- Removed option placeholder (with undo) ----------

function RemovedOptionRow({
  saved,
  onRestore,
  t,
}: {
  saved: AttributeOptionInput;
  onRestore: () => void;
  t: ReturnType<typeof useTranslations<"adminAttributes">>;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-3">
      {/* Same shape/height as an active option row (label input + locale
          grid) - just inert - so removing/restoring one never shrinks and
          regrows the row. */}
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/30 mt-2.5 shrink-0" />
        <Input
          value={saved.label}
          disabled
          readOnly
          className="h-9 flex-1 text-muted-foreground line-through"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={onRestore}
        >
          {t("undo")}
        </Button>
      </div>
      <div className="pl-6 grid gap-2 sm:grid-cols-3 pointer-events-none opacity-50">
        {NON_DEFAULT_LOCALES.map((loc) => (
          <div key={loc}>
            <p className="text-xs text-muted-foreground font-normal mb-1.5">
              {LOCALE_LABELS[loc].emoji} {LOCALE_LABELS[loc].label}
            </p>
            <Input
              value={saved.translations?.[loc]?.label ?? ""}
              disabled
              readOnly
              className="h-8"
            />
          </div>
        ))}
      </div>
      {/* Status for the option as a whole (name + every translation), so it
          sits at the end of the card instead of looking tied to just the
          English label above. */}
      <p className="pl-6 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
        <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
        {t("removed")}
      </p>
    </div>
  );
}

// ---------- Main form ----------

/**
 * Discard wrapper. Remounting via a bumped key - rather than calling
 * `form.reset()` - is what makes "Discard" actually restore everything:
 * meaningful state lives OUTSIDE react-hook-form and `reset()` never touches
 * it. `keyManuallyEdited` (and the options `useFieldArray`) would survive a
 * plain reset: the values would come back but the key would stay flagged as
 * hand-edited, leaving auto-derivation off and the regenerate button hanging
 * around after a discard. A fresh mount re-reads the saved baseline and is
 * reliably clean in one step.
 *
 * (This also predates `useIsFormDirty`, which fixed the separate problem of a
 * stuck save bar - but the local-state reason above is why remounting stays.)
 */
export function AttributeForm(props: AttributeFormProps) {
  const [discardKey, setDiscardKey] = useState(0);
  return (
    <AttributeFormInner
      key={discardKey}
      {...props}
      onDiscard={() => setDiscardKey((k) => k + 1)}
    />
  );
}

function AttributeFormInner(props: AttributeFormProps & { onDiscard: () => void }) {
  const t = useTranslations("adminAttributes");
  const onInvalid = useInvalidToast();
  const uiLocale = useLocale();
  const [isPending, startTransition] = useTransition();
  // Auto-derive stays on in edit mode too, consistent with the brand/category
  // slug fields: typing a new label regenerates the key until the admin edits
  // the key by hand. The effect below only fires when the label CHANGES, so a
  // freshly opened edit form never rewrites a stored key by itself.
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);

  const derivedValues = useMemo<AttributeInput>(
    () => ({
      key: "",
      type: "SELECT",
      unit: "",
      label: "",
      translations: emptyLabelTranslations(),
      order: 0,
      options: [],
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const navGeneration = useNavigationGeneration();

  const form = useForm<AttributeInput>({
    // Validate on blur, then on change, so the message tracks the current value.
    // Validate on every change so errors surface immediately and `hasErrors`
    // can gate the save button (consistent across all admin forms).
    mode: "onChange",
    resolver: useZodResolver(attributeSchema),
    defaultValues: derivedValues,
    values: props.mode === "edit" ? derivedValues : undefined,
    // Without this, every re-render that produces a fresh `derivedValues`
    // object makes RHF fully reset the form and discard whatever is being
    // typed - intermittently, since it depends on what triggered the re-render.
    // `keepDirtyValues` re-syncs untouched fields from the server while leaving
    // edited ones alone (ProductForm has always done this).
    resetOptions: { keepDirtyValues: true },
  });

  // `form.formState.x` is a proxy getter - its value changes without the
  // `form` object's own reference ever changing, which the React Compiler's
  // memoization can't see: it treats `form` as a stable dependency and
  // caches whatever `form.formState.x` returned on the first read, leaving
  // isDirty/errors/defaultValues stuck stale after the very first render.
  // `useFormState` is a real hook call - the compiler tracks it correctly -
  // and is the react-hook-form-documented way to read formState reactively
  // (see the identical fix in VariantsEditor.tsx).
  const { errors, defaultValues: savedValues } = useFormState({
    control: form.control,
  });

  // NOT react-hook-form's `isDirty`: that flag is only recomputed inside the
  // write that triggered it, so the auto-derived key (written in a follow-up
  // step) is never accounted for and the flag stays stuck on.
  const isDirty = useIsFormDirty(form.control);

  // Create mode has no server `values` to re-sync against; reset to empty on
  // entry so a half-filled form doesn't survive leave-and-return. Keyed on the
  // navigation-generation counter, which bumps on every path change - including
  // returning to the same route (`usePathname` stays identical there and so
  // never fired the reset).
  useEffect(() => {
    if (props.mode === "create")
      // Explicit `keepDirtyValues: false`: a bare `reset()` MERGES the
      // useForm-level `resetOptions`, which would keep the half-filled values
      // this reset exists to clear.
      form.reset(derivedValues, { keepDirtyValues: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const { fields, append, remove, insert } = useFieldArray({
    control: form.control,
    name: "options",
    // Our own option objects already carry a persisted `id`; RHF's default
    // `keyName` ("id") would otherwise clobber it in `fields` with its own
    // internally-generated tracking key, making the option's real DB id
    // unreadable from `fields[i].id` right when we need it (see below).
    keyName: "_fieldId",
  });

  // Saved baseline per assigned option, keyed by its own stable `id` - NOT by
  // array index. Removing an option shifts every later index down one, and
  // react-hook-form's `<FieldChangedHint>` compares by that same shifting
  // path, so after any removal it silently starts comparing each surviving
  // option against a DIFFERENT option's original values (false "changed"
  // hints on everything below the deleted row). Rows below look this up by
  // id instead and pass the result down explicitly.
  //
  // Not `useChangedHintEnabled()`: that reads the `<ChangedHintScope>`
  // provided further down in this same component's JSX, which isn't visible
  // to this component's own top-level hook call (only to its children) - it
  // would silently read the outer default (always `true`) instead. Mirror
  // the exact value passed to `<ChangedHintScope>` below instead.
  const changedEnabled = props.mode === "edit";
  const savedByOptionId = new Map<string, AttributeOptionInput>();
  for (const o of (savedValues?.options ?? []) as AttributeOptionInput[]) {
    if (o?.id) savedByOptionId.set(o.id, o);
  }
  const fieldIndexByOptionId = new Map<string, number>();
  fields.forEach((f, i) => {
    if (f.id) fieldIndexByOptionId.set(f.id, i);
  });
  // Render order: saved options first, each in its original spot (still
  // present ones active, removed ones shown struck-through with an undo),
  // then any newly-added option appended at the end - mirrors the category
  // attributes editor so a deleted option never jumps position and the
  // saved order is exactly reconstructible once everything is restored.
  const orderedOptionRows: Array<
    | { kind: "active"; index: number }
    | { kind: "removed"; saved: AttributeOptionInput }
  > = [];
  for (const [id, saved] of savedByOptionId.entries()) {
    const idx = fieldIndexByOptionId.get(id);
    if (idx !== undefined) orderedOptionRows.push({ kind: "active", index: idx });
    else if (changedEnabled) orderedOptionRows.push({ kind: "removed", saved });
  }
  fields.forEach((f, i) => {
    if (!f.id || !savedByOptionId.has(f.id)) orderedOptionRows.push({ kind: "active", index: i });
  });

  // Restoring via `append` would drop the option at the *end* of the array -
  // values would match the saved baseline again, but the array order
  // wouldn't, which is enough for react-hook-form's isDirty to stay
  // (incorrectly) true. `insert` at the position it would occupy among the
  // currently-present saved options reconstructs the original array order
  // once every removed option is restored, so the form goes truly clean.
  const restoreOption = (saved: AttributeOptionInput) => {
    const originalOrder = (savedValues?.options ?? []) as AttributeOptionInput[];
    const originalIndex = originalOrder.findIndex((o) => o?.id === saved.id);
    const insertAt = originalOrder
      .slice(0, originalIndex)
      .filter((o) => o?.id && fields.some((f) => f.id === o.id))
      .length;
    insert(insertAt, { ...saved });
  };

  const type = useWatch({ control: form.control, name: "type" });
  const labelValue = useWatch({ control: form.control, name: "label" });
  const keyValue = useWatch({ control: form.control, name: "key" });

  // Auto-derive the machine key from the default label until the admin edits it.
  const prevLabelRef = useRef(form.getValues("label"));
  useEffect(() => {
    if (keyManuallyEdited) return;
    if (labelValue === prevLabelRef.current) return;
    prevLabelRef.current = labelValue;
    const saved = savedValues;
    form.setValue(
      "key",
      deriveOrRestore(labelValue, saved?.label, saved?.key, slugify),
      { shouldDirty: true },
    );
    // `savedValues` is deliberately NOT a dependency: it's read as the saved
    // baseline, and re-running this on a baseline re-sync would rewrite the
    // key without the user having touched the label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelValue, keyManuallyEdited, form]);

  // What auto-derivation would produce right now. Must be `deriveOrRestore`,
  // NOT a bare `slugify`: while the label still matches what was saved, the
  // auto value IS the saved key (suffix and all). Using `slugify` here made the
  // button hand back an un-suffixed key the saved record already owns -
  // regenerating walked straight into "already in use".
  const autoKey = deriveOrRestore(
    labelValue,
    savedValues?.label,
    savedValues?.key,
    slugify,
  );
  const canRegenerateKey = keyManuallyEdited && (keyValue ?? "") !== autoKey;

  useUnsavedChangesWarning(props.mode === "edit" && isDirty);

  // Block saving while any field is invalid (error-based, so a freshly-loaded
  // valid attribute isn't disabled before the first validation runs).
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = (data: AttributeInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateAttributeAction(props.attributeId, data)
          : await createAttributeAction(data);
      if (result && "error" in result) toast.error(result.message);
    });
  };

  const showOptions = isOptionType(type);
  const showUnit = type === "RANGE";

  return (
    <Form {...form}>
      <ChangedHintScope enabled={props.mode === "edit"}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="space-y-6 max-w-2xl"
      >
        <RequiredFieldsNote />
        {/* Default locale label + key */}
        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {LOCALE_LABELS[DEFAULT_LOCALE].emoji}{" "}
            {LOCALE_LABELS[DEFAULT_LOCALE].label}
          </p>

          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t("label")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={withEgPrefix(
                      uiLocale,
                      ATTRIBUTE_EXAMPLES.label[DEFAULT_LOCALE],
                    )}
                  />
                </FormControl>
                <FormDescription>{t("labelDesc")}</FormDescription>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("key")}</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      className="font-mono text-sm"
                      placeholder="screen-size"
                      onChange={(e) => {
                        field.onChange(e);
                        // An emptied field means "I have no manual value" - hand
                        // the key back to auto-derivation instead of latching
                        // the manual flag on forever.
                        setKeyManuallyEdited(e.target.value.trim() !== "");
                      }}
                    />
                  </FormControl>
                  {canRegenerateKey && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setValue("key", autoKey, { shouldDirty: true });
                        setKeyManuallyEdited(false);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <FormDescription>{t("keyDesc")}</FormDescription>
                  {/* `Attribute.key` is globally unique, so no locale is passed.
                      Create auto-suffixes a collision; edit must not rewrite an
                      existing key, so there the conflict is a hard stop. */}
                  <SlugAvailabilityIndicator
                    entity="attribute"
                    slug={field.value}
                    excludeId={props.mode === "edit" ? props.attributeId : undefined}
                    autoResolves={props.mode !== "edit"}
                  />
                </div>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Per-locale label translations */}
          <LocaleLabelInputs
            form={form}
            basePath="translations"
            uiLocale={uiLocale}
            examples={ATTRIBUTE_EXAMPLES.label}
          />
        </div>

        {/* Type + unit */}
        <div className="flex flex-wrap gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="flex-1 min-w-48">
                <FormLabel>{t("type")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ATTRIBUTE_TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>
                        {t(`type_${ty}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{t(`typeDesc_${field.value}`)}</FormDescription>
                <FieldChangedHint format={(v) => t(`type_${v as AttributeTypeValue}`)} />
                <FormMessage />
              </FormItem>
            )}
          />

          {showUnit && (
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel>{t("unit")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={t("unitPlaceholder")}
                    />
                  </FormControl>
                  <FormDescription>{t("unitDesc")}</FormDescription>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Options editor */}
        {showOptions && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FormLabel required>{t("options")}</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    label: "",
                    value: "",
                    translations: emptyLabelTranslations(),
                    order: fields.length,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addOption")}
              </Button>
            </div>
            {orderedOptionRows.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                {t("noOptions")}
              </p>
            ) : (
              <div className="space-y-2">
                {orderedOptionRows.map((row) => {
                  if (row.kind === "removed") {
                    return (
                      <RemovedOptionRow
                        key={`removed-${row.saved.id}`}
                        saved={row.saved}
                        onRestore={() => restoreOption(row.saved)}
                        t={t}
                      />
                    );
                  }
                  const f = fields[row.index];
                  return (
                    <OptionRow
                      key={f._fieldId}
                      form={form}
                      index={row.index}
                      saved={f.id ? savedByOptionId.get(f.id) : undefined}
                      onRemove={() => remove(row.index)}
                      uiLocale={uiLocale}
                      t={t}
                    />
                  );
                })}
              </div>
            )}
            {errors.options?.message && (
              <p className="text-sm text-destructive">
                {errors.options.message}
              </p>
            )}
          </div>
        )}

        {/* Order */}
        <FormField
          control={form.control}
          name="order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("order")}</FormLabel>
              <FormControl>
                <NumberStepper
                  min={0}
                  className="w-32"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                />
              </FormControl>
              <FormDescription>{t("orderDesc")}</FormDescription>
              <FieldChangedHint />
              <FormMessage />
            </FormItem>
          )}
        />

        {props.mode === "edit" ? (
          <FormSaveBar
            isDirty={isDirty}
            isPending={isPending}
            onDiscard={props.onDiscard}
            saveLabel={t("saveChanges")}
            saveDisabled={hasErrors}
          />
        ) : (
          <Button type="submit" disabled={isPending || hasErrors} className="min-w-32">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t("create")
            )}
          </Button>
        )}
      </form>
      </ChangedHintScope>
    </Form>
  );
}
