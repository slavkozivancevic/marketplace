/**
 * Column template of the price-rules table: name | applies to | change |
 * schedule | priority | status | actions. Its own module, not an export of
 * PriceRulesTable: that file is "use client", and a server component importing
 * a constant from it gets a client reference instead of the string - the
 * route skeleton could not share the template.
 */
export const PRICE_RULES_GRID =
  "grid grid-cols-[minmax(10rem,1.6fr)_minmax(8rem,1fr)_minmax(6rem,0.8fr)_minmax(12rem,1.8fr)_5rem_7rem_7.25rem] items-center gap-3";
