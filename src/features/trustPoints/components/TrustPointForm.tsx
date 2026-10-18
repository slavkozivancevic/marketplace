"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { setFlash } from "@/lib/navigation/flash";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import {
  useHasFormErrors,
  useSaveBlockedReason,
} from "@/lib/forms/useSaveBlockedReason";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { SaveBlockedNotice } from "@/components/forms/SaveBlockedNotice";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRUST_POINT_EXAMPLES, withEgPrefix } from "@/i18n/form-examples";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "@/i18n/config";
import {
  createTrustPointSchema,
  updateTrustPointSchema,
  type CreateTrustPointInput,
  type UpdateTrustPointInput,
} from "../schema/trustPoints";
import {
  createTrustPointAction,
  updateTrustPointAction,
} from "../actions/trustPoints";
import {
  TRUST_POINT_FALLBACK_ICON,
  TRUST_POINT_ICONS,
  TRUST_POINT_ICON_KEYS,
} from "../icons";

function emptyTranslations(): NonNullable<CreateTrustPointInput["translations"]> {
  const out: Record<string, { label?: string; sublabel?: string }> = {};
  for (const loc of NON_DEFAULT_LOCALES) out[loc] = { label: "", sublabel: "" };
  return out;
}

type CreateMode = { mode: "create"; defaultValues?: Partial<CreateTrustPointInput> };
type EditMode = {
  mode: "edit";
  trustPointId: string;
  defaultValues: UpdateTrustPointInput;
};
type TrustPointFormProps = CreateMode | EditMode;

/**
 * Discard wrapper. Remounting on a bumped key rather than calling
 * `form.reset()` keeps "Discard" honest - the same reason TagForm does it, and
 * it costs nothing here.
 */
export function TrustPointForm(props: TrustPointFormProps) {
  const [discardKey, setDiscardKey] = useState(0);
  return (
    <TrustPointFormInner
      key={discardKey}
      {...props}
      onDiscard={() => setDiscardKey((k) => k + 1)}
    />
  );
}

