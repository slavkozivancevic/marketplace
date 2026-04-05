"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import {
  publishProduct,
  unpublishProduct,
  archiveProduct,
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
  const [isPublishing, startPublish] = useTransition();
  const [isUnpublishing, startUnpublish] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const handlePublish = () => {
    startPublish(async () => {
      const result = await publishProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  const handleUnpublish = () => {
    startUnpublish(async () => {
      const result = await unpublishProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  const handleArchive = () => {
    startArchive(async () => {
      const result = await archiveProduct(productId, redirectTo);
      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
          {isPublishing ? "Publishing..." : "Publish"}
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
            {isUnpublishing ? "Unpublishing..." : "Unpublish"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? "Archiving..." : "Archive"}
          </Button>
        </>
      )}

      {status === "ARCHIVED" && (
        <span className="text-sm text-muted-foreground">
          Archived — no further status changes allowed
        </span>
      )}

      <ActionButton
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => {
          startDelete(async () => {
            const result = await deleteProduct(productId, redirectTo);
            if (result && "error" in result) {
              toast.error(result.message);
            }
          });
        }}
      >
        <Button variant="destructive" size="sm" disabled={isDeleting}>
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </ActionButton>
    </div>
  );
}
