"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

export interface CheckboxFilterGroup {
  type: "checkbox";
  key: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
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

export type FilterGroup = CheckboxFilterGroup | RangeFilterGroup;

export type FilterValues = Record<string, string[] | [number?, number?]>;

// ---------- Internal filter rendering ----------

function CheckboxFilter({
  group,
  values,
  onChange,
}: {
  group: CheckboxFilterGroup;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{group.label}</p>
      <div className="space-y-1.5">
        {group.options.map((option) => (
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
      <p className="text-sm font-medium">{group.label}</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {group.prefix && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {group.prefix}
            </span>
          )}
          <Input
            type="number"
            placeholder={t("min")}
            value={minStr}
            onChange={(e) => setMinStr(e.target.value)}
            onBlur={handleMinBlur}
            onKeyDown={(e) => e.key === "Enter" && handleMinBlur()}
            min={group.min}
            max={group.max}
            step={group.step ?? 1}
            className={cn("text-sm", group.prefix && "pl-6")}
          />
        </div>
        <span className="text-xs text-muted-foreground">{t("to")}</span>
        <div className="relative flex-1">
          {group.prefix && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {group.prefix}
            </span>
          )}
          <Input
            type="number"
            placeholder={t("max")}
            value={maxStr}
            onChange={(e) => setMaxStr(e.target.value)}
            onBlur={handleMaxBlur}
            onKeyDown={(e) => e.key === "Enter" && handleMaxBlur()}
            min={group.min}
            max={group.max}
            step={group.step ?? 1}
            className={cn("text-sm", group.prefix && "pl-6")}
          />
        </div>
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
  onChange: (key: string, value: string[] | [number?, number?]) => void;
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
  onChange: (key: string, value: string[] | [number?, number?]) => void;
  onClear: () => void;
  sticky?: boolean;
}) {
  const t = useTranslations("search");
  const activeCount = Object.entries(props.values).filter(
    ([, v]) => Array.isArray(v) && v.some((item) => item != null),
  ).length;

  return (
    <aside className={cn(
      "hidden lg:flex flex-col w-56 shrink-0 border-r",
      props.sticky && "sticky top-0 self-start max-h-screen"
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
  onChange: (key: string, value: string[] | [number?, number?]) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Filter className="size-3.5" />
        {t("filters")}
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
  onChange: (key: string, value: string[] | [number?, number?]) => void;
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
