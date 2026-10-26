"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { countryName, foldForSearch, sortedCountries, type CountryCode } from "@/lib/i18n/countries";

/**
 * Picks the countries of one market.
 *
 * The same Popover + Input shape as the product form's `CountrySelect` (about
 * 250 options, which a plain Select does not make navigable), except that a
 * pick toggles and the panel stays open, since a market is usually several
 * countries at once.
 *
 * A country another market owns is listed but not pickable, with that market's
 * name beside it: every country belongs to exactly one market, and hiding the
 * taken ones would leave the admin wondering where Germany went.
 */
export function CountryMultiSelect({
  value,
  onChange,
  takenBy,
  disabled,
  "aria-invalid": ariaInvalid,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  /** Code -> name of the OTHER market that owns it. */
  takenBy: Readonly<Record<string, string>>;
  disabled?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const locale = useLocale();
  const t = useTranslations("priceMarkets");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const countries = useMemo(() => sortedCountries(locale), [locale]);
  const selected = useMemo(() => new Set(value), [value]);

  const matches = useMemo(() => {
    const folded = foldForSearch(query.trim());
    if (!folded) return countries;
    const byCode = countries.filter((c) => c.code.toLowerCase() === folded);
    const byName = countries.filter(
      (c) => c.code.toLowerCase() !== folded && foldForSearch(c.name).includes(folded),
    );
    return [...byCode, ...byName];
  }, [countries, query]);

  const toggle = (code: CountryCode) => {
    if (takenBy[code]) return;
    onChange(selected.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  const scrollHighlightIntoView = (index: number) => {
    const row = listRef.current?.children[index];
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
  };

  // Chips in localized-name order, whatever order they were picked in.
  const chips = countries.filter((c) => selected.has(c.code));

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Reset on open, not on close: the panel stays mounted for its exit
          // animation, and refilling the list there flashes it.
          if (next) {
            setQuery("");
            setHighlight(0);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            disabled={disabled}
            className="w-full justify-between font-normal cursor-pointer"
          >
            <span className={cn(value.length === 0 && "text-muted-foreground")}>
              {value.length === 0 ? t("countriesNone") : t("countriesSelected", { count: value.length })}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <div className="p-2">
            <Input
              autoFocus
              value={query}
              placeholder={t("countriesSearch")}
              aria-label={t("countriesSearch")}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => {
                    const next = Math.min(h + 1, matches.length - 1);
                    scrollHighlightIntoView(next);
                    return next;
                  });
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => {
                    const next = Math.max(h - 1, 0);
                    scrollHighlightIntoView(next);
                    return next;
                  });
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const picked = matches[highlight];
                  if (picked) toggle(picked.code);
                }
              }}
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto pb-1">
            {matches.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("countriesEmpty")}</p>
            )}
            {matches.map((country, i) => {
              const owner = takenBy[country.code];
              return (
                <button
                  key={country.code}
                  type="button"
                  disabled={!!owner}
                  aria-pressed={selected.has(country.code)}
                  onClick={() => toggle(country.code)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm cursor-pointer",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    i === highlight && !owner && "bg-accent text-accent-foreground",
                  )}
                >
                  <Check
                    className={cn("h-3.5 w-3.5 shrink-0", selected.has(country.code) ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 min-w-0 truncate">{country.name}</span>
                  {owner ? (
                    <span className="max-w-[45%] truncate text-xs text-muted-foreground">{owner}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">{country.code}</span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* The same removable chip as the bulk panel's country condition. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Badge key={c.code} variant="secondary" className="gap-1">
              {countryName(c.code, locale)}
              <button
                type="button"
                disabled={disabled}
                aria-label={t("countryRemove", { country: c.name })}
                className="cursor-pointer"
                onClick={() => toggle(c.code)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
