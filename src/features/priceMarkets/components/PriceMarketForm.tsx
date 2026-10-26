"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { setFlash } from "@/lib/navigation/flash";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { useHasFormErrors, useSaveBlockedReason } from "@/lib/forms/useSaveBlockedReason";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRICE_MARKET_EXAMPLES, withEgPrefix } from "@/i18n/form-examples";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "@/i18n/config";
import { priceMarketSchema, type PriceMarketInput } from "../schema/priceMarkets";
import { createPriceMarketAction, updatePriceMarketAction } from "../actions/priceMarkets";
import { CountryMultiSelect } from "./CountryMultiSelect";

function emptyTranslations(): NonNullable<PriceMarketInput["translations"]> {
  const out: Record<string, { name?: string }> = {};
  for (const loc of NON_DEFAULT_LOCALES) out[loc] = { name: "" };
  return out;
}

type Shared = {
  /** Code -> name of the other market that owns it; those cannot be picked. */
  takenBy: Readonly<Record<string, string>>;
};
type CreateMode = Shared & { mode: "create" };
type EditMode = Shared & {
  mode: "edit";
  marketId: string;
  isDefault: boolean;
  defaultValues: PriceMarketInput;
};
type PriceMarketFormProps = CreateMode | EditMode;

/** Discard wrapper: remounting on a bumped key keeps "Discard" honest, as in TagForm. */
export function PriceMarketForm(props: PriceMarketFormProps) {
  const [discardKey, setDiscardKey] = useState(0);
  return (
    <PriceMarketFormInner key={discardKey} {...props} onDiscard={() => setDiscardKey((k) => k + 1)} />
  );
}

function PriceMarketFormInner(props: PriceMarketFormProps & { onDiscard: () => void }) {
  const t = useTranslations("priceMarkets");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isDefault = props.mode === "edit" && props.isDefault;

  const derivedValues = useMemo<PriceMarketInput>(
    () =>
      props.mode === "edit"
        ? props.defaultValues
        : { name: "", translations: emptyTranslations(), countries: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode === "edit" ? props.defaultValues : null],
  );

  const navGeneration = useNavigationGeneration();

  const form = useForm<PriceMarketInput>({
    mode: "onChange",
    resolver: useZodResolver(priceMarketSchema),
    defaultValues: derivedValues,
    values: props.mode === "edit" ? derivedValues : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  // A real hook call keeps the formState flags live under the React Compiler -
  // see TrustPointForm.
  useFormState({ control: form.control });

  const isDirty = useIsFormDirty(form.control);
  useUnsavedChangesWarning(isDirty);

  // Create mode has no server values to re-sync against, so a half-filled form
  // would survive leaving and returning. Keyed on the navigation generation,
  // never on the pathname, which is identical on return.
  useEffect(() => {
    if (props.mode === "create") form.reset(derivedValues, { keepDirtyValues: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const hasErrors = useHasFormErrors(form.control);
  const saveBlockedReason = useSaveBlockedReason(form.control);
  const defaultName = useWatch({ control: form.control, name: "name" });

  const onSubmit = (data: PriceMarketInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updatePriceMarketAction(props.marketId, data)
          : await createPriceMarketAction(data);
      if (result && "error" in result) {
        toast.error(result.message);
        return;
      }
      // Queued, not raised: the transition stays pending through the navigation,
      // and FlashHost raises it where the result is visible - the list.
      const target = `/${locale}${result.redirectTo}`;
      setFlash(t(props.mode === "edit" ? "updated" : "created"), { path: target });
      router.push(target);
    });
  };

  return (
    <Form {...form}>
      <ChangedHintScope enabled={props.mode === "edit"}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6 max-w-2xl">
          <RequiredFieldsNote />

          <div className="rounded-lg border border-border/60 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {LOCALE_LABELS[DEFAULT_LOCALE].emoji} {LOCALE_LABELS[DEFAULT_LOCALE].label}
            </p>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={withEgPrefix(locale, PRICE_MARKET_EXAMPLES.name[DEFAULT_LOCALE])}
                      {...field}
                    />
                  </FormControl>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* A locale left blank falls back to the default name. */}
          {NON_DEFAULT_LOCALES.map((loc) => (
            <div key={loc} className="rounded-lg border border-border/60 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {LOCALE_LABELS[loc].emoji} {LOCALE_LABELS[loc].label}
              </p>
              <FormField
                control={form.control}
                name={`translations.${loc}.name` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={defaultName || withEgPrefix(locale, PRICE_MARKET_EXAMPLES.name[loc])}
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

          <div className="rounded-lg border border-border/60 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("countries")}
            </p>
            {isDefault ? (
              // Not a field at all: listing countries here would be a second way
              // of saying what "not in any other market" already says.
              <p className="text-sm text-muted-foreground">{t("defaultCountriesNote")}</p>
            ) : (
              <FormField
                control={form.control}
                name="countries"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t("countries")}</FormLabel>
                    <FormControl>
                      <CountryMultiSelect
                        value={field.value}
                        onChange={field.onChange}
                        takenBy={props.takenBy}
                        aria-invalid={fieldState.invalid}
                      />
                    </FormControl>
                    <FormDescription>{t("countriesDesc")}</FormDescription>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
