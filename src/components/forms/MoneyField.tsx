"use client";

import { useState } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { CURRENCIES, formatPrice, getCurrencyConfig } from "@/lib/currency";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import {
  decimalToMinor,
  deriveMinor,
  minorToDecimal,
  type CurrencyRates,
  type MoneySet,
} from "@/lib/money";
import {
  sameMoneyInput,
  toMoneyInput,
  withOverride,
  withoutOverride,
  type MoneyInput,
} from "@/lib/money-input";

/**
 * One money amount, entered in a currency the user picks.
 *
 * Replaces the old PriceInput, which took whatever you typed, divided it by the
 * exchange rate and handed back USD dollars rounded to the cent. That rounding
 * is what turned a saved 1.000,05 RSD into 1.000,37 RSD on the way back: one US
 * cent is about 1.085 RSD, so most dinar amounts had no representation at all.
 *
 * Here the number on screen IS the number stored, as an integer in that
 * currency's minor unit. No rate is involved in reading it back.
 *
 * The selector is a VIEW control, and the field has two states:
 *
 * - Untouched (the form value still equals `toMoneyInput(stored)`): the box and
 *   the rows below read straight out of `stored`, so what is on screen is what
 *   is in the database, down to the para. Switching the selector only changes
 *   which stored amount is shown - it does not touch the form value, so the
 *   form does not go dirty and the currency the price is exact in does not move
 *   just because someone looked at it in another one.
 * - Re-authored (the user typed): the typed number is exact and every other
 *   currency is converted from it live, which is what will be stored on save.
 *   Switching the selector then converts once, visibly, in the input.
 *
 * Without `stored` (creating a record, or an empty optional amount) the field is
 * always in the second state.
 */
