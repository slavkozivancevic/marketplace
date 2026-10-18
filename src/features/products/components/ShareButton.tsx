"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * Share this page.
 *
 * Three tiers, because one API is not available everywhere: the system share
 * sheet where the browser has one (every phone, and that is where sharing
 * actually happens), the clipboard on a desktop browser, and a manual
 * `document.execCommand` copy where the Clipboard API is blocked - it is
 * gated on a secure context and on permission, and failing silently would
 * leave the button looking broken.
 *
 * The URL comes from the address bar rather than being rebuilt, so what gets
 * shared is the canonical per-locale URL the visitor is actually on - a
 * reconstructed one would quietly drop the locale prefix or a slug alias.
 */
export function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const t = useTranslations("products");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Insecure context, or the user denied clipboard permission.
      try {
        const area = document.createElement("textarea");
        area.value = url;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const onShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // AbortError when the user dismisses the sheet - that is a choice, not
        // a failure, so nothing is said and nothing is copied behind their back.
        return;
      }
    }

    const ok = await copyToClipboard(url);
    if (!ok) {
      toast.error(t("shareFailed"));
      return;
    }
    setCopied(true);
    toast.success(t("shareCopied"));
    // Back to the share icon after a beat. The toast has already said what
    // happened; the tick is just the button acknowledging the click.
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("shareProduct")}
      title={t("shareProduct")}
      onClick={onShare}
      className={cn("shrink-0", className)}
    >
      {copied ? (
        <Check className="h-5 w-5 text-emerald-600" />
      ) : (
        <Share2 className="h-5 w-5" />
      )}
    </Button>
  );
}
