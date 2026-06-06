"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "@/components/ui/sonner";
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

export function AttributeForm(props: AttributeFormProps) {
  const t = useTranslations("adminAttributes");
  const uiLocale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(
    props.mode === "edit",
  );

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

  const form = useForm<AttributeInput>({
    resolver: zodResolver(attributeSchema),
    defaultValues: derivedValues,
    values: props.mode === "edit" ? derivedValues : undefined,
  });

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
    form.setValue("key", slugify(labelValue ?? ""), { shouldDirty: false });
  }, [labelValue, keyManuallyEdited, form]);

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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-2xl"
      >
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
                <FormLabel>{t("label")}</FormLabel>
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
                  {keyManuallyEdited && props.mode === "create" && (
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
              <FormLabel>{t("options")}</FormLabel>
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
                <Input
                  type="number"
                  min={0}
                  className="w-32"
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : e.target.valueAsNumber,
                    )
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormDescription>{t("orderDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {props.mode === "edit" ? t("saving") : t("creating")}
            </>
          ) : props.mode === "edit" ? (
            t("saveChanges")
          ) : (
            t("create")
          )}
        </Button>
      </form>
    </Form>
  );
}
