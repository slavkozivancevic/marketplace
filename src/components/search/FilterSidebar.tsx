"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { StarRating } from "@/features/reviews/components/StarRating";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------- Filter config types ----------

/**
 * Shared "see more" threshold for long checkbox facets (brand, attribute
 * options). Single source of truth so every sidebar collapses at the same
 * count - a per-page number drifts and makes the same filter behave
 * differently across pages. Short fixed facets (status, role, verified) have
 * fewer options than this and never collapse, so they can omit `maxVisible`.
 */
export const FILTER_OPTIONS_VISIBLE_LIMIT = 8;

export interface CheckboxFilterGroup {
  type: "checkbox";
  key: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
  /** Max items shown before "see more". Defaults to showing all. */
  maxVisible?: number;
}

export interface RangeFilterGroup {
  type: "range";
  key: string;
  label: string;
  min?: number;
  max?: number;
  prefix?: string;
  step?: number;
}

export interface StarRatingFilterGroup {
  type: "rating";
  key: string;
  label: string;
}

export type FilterGroup = CheckboxFilterGroup | RangeFilterGroup | StarRatingFilterGroup;

export type FilterValues = Record<string, string[] | [number?, number?] | number | null>;

// ---------- CheckboxFilter with see-more ----------

function CheckboxFilter({
  group,
  values,
  onChange,
}: {
  group: CheckboxFilterGroup;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const t = useTranslations("search");
  const [expanded, setExpanded] = useState(false);

  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  const maxVisible = group.maxVisible ?? group.options.length;
  const showToggle = group.options.length > maxVisible;
  const visible = expanded ? group.options : group.options.slice(0, maxVisible);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{group.label}</p>
      <div className="space-y-1.5">
        {visible.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground transition-colors"
          >
            <Checkbox
              checked={values.includes(option.value)}
              onCheckedChange={() => toggle(option.value)}
            />
            <span className="flex-1">{option.label}</span>
            {option.count != null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {option.count}
              </span>
            )}
          </label>
        ))}
      </div>
      {showToggle && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mt-1 cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {t("seeLess")}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t("seeMore", { count: group.options.length - maxVisible })}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ---------- RangeFilter ----------

