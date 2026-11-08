"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, ChevronRight, ImageOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { RetryImage } from "@/components/RetryImage";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CategoryTreeItem } from "../db/categories";
import { getCategoryName } from "../utils/translations";
import { pressSurface, pressText } from "@/components/ui/pressable";
import { isAimingAt, type Point } from "../utils/menuAim";

/** How long a department the pointer is only crossing waits before it takes
 *  over the panel - long enough for a diagonal to reach the tiles. */
const AIM_DELAY_MS = 250;

/** This locale's own slug, falling back the way the rest of the storefront
 *  does - a category with no row for the active locale must still be
 *  reachable, through English or whatever row exists. */
function slugOf(item: CategoryTreeItem, locale: string): string | null {
  return (
    item.translations.find((tr) => tr.locale === locale)?.slug ??
    item.translations.find((tr) => tr.locale === routing.defaultLocale)?.slug ??
    item.translations[0]?.slug ??
    null
  );
}

/**
 * The storefront's category menu: departments down the left, the selected
 * department's children as picture tiles on the right.
 *
 * OPENS ON CLICK, NOT HOVER. A hover-opened menu has no touch equivalent, and
 * the house rule is that every hover effect needs one; a click works the same
 * way with a mouse, a finger and a keyboard, so there is nothing to mirror.
 * Inside the panel, moving the pointer over a department previews it (a
 * convenience on a fine pointer) and tapping it does exactly the same thing, so
 * touch loses nothing.
 *
 * The tree is passed in from the layout, already cached there, so opening the
 * menu costs no request.
 */