export function MoneyField({
  value,
  onChange,
  onBlur,
  rates,
  stored,
  preferredCurrency,
  lockedCurrency,
  showDerived = false,
  placeholder,
  className,
  inputClassName,
  disabled = false,
  "aria-invalid": ariaInvalid,
}: {
  value: MoneyInput;
  onChange: (next: MoneyInput) => void;
  /** Forwarded to the input so react-hook-form validates on blur. */
  onBlur?: () => void;
  rates: CurrencyRates;
  /**
   * The value as it stands in the database. Omit when there is nothing stored
   * yet (creating a record, or an optional amount that is still empty).
   *
   * While the form value still matches it, the field reads its numbers out of
   * this set instead of converting anything, so an untouched price is shown to
   * the para in every currency it is stored in.
   */
  stored?: MoneySet | null;
  /**
   * Which currency to open in - the one the screen is already showing. This is
   * a view preference only: it never reaches the form value, so having the
   * header on another currency neither dirties the form nor moves which
   * currency the amount is exact in. Defaults to the value's own currency.
   */
  preferredCurrency?: Currency;
  /**
   * Pins the field to one currency and hides the selector. For amounts that are
   * denominated by something other than the user's preference - settling a COD
   * balance that exists in a specific currency, or a product whose other price
   * fields already fixed the currency for the whole section.
   */
  lockedCurrency?: Currency;
  /**
   * What the other currencies work out to.
   *
   * - `true` shows them and lets one be pinned to an exact amount ("fixed price
   *   for this market"). For anything a buyer is quoted: a price, a shipping
   *   fee, a coupon's discount and its minimum order.
   * - `"readonly"` shows them without the pinning affordance, for an amount that
   *   is genuinely ONE number the seller wants to read in another currency. A
   *   cost price is the case: it is what you actually paid a supplier, so
   *   "a different cost for German buyers" is not a thing that exists, but
   *   seeing what it came to is still useful.
   * - Omitted hides the block, which is also what a `lockedCurrency` field wants
   *   since it has only the one currency.
   */
  showDerived?: boolean | "readonly";
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Set by FormControl when the field has an error, so the inner input gets
   *  the same red border a plain Input would. */
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const t = useTranslations("money");
  const locale = useLocale();

  // Untouched: the form value is still, field for field, what was loaded out of
  // the database. Everything the field shows can then be read rather than
  // converted, and a currency pick can stay a pure view change.
  const pristine = stored != null && sameMoneyInput(value, toMoneyInput(stored));

  // Which currency the box is showing. Deliberately NOT part of the form value.
  const [display, setDisplay] = useState<Currency>(preferredCurrency ?? value.currency);
  const [lastPreferred, setLastPreferred] = useState(preferredCurrency);

  // A currency pick is a transient view preference. Drop it on navigation so a
  // warm (Router-Cache-kept) form does not reopen in a leftover one.
  const navGeneration = useNavigationGeneration();
  const [lastNav, setLastNav] = useState(navGeneration);
  if (navGeneration !== lastNav) {
    setLastNav(navGeneration);
    setDisplay(preferredCurrency ?? value.currency);
  }
  // The currency store rehydrates from the cookie after the first client render,
  // so the preference usually arrives a render late. Follow it only while the
  // field is untouched - once someone is typing, the view stays where they put
  // it.
  if (preferredCurrency !== lastPreferred) {
    setLastPreferred(preferredCurrency);
    if (preferredCurrency && pristine) setDisplay(preferredCurrency);
  }

  const currency: Currency = lockedCurrency ?? display;
  const config = getCurrencyConfig(currency);

  // The stored amount for the currency on screen, or null when there is none -
  // either the field has been edited, or the set was written while that
  // currency's rate was unavailable.
  const storedShown = pristine ? (stored?.amounts[currency] ?? null) : null;

  /** What belongs in the box: the stored number when untouched, the authored
   *  number when it was typed in this currency, otherwise a live conversion. */
  const shownAmount =
    storedShown ??
    (value.currency === currency
      ? value.amount
      : (deriveMinor(value.amount, value.currency, currency, rates) ?? value.amount));

  // What the user sees. Kept as a string so a half-typed "1000," survives.
  const [text, setText] = useState<string>(
    shownAmount !== 0 ? minorToDecimal(shownAmount, currency).toFixed(config.decimalPlaces) : "",
  );
  // The last amount WE emitted, so the user's own keystroke is not treated as
  // an external change and clobbered mid-typing (the pattern PriceInput used).
  const [emitted, setEmitted] = useState(shownAmount);
  const [lastSeen, setLastSeen] = useState(shownAmount);
  const [lastCurrency, setLastCurrency] = useState(currency);

  // React's "adjust state on prop change" - a form.reset(), a discard, a
  // programmatic update or a currency pick must re-sync the box; the user's own
  // typing must not.
  if (shownAmount !== lastSeen || currency !== lastCurrency) {
    setLastSeen(shownAmount);
    setLastCurrency(currency);
    if (shownAmount !== emitted || currency !== lastCurrency) {
      setText(
        shownAmount !== 0
          ? minorToDecimal(shownAmount, currency).toFixed(config.decimalPlaces)
          : "",
      );
    }
  }

  const handleAmount = (raw: string) => {
    setText(raw);
    const parsed = parseFloat(raw);
    // Negatives pass through rather than being clamped, so the zod schema can
    // reject them and surface a field error instead of the value silently
    // becoming 0.
    const amount = Number.isNaN(parsed) ? 0 : decimalToMinor(parsed, currency);
    setEmitted(amount);
    // Typing IS the act of authoring: from here the number is exact in the
    // currency on screen and every other one is converted from it. Any pin on
    // this same currency goes, since `amount` now says what it is worth.
    onChange(withoutOverride({ ...value, currency, amount }, currency));
  };

  // Only the view moves. The value keeps whichever currency it is exact in, so
  // looking at a price in another currency is not an edit and does not decide
  // what the price is stored as.
  const handleCurrency = (next: Currency) => setDisplay(next);

  // The symbol prefix is only shown when there is no selector beside the field.
  // With one, the currency was stated twice - and a three-character code like
  // "RSD" sitting inside the box pushed the number itself out of view.
  const symbol = lockedCurrency ? config.symbol : null;
  // One minor unit, as a step: 0.01 for a 2-decimal currency.
  const step = (1 / 10 ** config.decimalPlaces).toFixed(config.decimalPlaces);

  const overrides = value.overrides ?? {};

  /**
   * Rows whose input is open but which have not been given a value yet.
   *
   * This exists so that revealing the input is NOT itself an edit. Writing the
   * override on the click marked the whole form dirty - "you have unsaved
   * changes" - before the user had typed a single character, which is both
   * untrue and alarming. Opening the input is a view change; only a keystroke
   * is a data change.
   */
  const [opened, setOpened] = useState<Currency[]>([]);

  /** Drops the pin, putting the currency back on the converted path. */
  const clearOverride = (target: Currency, opts?: { keepOpen?: boolean }) => {
    if (!opts?.keepOpen) setOpened((prev) => prev.filter((c) => c !== target));
    if (overrides[target] == null) return;
    onChange(withoutOverride(value, target));
  };

  const setManualFromText = (target: Currency, raw: string) => {
    const trimmed = raw.trim();
    // Emptying the field means "I did not mean to pin this after all", so the
    // override is dropped rather than stored as a zero price. The input stays
    // open so the user can keep typing.
    if (trimmed === "") {
      clearOverride(target, { keepOpen: true });
      return;
    }
    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return;
    onChange(withOverride(value, target, decimalToMinor(parsed, target)));
  };


  /** Whether a currency may be pinned to an exact amount here. A read-only
   *  block still renders an existing pin's amount - it is the stored number and
   *  showing something else would be a lie - just without a way to change it. */
  const canPin = showDerived === true;

  /** The other currencies: what each costs, and whether its input is showing. */
  const derivedRows = VALID_CURRENCIES.filter((c) => c !== currency).map((c) => {
    const pinned = overrides[c];
    // Untouched rows come out of the set, not out of a rate. Otherwise a price
    // stored as 1.000,05 RSD would be re-derived from another currency at
    // today's rate and read back as 1.000,00 - the exact drift this whole
    // feature exists to prevent, shown right under the field.
    const asStored = pristine ? (stored?.amounts[c] ?? null) : null;
    return {
      currency: c,
      config: getCurrencyConfig(c),
      /** Pinned to a typed amount - this is what gets stored. */
      isManual: pinned != null,
      /** Input visible: either already pinned, or opened and awaiting a value. */
      isOpen: canPin && (pinned != null || opened.includes(c)),
      // Converted from the authored amount, not from what the box happens to
      // show: that is what the server will do on save, and going through a
      // second currency first would round twice.
      amount:
        pinned ??
        asStored ??
        deriveMinor(value.amount, value.currency, c, rates) ??
        0,
    };
  });

  // Untouched, the block is reporting stored amounts and names the currency the
  // price was actually entered in. Saying "converted from the RSD price" there
  // would be a lie twice over: nothing was converted, and RSD may only be the
  // currency the header happens to be set to.
  const blockHint =
    pristine && stored
      ? t("storedHint", { currency: getCurrencyConfig(stored.primary).label })
      : t("derivedHint", { currency: config.label });

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          {symbol && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none pointer-events-none">
              {symbol}
            </span>
          )}
          <Input
            type="number"
            step={step}
            // Deliberately no native `min`: it triggers the browser's own
            // validation popup on submit, which would pre-empt our inline
            // react-hook-form message.
            placeholder={placeholder ?? (0).toFixed(config.decimalPlaces)}
            className={cn(
              symbol && (symbol.length <= 1 ? "pl-7" : symbol.length === 2 ? "pl-9" : "pl-12"),
              inputClassName,
            )}
            value={text}
            onChange={(e) => handleAmount(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            aria-invalid={ariaInvalid}
          />
        </div>
        {!lockedCurrency && (
          <Select
            value={currency}
            onValueChange={(v) => handleCurrency(v as Currency)}
            disabled={disabled}
          >
            <SelectTrigger className="w-24 shrink-0">
              {/* Explicit label so it renders pre-hydration - SelectContent is
                  portaled and not yet available for a value->item lookup. */}
              <SelectValue>{config.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.filter((c) =>
                (VALID_CURRENCIES as readonly string[]).includes(c.code),
              ).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {showDerived && !lockedCurrency && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-2.5 space-y-2">
          {/* One short line, not a paragraph. Every money field on a form
              renders its own block, so a three-sentence explanation appeared
              three times side by side and turned into a wall of text at narrow
              widths. The detail lives on the action's tooltip instead. */}
          <p className="text-xs text-muted-foreground">{blockHint}</p>

          {/* These rows live inside a three-column form grid, so at tablet
              widths each one gets roughly 200px. The layout is built to survive
              that rather than to look right at one width:

              - No separate currency-label column. `formatPrice` already spells
                the currency out, and a label beside it read "RSD 1.000,00 RSD"
                - the duplication alone ate the width the action needed, which
                is how the two ended up overlapping.
              - The manual input carries the currency symbol as a prefix, the
                same way the main field above does, so nothing is lost by
                dropping the label.
              - `flex-wrap` + `ml-auto`: when the action no longer fits beside
                the amount it drops to its own line, right-aligned, instead of
                being squeezed into or over the amount.
              - The amount never gets `flex-1`, so it takes its natural width
                and cannot be shrunk into an overflow. */}
          {derivedRows.map((row) => (
            <div
              key={row.currency}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            >
              {row.isOpen ? (
                <>
                  {/* The code sits OUTSIDE the box, and only while editing.
                      Read-only rows are formatted with their currency already,
                      so a label there would repeat it; an input has nothing
                      else naming it, and a prefix inside would eat the width
                      the number needs. */}
                  <span className="w-8 shrink-0 font-medium text-muted-foreground">
                    {row.config.label}
                  </span>
                  <Input
                    type="number"
                    step={(1 / 10 ** row.config.decimalPlaces).toFixed(
                      row.config.decimalPlaces,
                    )}
                    className="h-7 min-w-0 flex-1 basis-20 text-xs"
                    disabled={disabled}
                    defaultValue={minorToDecimal(row.amount, row.currency).toFixed(
                      row.config.decimalPlaces,
                    )}
                    onChange={(e) => setManualFromText(row.currency, e.target.value)}
                  />
                </>
              ) : (
                <span className="tabular-nums">{formatPrice(row.amount, row.currency, locale)}</span>
              )}

                {canPin &&
                  !disabled &&
                  (row.isOpen ? (
                    // An icon, not "Vrati preračunato": that label is wide
                    // enough that beside an input it pushed itself onto a
                    // second line in a narrow form column. Reverting is a
                    // standard undo affordance and reads fine as one, while
                    // the way IN still gets a written label below.
                    <button
                      type="button"
                      className="ml-auto grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={t("useConvertedTooltip")}
                      aria-label={t("useConverted")}
                      onClick={() => clearOverride(row.currency)}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ml-auto shrink-0 cursor-pointer whitespace-nowrap text-primary underline-offset-2 hover:underline"
                      title={t("enterManuallyTooltip")}
                      onClick={() =>
                        // Only reveals the input. The override is written on
                        // the first keystroke, so the form does not go dirty
                        // just because someone opened a field.
                        setOpened((prev) =>
                          prev.includes(row.currency) ? prev : [...prev, row.currency],
                        )
                      }
                    >
                      {t("enterManually")}
                    </button>
                  ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
