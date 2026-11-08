"use client";

import { Share, SquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * iPhone/iPad install steps. No iOS browser exposes an install prompt to the
 * page, so the "Install app" entry can only explain Safari's own path.
 */
export function InstallAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("installApp");
  const steps = [
    { icon: Share, text: t("iosStep1") },
    { icon: SquarePlus, text: t("iosStep2") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("iosTitle")}</DialogTitle>
          <DialogDescription>{t("iosDescription")}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-3">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                {i + 1}. {text}
              </span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
