"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations, useLocale } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { Loader2, RefreshCw, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { FieldChangedHint, ChangedHintScope } from "@/components/forms/FieldChangedHint";
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
} from "../schema/attributes";
import {
  createAttributeAction,
  updateAttributeAction,
} from "../actions/attributes";
import { emptyLabelTranslations } from "../utils/form";
import { slugify } from "@/lib/utils";
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
}: {
  form: ReturnType<typeof useForm<AttributeInput>>;
  basePath: `translations` | `options.${number}.translations`;
  uiLocale: string;
  examples: Record<Locale, string>;
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
              <FieldChangedHint />
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
  onRemove,
  uiLocale,
  t,
}: {
  form: ReturnType<typeof useForm<AttributeInput>>;
  index: number;
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
              <FieldChangedHint />
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
        />
      </div>
    </div>
  );
}

// ---------- Main form ----------

/**
 * Discard wrapper. react-hook-form's `reset()` leaves `isDirty` spuriously true
 * when a `useFieldArray` (the options list) is mounted - the array re-registers
 * after the reset and re-flags the form dirty, so the save bar never clears.
 * Instead of fighting that, "Discard" remounts the form via a bumped key: a
 * fresh mount re-reads the saved baseline and is reliably clean.
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
  });

  // Create mode has no server `values` to re-sync against; reset to empty on
  // entry so a half-filled form doesn't survive leave-and-return. Keyed on the
  // navigation-generation counter, which bumps on every path change - including
  // returning to the same route (`usePathname` stays identical there and so
  // never fired the reset).
  useEffect(() => {
    if (props.mode === "create") form.reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const type = useWatch({ control: form.control, name: "type" });
  const labelValue = useWatch({ control: form.control, name: "label" });

  // Auto-derive the machine key from the default label until the admin edits it.
  const prevLabelRef = useRef(form.getValues("label"));
  useEffect(() => {
    if (keyManuallyEdited) return;
    if (labelValue === prevLabelRef.current) return;
    prevLabelRef.current = labelValue;
    form.setValue("key", slugify(labelValue ?? ""), { shouldDirty: true });
  }, [labelValue, keyManuallyEdited, form]);

  useUnsavedChangesWarning(props.mode === "edit" && form.formState.isDirty);

  // Block saving while any field is invalid (error-based, so a freshly-loaded
  // valid attribute isn't disabled before the first validation runs).
  const hasErrors = Object.keys(form.formState.errors).length > 0;

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
                        setKeyManuallyEdited(true);
                      }}
                    />
                  </FormControl>
                  {keyManuallyEdited && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setValue(
                          "key",
                          slugify(form.getValues("label") ?? ""),
                        );
                        setKeyManuallyEdited(false);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <FormDescription>{t("keyDesc")}</FormDescription>
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
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                {t("noOptions")}
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((f, index) => (
                  <OptionRow
                    key={f.id}
                    form={form}
                    index={index}
                    onRemove={() => remove(index)}
                    uiLocale={uiLocale}
                    t={t}
                  />
                ))}
              </div>
            )}
            {form.formState.errors.options?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.options.message}
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
            isDirty={form.formState.isDirty}
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
