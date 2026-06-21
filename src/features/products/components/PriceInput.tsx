"use client";

import { useState } from "react";
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
  rates,
  defaultCurrency = "usd",
  placeholder = "0.00",
  className,
  inputClassName,
}: {
  value: number;
  onChange: (usd: number) => void;
  rates: Record<string, number>;
  defaultCurrency?: Currency;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [inputCurrency, setInputCurrency] = useState<Currency>(defaultCurrency);
  const rate = inputCurrency === "usd" ? 1 : (rates[inputCurrency] ?? 1);

  // What the user sees in the input box (in their chosen currency).
  const [displayValue, setDisplayValue] = useState<string>(
    value > 0 ? (value * rate).toFixed(2) : "",
  );

  const symbol = CURRENCIES.find((c) => c.code === inputCurrency)?.symbol ?? "$";

  const handleCurrencyChange = (newCurrency: Currency) => {
    const newRate = newCurrency === "usd" ? 1 : (rates[newCurrency] ?? 1);
    if (value > 0) setDisplayValue((value * newRate).toFixed(2));
    setInputCurrency(newCurrency);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    onChange(!isNaN(parsed) && parsed >= 0 ? parsed / rate : 0);
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
            min="0"
            placeholder={placeholder}
            className={cn(symbol.length <= 1 ? "pl-7" : symbol.length === 2 ? "pl-9" : "pl-12", inputClassName)}
            value={displayValue}
            onChange={handleChange}
          />
        </div>
        <Select value={inputCurrency} onValueChange={(v) => handleCurrencyChange(v as Currency)}>
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