export function CategoriesMegaMenu({
  tree,
  images = {},
}: {
  tree: CategoryTreeItem[];
  /** Category id -> a product photo, for categories with no picture set. */
  images?: Record<string, string>;
}) {
  const t = useTranslations();
  const tCat = useTranslations("categories");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Menu aim. Hovering a department previews it at once - unless the pointer
  // is on its way to the panel, crossing other departments on a diagonal
  // toward a tile or "See all". Then the department under it waits, and takes
  // over only if the pointer stops there instead of reaching the panel.
  // Click, focus and touch are never delayed.
  const panelRef = useRef<HTMLDivElement>(null);
  const trail = useRef<Point[]>([]);
  const aimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAim = () => {
    if (aimTimer.current) clearTimeout(aimTimer.current);
    aimTimer.current = null;
  };
  useEffect(() => cancelAim, []);

  const previewOnHover = (id: string) => {
    cancelAim();
    const panel = panelRef.current?.getBoundingClientRect();
    const prev = trail.current[0];
    const cur = trail.current[trail.current.length - 1];
    if (!panel || !prev || !cur || !isAimingAt(prev, cur, panel)) {
      setActiveId(id);
      return;
    }
    aimTimer.current = setTimeout(() => {
      aimTimer.current = null;
      const now = trail.current[trail.current.length - 1];
      // Stopped on this department: it is the one wanted after all.
      if (now === cur) setActiveId(id);
      else previewOnHover(id);
    }, AIM_DELAY_MS);
  };

  const selectNow = (id: string) => {
    cancelAim();
    setActiveId(id);
  };

  if (tree.length === 0) return null;

  const active = tree.find((d) => d.id === activeId) ?? tree[0];
  const activeSlug = slugOf(active, locale);

  /**
   * The picture for a tile: the category's own first, then a photo of something
   * published inside it, then a photo from one of its own children.
   *
   * Most subcategories have no `imageUrl` - an admin sets those on departments,
   * if at all - so without the product fallback the panel was a grid of empty
   * frames. The third step covers a category that only groups other categories
   * and holds no products itself.
   */
  const imageFor = (item: CategoryTreeItem): string | null =>
    item.imageUrl ??
    images[item.id] ??
    item.children.map((c) => images[c.id]).find(Boolean) ??
    null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopen on the first department rather than wherever the last visit
        // wandered to - the panel should look the same every time it opens.
        if (!next) {
          cancelAim();
          trail.current = [];
          setActiveId(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`relative flex items-center gap-1 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer ${pressText}`}
          aria-label={t("nav.categories")}
        >
          {t("nav.categories")}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Wide, but never wider than the viewport: `max-w` plus the padding
        // keeps the panel inside the shell, which never scrolls sideways.
        className="w-[min(56rem,calc(100vw-2rem))] p-0 overflow-hidden"
      >
        {/* The department rail narrows with the panel so the tiles never get
            squeezed out of it - the panel itself is capped at the viewport
            width above, and browser zoom shrinks it the same way. */}
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] sm:grid-cols-[13rem_minmax(0,1fr)] max-h-[70vh]">
          <ul
            className="overflow-y-auto border-r py-2"
            onMouseMove={(e) => {
              // The last few positions: the oldest one is "a moment ago".
              trail.current = [...trail.current.slice(-2), { x: e.clientX, y: e.clientY }];
            }}
          >
            {/* The directory itself, first and above the departments.
                Without it this panel was the ONLY thing the "Categories"
                control did on a wide screen, while the same control below xl
                is a plain link to /categories - the same label doing two
                different things, and the full directory reachable only by
                shrinking the window. The panel is the richer version of that
                link, so it has to contain the link. */}
            <li className="mb-1 border-b pb-1">
              <Link
                href="/categories"
                onClick={() => setOpen(false)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-primary hover:underline ${pressText}`}
              >
                <span className="truncate">{tCat("allCategories")}</span>
                {/* ArrowRight, not the ChevronRight the departments carry:
                    that one means "has children, preview it here", this one
                    means "leaves the menu". */}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </li>
            {tree.map((dept) => {
              const name = getCategoryName(dept, locale);
              const isActive = dept.id === active.id;
              return (
                <li key={dept.id}>
                  <button
                    type="button"
                    onMouseEnter={() => previewOnHover(dept.id)}
                    onFocus={() => selectNow(dept.id)}
                    onClick={() => selectNow(dept.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{name}</span>
                    {dept.children.length > 0 && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Reaching the panel ends the aim: the department it showed when
              the pointer left the rail is the one being browsed. */}
          <div ref={panelRef} className="overflow-y-auto p-4" onMouseEnter={cancelAim}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold truncate">
                {getCategoryName(active, locale)}
              </p>
              {activeSlug && (
                <Link
                  href={{ pathname: "/categories/[slug]", params: { slug: activeSlug } }}
                  onClick={() => setOpen(false)}
                  className={`shrink-0 text-xs font-medium text-primary hover:underline ${pressText}`}
                >
                  {/* `browseAll` ("See all"), not `seeAll` ("See all {name}"):
                      the department's name is the heading immediately to the
                      left, so repeating it reads as a stutter - and calling
                      `seeAll` without the parameter threw a FORMATTING_ERROR
                      and rendered the raw key. */}
                  {tCat("browseAll")}
                </Link>
              )}
            </div>

            {active.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tCat("noCategories")}</p>
            ) : (
              // `auto-fill` against the PANE's width, not viewport breakpoints:
              // the panel is a fixed-width popover, so `sm:`/`lg:` here would
              // describe the window while the column count depends on the pane.
              // This keeps the tiles at a readable 8rem minimum whatever the
              // panel ends up being - including when the viewport (and so the
              // `min()` width above) is the thing that shrank.
              <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
                {active.children.map((child) => {
                  const childSlug = slugOf(child, locale);
                  if (!childSlug) return null;
                  const name = getCategoryName(child, locale);
                  const image = imageFor(child);
                  return (
                    <Link
                      key={child.id}
                      href={{ pathname: "/categories/[slug]", params: { slug: childSlug } }}
                      onClick={() => setOpen(false)}
                      className={cn("group flex flex-col gap-1.5 rounded-md p-1.5 transition-colors", pressSurface)}
                    >
                      <div className="relative aspect-square w-full max-w-full overflow-hidden rounded bg-muted/40">
                        {image ? (
                          <RetryImage
                            src={image}
                            alt={name}
                            fill
                            sizes="140px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          // Nothing published in here yet, so there is no photo
                          // to borrow - a neutral tile, never a broken frame.
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageOff className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      {/* Two line boxes always, so a wrapped name does not make
                          its row taller than the one above it. `2lh` follows
                          this element's own line-height rather than a pixel
                          guess that a translation would break. */}
                      <span className="block min-h-[2lh] text-xs leading-snug line-clamp-2">
                        {name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
