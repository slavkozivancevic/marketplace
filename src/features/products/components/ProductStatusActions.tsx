"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { setFlash } from "@/lib/navigation/flash";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import {
  publishProduct,
  unpublishProduct,
  archiveProduct,
  unarchiveProduct,
  deleteProduct,
} from "../actions/products";

interface ProductStatusActionsProps {
  productId: string;
  status: string;
  /**
   * Where a DELETE lands - the product list this panel belongs to
   * (`/admin/products` or `/dashboard/my-products`), without the locale prefix.
   * `null` keeps the caller in place, for a list row deleting itself.
   *
   * Nothing else here navigates. This prop used to be a general `redirectTo`
   * that the status buttons obeyed too, which is how the same Publish button
   * ended up keeping the admin on the product page and bouncing the seller out
   * to their list.
   */
  deletedRedirectTo: string | null;
}

export function ProductStatusActions({
  productId,
  status,
  deletedRedirectTo,
}: ProductStatusActionsProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const router = useRouter();
  const locale = useLocale();

  /**
   * A status transition is an in-place edit, on every surface: the user stays
   * on the product and watches the badge - and the button row itself - change.
   * That is the whole confirmation, which is why nothing here raises a toast.
   *
   * `router.refresh()`, not a push to the current URL: the action already burst
   * this page's cache tag, and refreshing inside the transition keeps the
   * button spinning until the re-rendered status has actually landed on screen.
   *
   * These actions used to redirect from the server, which throws - so the cache
   * invalidation below never ran and the product list stayed stale behind the
   * navigation.
   */
  const settleInPlace = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    router.refresh();
  };
  const [isPublishing, startPublish] = useTransition();
  const [isUnpublishing, startUnpublish] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [isUnarchiving, startUnarchive] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  // Never closed by hand on success: the delete navigates away and the whole
  // page - dialog included - goes with it, while the spinner runs through the
  // navigation. On failure it stays open with the reason in a toast.
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handlePublish = () => {
    startPublish(async () => {
      const result = await publishProduct(productId);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        settleInPlace();
      }
    });
  };

  const handleUnpublish = () => {
    startUnpublish(async () => {
      const result = await unpublishProduct(productId);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        settleInPlace();
      }
    });
  };

  const handleArchive = () => {
    startArchive(async () => {
      const result = await archiveProduct(productId);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        settleInPlace();
      }
    });
  };

  const handleUnarchive = () => {
    startUnarchive(async () => {
      const result = await unarchiveProduct(productId);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        settleInPlace();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "DRAFT" && (
        <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing && <Loader2 className="animate-spin" />}
          {isPublishing ? t("publishing") : t("publish")}
        </Button>
      )}

      {status === "PUBLISHED" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnpublish}
            disabled={isUnpublishing}
          >
            {isUnpublishing && <Loader2 className="animate-spin" />}
            {isUnpublishing ? t("unpublishing") : t("unpublish")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving && <Loader2 className="animate-spin" />}
            {isArchiving ? t("archiving") : t("archive")}
          </Button>
        </>
      )}

      {status === "ARCHIVED" && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleUnarchive}
          disabled={isUnarchiving}
        >
          {isUnarchiving && <Loader2 className="animate-spin" />}
          {isUnarchiving ? t("restoring") : t("restoreToDraft")}
        </Button>
      )}

      <ActionButton
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteProduct")}
        description={t("deleteProductDesc")}
        confirmText={tCommon("delete")}
        loadingText={t("deleting")}
        isLoading={isDeleting}
        onConfirm={() => {
          startDelete(async () => {
            const result = await deleteProduct(productId, deletedRedirectTo);
            if (result && "error" in result) {
              toast.error(result.message);
            } else {
              // Queued for the list we are about to land on: this page is the
              // deleted product's own, so there is nothing left here to show a
              // toast next to. The status actions above stay silent by design -
              // their result is the badge changing in place.
              queryClient.invalidateQueries({ queryKey: ["products"] });
              if (result.redirectTo) {
                setFlash(t("productDeleted"), {
                  path: `/${locale}${result.redirectTo}`,
                });
                router.push(`/${locale}${result.redirectTo}`);
              }
            }
          });
        }}
      >
        {/* Resting control - ActionButton disables it and the dialog's confirm
            button carries the spinner. */}
        <Button variant="destructive" size="sm">
          {t("deleteProduct")}
        </Button>
      </ActionButton>
    </div>
  );
}
