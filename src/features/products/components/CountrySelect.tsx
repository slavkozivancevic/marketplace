"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  countryName,
  foldForSearch,
  sortedCountries,
  type CountryCode,
} from "@/lib/i18n/countries";

/**
 * Searchable country picker for `Product.countryOfOrigin`.
 *
 * Built from Popover + Input rather than a plain `Select`: there are ~250
 * options, which Radix's typeahead alone does not make navigable. The repo has
 * no `cmdk` primitive and this did not warrant adding one.
 *
 * Emits the ISO code; every label shown comes from `Intl.DisplayNames` in the
 * active locale, so nothing here is translated by hand.
 */
export function CountrySelect({
  value,
  onChange,
  disabled,
  "aria-invalid": ariaInvalid,
}: {
  // Accepts any stored string - the column is wider than the picker's list -
  // but only ever emits a code the list knows.
  value: string | null | undefined;
  onChange: (value: CountryCode | null) => void;
  disabled?: boolean;
  /** Forwarded from `FormControl` so an invalid selection turns the trigger red. */
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const locale = useLocale();
  const t = useTranslations("productForm");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Index of the keyboard-highlighted row, reset whenever the list changes.
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const countries = useMemo(() => sortedCountries(locale), [locale]);

  const matches = useMemo(() => {
    const folded = foldForSearch(query.trim());
    if (!folded) return countries;
    // Code match first so typing "de" surfaces Germany above "Sweden".
    const byCode = countries.filter((c) => c.code.toLowerCase() === folded);
    const byName = countries.filter(
      (c) => c.code.toLowerCase() !== folded && foldForSearch(c.name).includes(folded),
    );
    return [...byCode, ...byName];
  }, [countries, query]);

  const selectedName = value ? countryName(value, locale) : null;

  const commit = (code: CountryCode | null) => {
    onChange(code);
    setOpen(false);
    // Deliberately NOT clearing the query here. The popover is still mounted
    // while its close animation plays, so resetting the filter now re-renders
    // the full 250-country list inside the panel that is fading out - the whole
    // list flashes for a frame before it disappears. The reset happens on the
    // next open instead (see onOpenChange).
  };

  const scrollHighlightIntoView = (index: number) => {
    const row = listRef.current?.children[index];
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset on open, not on close - closing leaves the panel mounted for
        // its exit animation, and refilling the list there is visible.
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
          <span className={cn(!selectedName && "text-muted-foreground")}>
            {selectedName ?? t("countryOfOriginNone")}
          </span>
          <span className="flex items-center gap-1">
            {value && (
              // Clearing is a plain span, not a nested <button>: a button
              // inside the trigger button is invalid HTML and would swallow
              // the trigger's own keyboard handling.
              <span
                role="button"
                tabIndex={-1}
                aria-label={t("countryOfOriginClear")}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commit(null);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <div className="p-2">
          <Input
            autoFocus
            value={query}
            placeholder={t("countryOfOriginSearch")}
            aria-label={t("countryOfOriginSearch")}
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
                if (picked) commit(picked.code);
              }
            }}
          />
        </div>
        <div ref={listRef} className="max-h-64 overflow-y-auto pb-1">
          {matches.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("countryOfOriginEmpty")}
            </p>
          )}
          {matches.map((country, i) => (
            <button
              key={country.code}
              type="button"
              onClick={() => commit(country.code)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm cursor-pointer",
                i === highlight && "bg-accent text-accent-foreground",
              )}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  country.code === value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="flex-1 min-w-0 truncate">{country.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {country.code}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
