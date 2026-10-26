"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFormState } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { setFlash } from "@/lib/navigation/flash";
import { useZodResolver } from "@/i18n/useZodResolver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { useHasFormErrors, useSaveBlockedReason } from "@/lib/forms/useSaveBlockedReason";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { SaveBlockedNotice } from "@/components/forms/SaveBlockedNotice";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { MoneyField } from "@/components/forms/MoneyField";
import { useCurrencyStore } from "@/store/currency";
import { emptyMoneyInput } from "@/lib/money-input";
import type { MoneySet } from "@/lib/money";
import { CountrySelect } from "@/features/products/components/CountrySelect";
import {
  PRICE_ADJUSTMENT_TYPES,
  PRICE_OCCURRENCE_MAX_MINUTES,
  PRICE_RECURRENCES,
  PRICE_REGION_SCOPES,
  PRICE_RULE_KINDS,
  PRICE_WINDOW_MIN_MINUTES,
  priceRuleSchema,
  type PriceRuleInput,
} from "../schema/priceRules";
import { addCivilDays, zonedParts } from "../engine/timezone";
import { createPriceRule, updatePriceRule } from "../actions/priceRules";
import { clearRouteShape } from "@/lib/navigation/routeShape";
import { priceRuleShapeKey } from "./PriceRuleFormSkeleton";

const DEFAULT_TZ = "Europe/Belgrade";
const pad = (n: number) => String(n).padStart(2, "0");

/** A fresh rule: 10% off for the coming week, starting at the next full hour. */
function blankInput(currency: PriceRuleInput["amount"]["currency"]): PriceRuleInput {
  const now = zonedParts(Date.now(), DEFAULT_TZ);
  const hour = Math.min(23, Math.floor(now.minuteOfDay / 60) + 1);
  const end = addCivilDays(now, 7);
  return {
    kind: "SCHEDULE",
    regionScope: "MARKET",
    marketId: null,
    countryCode: null,
    name: "",
    variantId: null,
    adjustment: "PERCENT",
    percentBps: -1000,
    amount: emptyMoneyInput(currency),
    priority: 0,
    active: true,
    timezone: DEFAULT_TZ,
    recurrence: "NONE",
    startDate: `${now.year}-${pad(now.month)}-${pad(now.day)}`,
    startTime: `${pad(hour)}:00`,
    endDate: `${end.year}-${pad(end.month)}-${pad(end.day)}`,
    endTime: "23:59",
    durationMinutes: 120,
    weekdays: [],
    monthDay: 1,
  };
}

export type PriceRuleFormProps = {
  productId: string;
  /** Locale-less path of the rules list - where a save lands. */
  listPath: string;
  variants: { id: string; sku: string }[];
  /** The platform's markets, named in the viewer's language. */
  markets: { id: string; name: string; isDefault: boolean }[];
  /** Country code -> name of the market it is in; unmapped ones are in the default. */
  countryMarket: Record<string, string>;
  defaultMarketName: string;
  /** Present when editing. */
  rule?: { id: string; input: PriceRuleInput; storedAmount: MoneySet | null };
};