function TrustPointFormInner(props: TrustPointFormProps & { onDiscard: () => void }) {
  const t = useTranslations("trustPoints");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const derivedValues = useMemo<CreateTrustPointInput>(
    () => ({
      label: "",
      sublabel: "",
      icon: "shield",
      order: 0,
      isActive: true,
      translations: emptyTranslations(),
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const navGeneration = useNavigationGeneration();

  const form = useForm<CreateTrustPointInput>({
    mode: "onChange",
    resolver: useZodResolver(
      props.mode === "create" ? createTrustPointSchema : updateTrustPointSchema,
    ),
    defaultValues: derivedValues,
    // Edit mode re-syncs when the underlying row changes (Next can keep the
    // route's React tree warm across a navigation away and back).
    values: props.mode === "edit" ? derivedValues : undefined,
    // Without this, a re-render producing a fresh `derivedValues` object makes
    // RHF reset the form and discard whatever is being typed.
    resetOptions: { keepDirtyValues: true },
  });

  // `form.formState.x` is a proxy getter whose value changes without `form`'s
  // own reference changing, which the React Compiler cannot see - it caches the
  // first read and the flags freeze. `useFormState` is a real hook call and
  // stays live. Same fix as VariantsEditor / TagForm.
  useFormState({ control: form.control });

  // NOT react-hook-form's `isDirty`: that flag is only recomputed inside the
  // write that triggered it.
  const isDirty = useIsFormDirty(form.control);
  useUnsavedChangesWarning(isDirty);

  // Create mode has no server-supplied `values` to re-sync against, so a
  // half-filled form would survive leaving and returning. Keyed on the
  // navigation-generation counter, never `usePathname` - returning to the same
  // route leaves the pathname identical.
  useEffect(() => {
    if (props.mode === "create")
      // Explicit `keepDirtyValues: false`: a bare `reset()` merges the
      // useForm-level `resetOptions`, which would keep the very values this
      // reset exists to clear.
      form.reset(derivedValues, { keepDirtyValues: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const hasErrors = useHasFormErrors(form.control);
  const saveBlockedReason = useSaveBlockedReason(form.control);

  // What a blank translation will actually display: the default locale's text.
  // Watched so each translated section can hint with it, the way TagForm and
  // CategoryForm do - a placeholder that previews the fallback beats one that
  // invents an unrelated example.
  const defaultLabel = useWatch({ control: form.control, name: "label" });
  const defaultSublabel = useWatch({ control: form.control, name: "sublabel" });

  const onSubmit = (data: CreateTrustPointInput | UpdateTrustPointInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateTrustPointAction(props.trustPointId, data)
          : await createTrustPointAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
        return;
      }
      // Queued, not raised. The transition stays pending through the navigation
      // that follows, so a toast raised here would sit beside a button still
      // spinning. FlashHost raises it where the result is visible - the list.
      const target = `/${locale}${result.redirectTo}`;
      setFlash(t(props.mode === "edit" ? "updated" : "created"), { path: target });
      router.push(target);
    });
  };

  return (
    <Form {...form}>
      <ChangedHintScope enabled={props.mode === "edit"}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="space-y-6 max-w-2xl"
        >
          <RequiredFieldsNote />

          {/* Default locale (canonical) */}
          <div className="rounded-lg border border-border/60 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {LOCALE_LABELS[DEFAULT_LOCALE].emoji} {LOCALE_LABELS[DEFAULT_LOCALE].label}
            </p>
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("label")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={withEgPrefix(
                        locale,
                        TRUST_POINT_EXAMPLES.label[DEFAULT_LOCALE],
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sublabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sublabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={withEgPrefix(
                        locale,
                        TRUST_POINT_EXAMPLES.sublabel[DEFAULT_LOCALE],
                      )}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* One section per non-default locale. No slug machinery here - a
              trust point has no URL, so a translated label is all a locale
              adds. A locale left blank simply falls back to the default. */}
          {NON_DEFAULT_LOCALES.map((loc) => (
            <div key={loc} className="rounded-lg border border-border/60 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {LOCALE_LABELS[loc].emoji} {LOCALE_LABELS[loc].label}
              </p>
              <FormField
                control={form.control}
                name={`translations.${loc}.label` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("label")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          defaultLabel || withEgPrefix(locale, TRUST_POINT_EXAMPLES.label[loc])
                        }
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`translations.${loc}.sublabel` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("sublabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          defaultSublabel ||
                          withEgPrefix(locale, TRUST_POINT_EXAMPLES.sublabel[loc])
                        }
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}

          {/* Presentation: which icon, where in the row, and whether it shows
              at all. Not per-locale - these are the same in every language. */}
          <div className="rounded-lg border border-border/60 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("presentation")}
            </p>
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("icon")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRUST_POINT_ICON_KEYS.map((key) => {
                        const Icon = TRUST_POINT_ICONS[key] ?? TRUST_POINT_FALLBACK_ICON;
                        return (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {key}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("order")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      max={999}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        // Null, not NaN: an emptied field is "required", and
                        // `valueAsNumber` would report it as a type error.
                        const raw = e.target.value.trim();
                        if (raw === "") return field.onChange(null);
                        const parsed = Number.parseInt(raw, 10);
                        field.onChange(Number.isNaN(parsed) ? null : parsed);
                      }}
                    />
                  </FormControl>
                  <FormDescription>{t("orderDesc")}</FormDescription>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5 pr-4">
                    <FormLabel>{t("activeLabel")}</FormLabel>
                    <FormDescription>{t("activeDesc")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {props.mode === "edit" ? (
            <FormSaveBar
              isDirty={isDirty}
              isPending={isPending}
              onDiscard={props.onDiscard}
              saveLabel={t("saveChanges")}
              saveDisabled={hasErrors}
              saveDisabledReason={saveBlockedReason}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
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
              <SaveBlockedNotice blocked={hasErrors} reason={saveBlockedReason} />
            </div>
          )}
        </form>
      </ChangedHintScope>
    </Form>
  );
}
