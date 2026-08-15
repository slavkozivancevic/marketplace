"use client";

import { useEffect, useState } from "react";
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
import { CURRENCIES } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

/**
 * Price input with an inline currency selector. The value handed back via
 * `onChange` is ALWAYS USD decimal (e.g. 18.43) - product prices are stored in
 * the USD base. The user can type in any supported currency and it is converted
 * to USD. `defaultCurrency` lets a caller open the input in the currency the rest
 * of the screen is showing (e.g. the globally-selected display currency).
 */
export function PriceInput({
  value,
  onChange,
  onBlur,
  rates,
  defaultCurrency = "usd",
  placeholder = "0.00",
  className,
  inputClassName,
  onCurrencyChange,
  disabled = false,
}: {
  value: number;
  onChange: (usd: number) => void;
  /** Forwarded to the number input so RHF's `onTouched` mode validates the
   *  field on blur (pass the field's `onBlur`). */
  onBlur?: () => void;
  rates: Record<string, number>;
  defaultCurrency?: Currency;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Notified whenever the inline currency selector changes, so callers can
   *  show related amounts (e.g. a saved-value hint) in the same currency. */
  onCurrencyChange?: (currency: Currency) => void;
  /** Read-only mode: locks both the amount input and the currency selector. */
  disabled?: boolean;
}) {
  // Guard against an invalid/empty currency reaching the selector (e.g. the
  // store mid-hydration or a stale persisted value) - it would render a blank
  // selector and break the rate lookup. Always fall back to a known currency.
  const resolvedDefaultCurrency: Currency = CURRENCIES.some(
    (c) => c.code === defaultCurrency,
  )
    ? defaultCurrency
    : "usd";

  const [inputCurrency, setInputCurrency] = useState<Currency>(resolvedDefaultCurrency);
  // True once the user manually picks a currency in this field - after that we
  // stop auto-following `defaultCurrency`.
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const rate = inputCurrency === "usd" ? 1 : (rates[inputCurrency] ?? 1);

  // What the user sees in the input box (in their chosen currency).
  const [displayValue, setDisplayValue] = useState<string>(
    value !== 0 ? (value * rate).toFixed(2) : "",
  );

  // Keep the field controlled: when `value` changes from outside (e.g. a
  // form.reset() / discard, or a programmatic update) re-sync the displayed
  // amount. Done at render time (React's "adjust state on prop change" pattern),
  // not in an effect. `lastSeen` is the last value prop we reacted to; `emitted`
  // is the last value WE sent up - so a user's own keystroke (value === emitted)
  // does not clobber their in-progress typing, while a true external change does.
  const [lastSeen, setLastSeen] = useState(value);
  const [emitted, setEmitted] = useState(value);
  if (value !== lastSeen) {
    setLastSeen(value);
    if (value !== emitted) {
      setDisplayValue(value !== 0 ? (value * rate).toFixed(2) : "");
    }
  }

  // Follow the caller's `defaultCurrency` when it changes after mount. The
  // currency store rehydrates from the SSR default ("usd") to the persisted
  // value (e.g. "rsd") once on the client, but `useState` only captured the
  // initial "usd". Re-convert the displayed amount to the new currency. Skipped
  // once the user has manually chosen a currency for this field.
  const [lastDefaultCurrency, setLastDefaultCurrency] = useState(resolvedDefaultCurrency);
  if (resolvedDefaultCurrency !== lastDefaultCurrency) {
    setLastDefaultCurrency(resolvedDefaultCurrency);
    if (!currencyTouched && resolvedDefaultCurrency !== inputCurrency) {
      setInputCurrency(resolvedDefaultCurrency);
      const newRate = resolvedDefaultCurrency === "usd" ? 1 : (rates[resolvedDefaultCurrency] ?? 1);
      setDisplayValue(value !== 0 ? (value * newRate).toFixed(2) : "");
    }
  }

  // A per-field currency pick is a transient view preference - drop it on
  // navigation so returning to a warm (Router-Cache-kept) form shows the app
  // currency again instead of the leftover override. navGeneration bumps on
  // every real path change and is stable while you stay on the page.
  const navGeneration = useNavigationGeneration();
  const [lastNav, setLastNav] = useState(navGeneration);
  if (navGeneration !== lastNav) {
    setLastNav(navGeneration);
    if (currencyTouched) {
      setCurrencyTouched(false);
      setInputCurrency(resolvedDefaultCurrency);
      const navRate = resolvedDefaultCurrency === "usd" ? 1 : (rates[resolvedDefaultCurrency] ?? 1);
      setDisplayValue(value !== 0 ? (value * navRate).toFixed(2) : "");
    }
  }

  // Notify the caller of the currency actually on screen right now, however
  // it got there (manual pick below, the defaultCurrency-follow branch above,
  // or the nav-reset branch above) - callers that mirror amounts in this same
  // currency (e.g. a saved-value hint) would otherwise only learn about
  // manual picks and go stale on the other two paths.
  useEffect(() => {
    onCurrencyChange?.(inputCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputCurrency]);

  const symbol = CURRENCIES.find((c) => c.code === inputCurrency)?.symbol ?? "$";

  const handleCurrencyChange = (newCurrency: Currency) => {
    const newRate = newCurrency === "usd" ? 1 : (rates[newCurrency] ?? 1);
    if (value !== 0) setDisplayValue((value * newRate).toFixed(2));
    setInputCurrency(newCurrency);
    setCurrencyTouched(true);
    onCurrencyChange?.(newCurrency);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    // Round to cents so a currency round-trip (USD -> other -> back) lands on the
    // exact same value and doesn't read as an edit. Without this, float drift
    // (e.g. 45 -> 4882.50 RSD -> 45.0000001) keeps the form falsely dirty.
    // Negatives are emitted as-is (NOT clamped to 0) so the schema's nonnegative
    // check can reject them and surface a field error - clamping silently hid it.
    const usd = isNaN(parsed) ? 0 : Math.round((parsed / rate) * 100) / 100;
    // Record what we emit so the render-time external-sync treats this as our own
    // change and doesn't overwrite the user's in-progress typing.
    setEmitted(usd);
    onChange(usd);
  };

  const usdEquivalent =
    inputCurrency !== "usd" && parseFloat(displayValue) > 0
      ? parseFloat(displayValue) / rate
      : null;

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none pointer-events-none">
            {symbol}
          </span>
          <Input
            type="number"
            step="0.01"
            // Intentionally no native `min`: it triggers the browser's own
            // "value must be >= 0" popup on submit, which blocks our inline
            // (RHF) error message. Validation is enforced by the zod schema and
            // surfaced as a field message instead.
            placeholder={placeholder}
            className={cn(symbol.length <= 1 ? "pl-7" : symbol.length === 2 ? "pl-9" : "pl-12", inputClassName)}
            value={displayValue}
            onChange={handleChange}
            onBlur={onBlur}
            disabled={disabled}
          />
        </div>
        <Select value={inputCurrency} onValueChange={(v) => handleCurrencyChange(v as Currency)} disabled={disabled}>
          <SelectTrigger className="w-24 shrink-0">
            {/* Explicit label so it shows pre-hydration (Radix SelectContent is
                portaled and not yet available for value->item lookup). */}
            <SelectValue>
              {CURRENCIES.find((c) => c.code === inputCurrency)?.label ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {usdEquivalent !== null && (
        <p className="text-xs text-muted-foreground mt-1">≈ ${usdEquivalent.toFixed(2)} USD</p>
      )}
    </div>
  );
}