function RangeInputGroup({
  prefix,
  placeholder,
  value,
  onChange,
  onBlur,
  onKeyDown,
  min,
  max,
  step,
}: {
  prefix?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-1 min-w-0 items-center h-8 rounded-lg border border-input bg-background shadow-sm focus-within:border-ring focus-within:inset-ring-2 focus-within:inset-ring-ring/50 overflow-hidden">
      {prefix && (
        <span className="shrink-0 px-1.5 text-xs text-muted-foreground border-r border-input bg-muted/40 self-stretch flex items-center">
          {prefix}
        </span>
      )}
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        min={min}
        max={max}
        step={step ?? 1}
        className="flex-1 min-w-0 bg-transparent py-1 px-2 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function RangeFilter({
  group,
  values,
  onChange,
}: {
  group: RangeFilterGroup;
  values: [number?, number?];
  onChange: (values: [number?, number?]) => void;
}) {
  const t = useTranslations("search");
  const [minStr, setMinStr] = useState(values[0]?.toString() ?? "");
  const [maxStr, setMaxStr] = useState(values[1]?.toString() ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinStr(values[0]?.toString() ?? "");
    setMaxStr(values[1]?.toString() ?? "");
  }, [values]);

  const handleMinBlur = () => {
    const parsed = minStr ? Number(minStr) : undefined;
    if (parsed !== values[0]) {
      onChange([
        parsed !== undefined && !isNaN(parsed) ? parsed : undefined,
        values[1],
      ]);
    }
  };

  const handleMaxBlur = () => {
    const parsed = maxStr ? Number(maxStr) : undefined;
    if (parsed !== values[1]) {
      onChange([
        values[0],
        parsed !== undefined && !isNaN(parsed) ? parsed : undefined,
      ]);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {group.label}
        {group.prefix && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({group.prefix})
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <RangeInputGroup
          placeholder={t("min")}
          value={minStr}
          onChange={(e) => setMinStr(e.target.value)}
          onBlur={handleMinBlur}
          onKeyDown={(e) => e.key === "Enter" && handleMinBlur()}
          min={group.min}
          max={group.max}
          step={group.step}
        />
        <span className="text-xs text-muted-foreground shrink-0">{t("to")}</span>
        <RangeInputGroup
          placeholder={t("max")}
          value={maxStr}
          onChange={(e) => setMaxStr(e.target.value)}
          onBlur={handleMaxBlur}
          onKeyDown={(e) => e.key === "Enter" && handleMaxBlur()}
          min={group.min}
          max={group.max}
          step={group.step}
        />
      </div>
    </div>
  );
}

// ---------- StarRatingFilter ----------

function StarRatingFilter({
  group,
  value,
  onChange,
}: {
  group: StarRatingFilterGroup;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations("search");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{group.label}</p>
        {value != null && (
          <button
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Clear rating filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <StarRating
          rating={value ?? 0}
          size={20}
          interactive
          onRatingChange={(star) => {
            if (star !== value) onChange(star);
          }}
        />
        <span className="text-xs text-muted-foreground shrink-0">{t("andUp")}</span>
      </div>
    </div>
  );
}

// ---------- Filter content (shared between desktop and mobile) ----------

function FilterGroups({
  groups,
  values,
  onChange,
}: {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (key: string, value: string[] | [number?, number?] | number | null) => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      {groups.map((group) => (
        <div key={group.key}>
          {group.type === "checkbox" && (
            <CheckboxFilter
              group={group}
              values={(values[group.key] as string[]) ?? []}
              onChange={(v) => onChange(group.key, v)}
            />
          )}
          {group.type === "range" && (
            <RangeFilter
              group={group}
              values={(values[group.key] as [number?, number?]) ?? []}
              onChange={(v) => onChange(group.key, v)}
            />
          )}
          {group.type === "rating" && (
            <StarRatingFilter
              group={group}
              value={(values[group.key] as number | null) ?? null}
              onChange={(v) => onChange(group.key, v)}
            />
          )}
          <Separator className="mt-4" />
        </div>
      ))}
    </div>
  );
}

// ---------- Desktop sidebar ----------

function DesktopFilterSidebar(props: {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (key: string, value: string[] | [number?, number?] | number | null) => void;
  onClear: () => void;
  sticky?: boolean;
}) {
  const t = useTranslations("search");
  const activeCount = Object.entries(props.values).filter(([, v]) => {
    if (Array.isArray(v)) return v.some((item) => item != null);
    return v != null;
  }).length;

  return (
    <aside className={cn(
      "hidden lg:flex flex-col w-56 shrink-0 border-r",
      props.sticky && "sticky top-0 self-start max-h-[calc(100svh-8rem)]"
    )}>
      <div className="shrink-0 pr-6 pt-1 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("filters")}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onClear}
            className={cn("h-auto py-1 px-2 text-xs", activeCount === 0 && "invisible pointer-events-none")}
          >
            {t("clearAll")}
          </Button>
        </div>
        <Separator className="mt-2" />
      </div>
      <div className="flex-1 overflow-y-auto pr-6">
        <FilterGroups
          groups={props.groups}
          values={props.values}
          onChange={props.onChange}
        />
      </div>
    </aside>
  );
}

// ---------- Mobile filter sheet ----------

function MobileFilterSheet(props: {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (key: string, value: string[] | [number?, number?] | number | null) => void;
  onClear: () => void;
  activeCount: number;
  className?: string;
}) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("font-normal", props.className)}
      >
        <Filter className="size-3.5" />
        <span className="hidden sm:inline">{t("filters")}</span>
        {props.activeCount > 0 && (
          <Badge variant="secondary" className="ml-0.5 px-1.5 py-0">
            {props.activeCount}
          </Badge>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>{t("filters")}</SheetTitle>
            <SheetDescription>{t("narrowDown")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4">
            <FilterGroups
              groups={props.groups}
              values={props.values}
              onChange={props.onChange}
            />
          </div>
          <SheetFooter className="shrink-0">
            <Button onClick={() => setOpen(false)} className="w-full">
              {t("showResults")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------- Exported composite ----------

interface FilterSidebarProps {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (key: string, value: string[] | [number?, number?] | number | null) => void;
  onClear: () => void;
  sticky?: boolean;
}

export function FilterSidebar({
  groups,
  values,
  onChange,
  onClear,
  sticky,
}: FilterSidebarProps) {
  if (groups.length === 0) return null;

  return (
    <DesktopFilterSidebar
      groups={groups}
      values={values}
      onChange={onChange}
      onClear={onClear}
      sticky={sticky}
    />
  );
}

export { MobileFilterSheet };