"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlignLeft, ChevronRight, ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CategoryTreeItem } from "../db/categories";

interface CategoryToolbarProps {
  categories: CategoryTreeItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

// ---------- Category drawer (drill-down tree) ----------

function CategoryDrawer({
  open,
  onClose,
  categories,
  selectedIds,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryTreeItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("categories");
  // stack of { label, items } — root is always items[0]
  const [stack, setStack] = useState<{ label: string; items: CategoryTreeItem[] }[]>([]);

  const currentLevel = stack.length > 0 ? stack[stack.length - 1] : null;
  const displayItems = currentLevel ? currentLevel.items : categories;
  const parentLabel = currentLevel ? currentLevel.label : null;

  const handleDrillIn = (item: CategoryTreeItem) => {
    if (item.children.length === 0) {
      toggleId(item.id);
      return;
    }
    setStack((prev) => [...prev, { label: item.name, items: item.children }]);
  };

  const handleBack = () => setStack((prev) => prev.slice(0, -1));

  const toggleId = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    );
  };

  const handleClose = () => {
    setStack([]);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="left" className="w-72 flex flex-col p-0">
        <SheetHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            {parentLabel ? (
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <SheetTitle className="text-sm font-semibold">
              {parentLabel ?? t("allCategories")}
            </SheetTitle>
            <button onClick={handleClose} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {parentLabel && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground text-left"
              onClick={handleBack}
            >
              ← {t("backTo")} {stack.length > 1 ? stack[stack.length - 2].label : t("allCategories")}
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {displayItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const hasChildren = item.children.length > 0;
            return (
              <button
                key={item.id}
                onClick={() => handleDrillIn(item)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border/50 hover:bg-muted transition-colors text-left",
                  isSelected && "bg-primary/5 text-primary font-medium",
                )}
              >
                <span>{item.name}</span>
                {hasChildren ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : isSelected ? (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                ) : null}
              </button>
            );
          })}

          {displayItems.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">{t("noCategories")}</p>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="shrink-0 border-t px-4 py-3">
            <button
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {t("clearAll")}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Main toolbar ----------

export function CategoryToolbar({
  categories,
  selectedIds,
  onChange,
}: CategoryToolbarProps) {
  const t = useTranslations("categories");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleId = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    );
  };

  if (categories.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b pb-3">
        {/* Hamburger / All button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
            selectedIds.length === 0
              ? "bg-foreground text-background border-foreground"
              : "bg-background border-border text-foreground hover:bg-muted",
          )}
        >
          <AlignLeft className="h-3.5 w-3.5" />
          {t("all")}
        </button>

        {/* Top-level category pills */}
        {categories.map((cat) => {
          const isActive = selectedIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleId(cat.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border whitespace-nowrap",
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border text-foreground hover:bg-muted",
              )}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      <CategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
        selectedIds={selectedIds}
        onChange={onChange}
      />
    </>
  );
}