export function PriceRuleForm({
  productId,
  listPath,
  variants,
  markets,
  countryMarket,
  defaultMarketName,
  rule,
}: PriceRuleFormProps) {
  const t = useTranslations("priceRules");
  const locale = useLocale();
  const router = useRouter();
  const onInvalid = useInvalidToast();
  const { rates, currency } = useCurrencyStore();
  const [isPending, start] = useTransition();

  const derivedValues = useMemo<PriceRuleInput>(
    () => rule?.input ?? blankInput(currency),
    [rule, currency],
  );

  const { register, handleSubmit, watch, setValue, reset, clearErrors, control } =
    useForm<PriceRuleInput>({
      mode: "onChange",
      resolver: useZodResolver(priceRuleSchema),
      defaultValues: derivedValues,
    });
  const { errors, isDirty } = useFormState({ control });
  const hasErrors = useHasFormErrors(control);
  const saveBlockedReason = useSaveBlockedReason(control);
  useUnsavedChangesWarning(isDirty);

  // The skeleton has drawn from the shape the rules table handed over; the
  // real form is here now, so drop it - a later visit by URL must not reuse it.
  useEffect(() => {
    if (rule) clearRouteShape(priceRuleShapeKey(rule.id));
  }, [rule]);

  // Reset on every entry to the route, not on pathname - see CouponForm.
  const navGeneration = useNavigationGeneration();
  useEffect(() => {
    reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const kind = watch("kind");
  const regionScope = watch("regionScope");
  const marketId = watch("marketId");
  const countryCode = watch("countryCode");
  const adjustment = watch("adjustment");
  const recurrence = watch("recurrence");
  const percentBps = watch("percentBps");
  const amount = watch("amount");
  const variantId = watch("variantId");
  const timezone = watch("timezone");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const durationMinutes = watch("durationMinutes");
  const weekdays = watch("weekdays");
  const monthDay = watch("monthDay");
  const priority = watch("priority");
  const active = watch("active");

  const set = <K extends keyof PriceRuleInput>(key: K, value: PriceRuleInput[K]) =>
    setValue(key, value as never, { shouldDirty: true, shouldValidate: true });

  const timeZones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const weekdayLabels = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    // 2024-01-01 was a Monday, so day i is ISO weekday i.
    return [1, 2, 3, 4, 5, 6, 7].map((i) => ({ value: i, label: f.format(new Date(Date.UTC(2024, 0, i))) }));
  }, [locale]);

  const onSubmit = (data: PriceRuleInput) => {
    start(async () => {
      const res = rule
        ? await updatePriceRule(rule.id, data, listPath)
        : await createPriceRule(productId, data, listPath);
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      const target = `/${locale}${res.redirectTo}`;
      setFlash(t(rule ? "updated" : "created"), { path: target });
      router.push(target);
    });
  };

  const fieldError = (msg?: string) =>
    msg ? <p className="text-xs text-destructive">{msg}</p> : null;

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="max-w-2xl space-y-5">
      <RequiredFieldsNote />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("form.kind")}</Label>
          {/* Fixed once created: a schedule rule and a market rule are different
              things, and the server refuses the switch as well. */}
          <Select
            value={kind}
            disabled={!!rule}
            onValueChange={(v) => {
              set("kind", v as PriceRuleInput["kind"]);
              clearErrors();
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRICE_RULE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{t(`form.kinds.${k}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t(`form.kindHint.${kind}`)}</p>
          {/* Locked, so it says why rather than just greying out. */}
          {rule && <p className="text-xs text-muted-foreground">{t("form.kindLocked")}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rule-name" required>{t("form.name")}</Label>
        <Input id="rule-name" {...register("name")} autoComplete="off" aria-invalid={!!errors.name} />
        <p className="text-xs text-muted-foreground">{t("form.nameHint")}</p>
        {fieldError(errors.name?.message)}
      </div>

      {kind === "REGION" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <div className="space-y-1.5">
            <Label>{t("form.regionScope")}</Label>
            <Select
              value={regionScope}
              onValueChange={(v) => {
                set("regionScope", v as PriceRuleInput["regionScope"]);
                clearErrors(["marketId", "countryCode"]);
              }}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICE_REGION_SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`form.regionScopes.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {regionScope === "MARKET" ? (
            <div className="space-y-1.5">
              <Label required>{t("form.market")}</Label>
              <Select value={marketId ?? ""} onValueChange={(v) => set("marketId", v)}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.marketId}>
                  <SelectValue placeholder={t("form.marketPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.isDefault ? t("form.defaultMarket", { name: m.name }) : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError(errors.marketId?.message)}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label required>{t("form.country")}</Label>
              <CountrySelect
                value={countryCode}
                onChange={(code) => set("countryCode", code)}
                aria-invalid={!!errors.countryCode}
                labels={{
                  none: t("form.countryPlaceholder"),
                  clear: t("form.countryClear"),
                  search: t("form.countrySearch"),
                  empty: t("form.countryEmpty"),
                }}
                hint={(code) => countryMarket[code] ?? defaultMarketName}
              />
              {fieldError(errors.countryCode?.message)}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("form.appliesTo")}</Label>
          <Select value={variantId ?? "__product"} onValueChange={(v) => set("variantId", v === "__product" ? null : v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__product">{t("wholeProduct")}</SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>{t("variant", { sku: v.sku })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("form.changeType")}</Label>
          <Select
            value={adjustment}
            onValueChange={(v) => {
              set("adjustment", v as PriceRuleInput["adjustment"]);
              clearErrors(v === "PERCENT" ? "amount" : "percentBps");
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRICE_ADJUSTMENT_TYPES.map((a) => (
                <SelectItem key={a} value={a}>{t(`form.adjustment.${a}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {adjustment === "PERCENT" ? (
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="rule-percent" required>{t("form.percent")}</Label>
          <NumberStepper
            id="rule-percent"
            aria-invalid={!!errors.percentBps}
            step={1}
            value={Number.isFinite(percentBps) ? percentBps / 100 : 0}
            onChange={(v) => set("percentBps", Math.round((v ?? 0) * 100))}
          />
          <p className="text-xs text-muted-foreground">{t("form.percentHint")}</p>
          {fieldError(errors.percentBps?.message)}
        </div>
      ) : (
        <div className="space-y-1.5 max-w-sm">
          <Label required>{adjustment === "FIXED_PRICE" ? t("form.fixedPrice") : t("form.amountOff")}</Label>
          <MoneyField
            aria-invalid={!!errors.amount?.amount}
            value={amount ?? emptyMoneyInput(currency)}
            onChange={(next) => set("amount", next)}
            rates={rates}
            stored={rule?.storedAmount ?? null}
            preferredCurrency={currency}
            showDerived
          />
          {fieldError(errors.amount?.amount?.message)}
        </div>
      )}

      {kind === "SCHEDULE" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("form.repeat")}</Label>
              <Select value={recurrence} onValueChange={(v) => set("recurrence", v as PriceRuleInput["recurrence"])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICE_RECURRENCES.map((r) => (
                    <SelectItem key={r} value={r}>{t(`form.recurrence.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recurrence !== "NONE" && (
                <p className="text-xs text-muted-foreground">{t("form.recurringStrikeNote")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("form.timezone")}</Label>
              <Select value={timezone} onValueChange={(v) => set("timezone", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timeZones.map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError(errors.timezone?.message)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <Label required>{recurrence === "NONE" ? t("form.startDate") : t("form.seriesStart")}</Label>
              <DatePicker value={startDate} onChange={(v) => set("startDate", v ?? "")} />
              {fieldError(errors.startDate?.message)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-start-time" required>{recurrence === "NONE" ? t("form.startTime") : t("form.dailyStartTime")}</Label>
              <TimePicker
                id="rule-start-time"
                value={startTime}
                onChange={(v) => set("startTime", v)}
                invalid={!!errors.startTime}
              />
              {fieldError(errors.startTime?.message)}
            </div>
          </div>

          {recurrence === "NONE" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div className="space-y-1.5">
                <Label required>{t("form.endDate")}</Label>
                <DatePicker value={endDate} onChange={(v) => set("endDate", v)} />
                {fieldError(errors.endDate?.message)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-end-time" required>{t("form.endTime")}</Label>
                <TimePicker
                  id="rule-end-time"
                  value={endTime}
                  onChange={(v) => set("endTime", v)}
                  invalid={!!errors.endTime}
                />
                {fieldError(errors.endTime?.message)}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-duration" required>{t("form.duration")}</Label>
                  <NumberStepper
                    id="rule-duration"
                    aria-invalid={!!errors.durationMinutes}
                    step={15}
                    min={PRICE_WINDOW_MIN_MINUTES}
                    max={PRICE_OCCURRENCE_MAX_MINUTES}
                    value={durationMinutes}
                    onChange={(v) => set("durationMinutes", v)}
                  />
                  {fieldError(errors.durationMinutes?.message)}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("form.seriesEnd")}</Label>
                  <DatePicker
                    value={endDate}
                    onChange={(v) => set("endDate", v)}
                    placeholder={t("form.noEnd")}
                  />
                  {fieldError(errors.endDate?.message)}
                </div>
              </div>

              {recurrence === "WEEKLY" && (
                <div className="space-y-1.5">
                  <Label required>{t("form.weekdays")}</Label>
                  <div className="flex flex-wrap gap-4">
                    {weekdayLabels.map((d) => (
                      <label key={d.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={weekdays.includes(d.value)}
                          onCheckedChange={(c) =>
                            set(
                              "weekdays",
                              c ? [...weekdays, d.value] : weekdays.filter((w) => w !== d.value),
                            )
                          }
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                  {fieldError(errors.weekdays?.message)}
                </div>
              )}

              {recurrence === "MONTHLY" && (
                <div className="space-y-1.5 max-w-xs">
                  <Label htmlFor="rule-month-day" required>{t("form.monthDay")}</Label>
                  <NumberStepper
                    id="rule-month-day"
                    aria-invalid={!!errors.monthDay}
                    min={1}
                    max={31}
                    value={monthDay}
                    onChange={(v) => set("monthDay", v)}
                  />
                  <p className="text-xs text-muted-foreground">{t("form.monthDayHint")}</p>
                  {fieldError(errors.monthDay?.message)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="rule-priority">{t("form.priority")}</Label>
        <NumberStepper
          id="rule-priority"
          aria-invalid={!!errors.priority}
          min={0}
          value={priority}
          onChange={(v) => set("priority", v ?? 0)}
        />
        <p className="text-xs text-muted-foreground">{t("form.priorityHint")}</p>
        {fieldError(errors.priority?.message)}
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="rule-active" className="text-base">{t("form.active")}</Label>
            <p className="text-sm text-muted-foreground">{t("form.activeDesc")}</p>
          </div>
          <Switch id="rule-active" checked={active} onCheckedChange={(c) => set("active", c)} />
        </div>
      </div>

      {rule ? (
        <FormSaveBar
          isDirty={isDirty}
          isPending={isPending}
          onDiscard={() => reset()}
          saveLabel={t("form.save")}
          saveDisabled={hasErrors}
          saveDisabledReason={saveBlockedReason}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPending || hasErrors}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPending ? t("form.creating") : t("form.create")}
          </Button>
          <SaveBlockedNotice blocked={hasErrors} reason={saveBlockedReason} />
        </div>
      )}
    </form>
  );
}
