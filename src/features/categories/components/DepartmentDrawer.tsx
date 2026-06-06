"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, ChevronLeft, X, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CategoryTreeItem } from "../db/categories";
import { getCategoryName } from "../utils/translations";
import { useLocale } from "next-intl";

interface DepartmentDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Full category tree (all levels). */
  tree: CategoryTreeItem[];
  /** Currently selected department slug ("" = All). */
  selectedDept: string;
  onChange: (slug: string) => void;
}

type StackFrame = {
  /** The category item for this level (used for locale-aware label). */
  item: CategoryTreeItem;
  items: CategoryTreeItem[];
  /** Slug of this level's parent, so clicking "See all X" selects it */
  parentSlug: string;
};

export function DepartmentDrawer({
  open,
  onClose,
  tree,
  selectedDept,
  onChange,
}: DepartmentDrawerProps) {
  const t = useTranslations("categories");
  const locale = useLocale();
  const [stack, setStack] = useState<StackFrame[]>([]);

  const currentFrame = stack[stack.length - 1] ?? null;
  const displayItems = currentFrame ? currentFrame.items : tree;

  function defaultSlug(item: CategoryTreeItem): string {
    return (
      item.translations.find((tr) => tr.locale === "en")?.slug ??
      item.translations[0]?.slug ??
      ""
    );
  }

  function drillIn(item: CategoryTreeItem) {
    const itemSlug = defaultSlug(item);
    if (item.children.length === 0) {
      // Leaf - select immediately
      onChange(itemSlug);
      handleClose();
      return;
    }
    setStack((prev) => [
      ...prev,
      { item, items: item.children, parentSlug: itemSlug },
    ]);
  }

  function drillBack() {
    setStack((prev) => prev.slice(0, -1));
  }

  function selectCurrent() {
    if (!currentFrame) return;
    onChange(currentFrame.parentSlug);
    handleClose();
  }

  function selectAll() {
    onChange("");
    handleClose();
  }

  function handleClose() {
    setStack([]);
    onClose();
  }

  const backLabel =
    stack.length > 1
      ? getCategoryName(stack[stack.length - 2].item, locale)
      : t("allDepartments");

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col gap-0" aria-describedby={undefined}>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          {currentFrame ? (
            <button
              onClick={drillBack}
              className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label={t("back")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
          )}

          <SheetTitle className="flex-1 text-sm font-semibold truncate">
            {currentFrame ? getCategoryName(currentFrame.item, locale) : t("allDepartments")}
          </SheetTitle>

          <button
            onClick={handleClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors p-0.5 ml-auto"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Back breadcrumb */}
        {currentFrame && (
          <button
            onClick={drillBack}
            className="cursor-pointer flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-b bg-muted/30 shrink-0"
          >
            <ChevronLeft className="h-3 w-3" />
            {t("backTo")} {backLabel}
          </button>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">

          {/* "All Departments" row - only on root level */}
          {!currentFrame && (
            <button
              onClick={selectAll}
              className={cn(
                "cursor-pointer w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border/40 transition-colors text-left",
                selectedDept === ""
                  ? "bg-primary/5 text-primary font-semibold"
                  : "hover:bg-muted text-foreground",
              )}
            >
              <span>{t("allDepartments")}</span>
              {selectedDept === "" && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
            </button>
          )}

          {/* "See all [current level]" row - when drilled in */}
          {currentFrame && (
            <button
              onClick={selectCurrent}
              className={cn(
                "cursor-pointer w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border/40 transition-colors text-left font-medium",
                selectedDept === currentFrame.parentSlug
                  ? "bg-primary/5 text-primary"
                  : "hover:bg-muted text-foreground",
              )}
            >
              <span>{t("seeAll", { name: getCategoryName(currentFrame.item, locale) })}</span>
              {selectedDept === currentFrame.parentSlug && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
            </button>
          )}

          {/* Category rows */}
          {displayItems.map((item) => {
            const itemSlug = defaultSlug(item);
            const isSelected = selectedDept === itemSlug;
            const hasChildren = item.children.length > 0;

            return (
              <button
                key={item.id}
                onClick={() => drillIn(item)}
                className={cn(
                  "cursor-pointer w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border/40 transition-colors text-left",
                  isSelected
                    ? "bg-primary/5 text-primary font-semibold"
                    : "hover:bg-muted text-foreground",
                )}
              >
                <span className="flex-1 truncate">{getCategoryName(item, locale)}</span>
                {hasChildren ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : isSelected ? (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                ) : null}
              </button>
            );
          })}

          {displayItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center px-4 py-8">
              {t("noCategories")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}