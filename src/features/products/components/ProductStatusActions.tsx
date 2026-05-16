"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
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
  redirectTo?: string;
}

export function ProductStatusActions({
  productId,
  status,
  redirectTo,
}: ProductStatusActionsProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [isPublishing, startPublish] = useTransition();
  const [isUnpublishing, startUnpublish] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [isUnarchiving, startUnarchive] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const handlePublish = () => {
    startPublish(async () => {
      const result = await publishProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  const handleUnpublish = () => {
    startUnpublish(async () => {
      const result = await unpublishProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  const handleArchive = () => {
    startArchive(async () => {
      const result = await archiveProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  const handleUnarchive = () => {
    startUnarchive(async () => {
      const result = await unarchiveProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
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
            {isUnpublishing ? t("unpublishing") : t("unpublish")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleArchive}
            disabled={isArchiving}
          >
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
          {isUnarchiving ? t("restoring") : t("restoreToDraft")}
        </Button>
      )}

      <ActionButton
        title={t("deleteProduct")}
        description={t("deleteProductDesc")}
        confirmText={tCommon("delete")}
        loadingText={t("deleting")}
        isLoading={isDeleting}
        onConfirm={() => {
          startDelete(async () => {
            const result = await deleteProduct(productId, redirectTo);
            if (result && "error" in result) {
              toast.error(result.message);
            } else {
              queryClient.invalidateQueries({ queryKey: ["products"] });
            }
          });
        }}
      >
        <Button variant="destructive" size="sm" disabled={isDeleting}>
          {isDeleting ? t("deleting") : t("deleteProduct")}
        </Button>
      </ActionButton>
    </div>
  );
}
