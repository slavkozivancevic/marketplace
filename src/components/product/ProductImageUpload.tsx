"use client";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import axios, { AxiosProgressEvent } from "axios";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ALLOWED_TYPES, MAX_FILES, MAX_FILE_SIZE } from "@/constants/constants";
import {
  CreateProductImageUploadResponse,
  PresignedUploadedImage,
  ProcessProductImageResponse,
} from "@/types/types";

type ProductImageUploadProps = {
  images: PresignedUploadedImage[];
  setImages: React.Dispatch<React.SetStateAction<PresignedUploadedImage[]>>;
};

// Fetch the image into the browser cache before swapping the visible <img>
// src. Resolves on success or failure so a missing/blocked URL never wedges
// the upload flow — at worst the user sees the usual fallback.
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

type SortableItemProps = {
  img: PresignedUploadedImage;
  onClick: (e: React.MouseEvent) => void;
  onRemove: () => void;
};

function SortableItem({ img, onClick, onRemove }: SortableItemProps) {
  const sortableId = img.clientId ?? img.key;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group py-0 relative h-24 w-full cursor-pointer overflow-hidden ${isDragging ? "z-1" : ""}`}
    >
      <CardContent className="h-full w-full p-0" onClick={onClick}>
        <Image
          src={img.url}
          alt="Uploaded"
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />

        {img.progress !== undefined && img.progress < 100 && (
          <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${img.progress}%` }}
            />
          </div>
        )}
      </CardContent>

      <CardAction className="absolute top-1 right-1 opacity-0 transition group-hover:opacity-100">
        <Button
          type="button"
          size="icon-sm"
          variant="destructive"
          className="cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          &times;
        </Button>
      </CardAction>
    </Card>
  );
}

export const ProductImageUpload: React.FC<ProductImageUploadProps> = ({
  images,
  setImages,
}) => {
  const t = useTranslations("imageUpload");
  const dndId = useId();
  const [previewImage, setPreviewImage] =
    useState<PresignedUploadedImage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (images.length + acceptedFiles.length > MAX_FILES) {
        toast.error(t("tooManyFiles", { max: MAX_FILES }));
        return;
      }

      for (const file of acceptedFiles) {
        if (!ALLOWED_TYPES.has(file.type)) {
          toast.error(t("typeNotAllowed", { name: file.name }));
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast.error(t("tooLarge", { name: file.name }));
          continue;
        }

        const clientId = crypto.randomUUID();
        const tempKey = clientId;
        const localPreviewUrl = URL.createObjectURL(file);

        const tempImage: PresignedUploadedImage = {
          key: tempKey,
          clientId,
          url: localPreviewUrl,
          downloadUrl: localPreviewUrl,
          progress: 5,
        };

        setImages((prev) => [...prev, tempImage]);

        try {
          const { data } = await axios.post<CreateProductImageUploadResponse>(
            "/api/uploads/product-image",
            {
              contentType: file.type,
              size: file.size,
            },
          );

          if (data.error) {
            throw new Error(data.message || "Failed to create upload URL");
          }

          const { key, url: uploadUrl } = data.data;

          await axios.put(uploadUrl, file, {
            headers: {
              "Content-Type": file.type,
            },
            onUploadProgress: (event: AxiosProgressEvent) => {
              if (!event.total) return;

              // Cap S3 upload at 90% so the bar stays visible during the
              // server-side processing step that runs afterwards.
              const ratio = event.loaded / event.total;
              const percent = Math.min(90, Math.round(ratio * 90));

              setImages((prev) =>
                prev.map((img) =>
                  img.clientId === clientId ? { ...img, progress: percent } : img,
                ),
              );
            },
          });

          // Indicate the processing phase so the user sees the bar advance
          // past the upload even when the upload itself was instant.
          setImages((prev) =>
            prev.map((img) =>
              img.clientId === clientId ? { ...img, progress: 95 } : img,
            ),
          );

          const { data: processed } =
            await axios.post<ProcessProductImageResponse>(
              "/api/uploads/product-image/process",
              { key },
            );

          if (processed.error) {
            throw new Error(processed.message || "Image processing failed");
          }

          const {
            key: processedKey,
            thumbnailDownloadUrl,
            originalDownloadUrl,
          } = processed.data;

          // Preload the optimized thumbnail before swapping the src so the
          // <img> doesn't briefly go blank while the new URL is fetched.
          await preloadImage(thumbnailDownloadUrl);

          const uploadedImage: PresignedUploadedImage = {
            key: processedKey,
            clientId,
            url: thumbnailDownloadUrl,
            downloadUrl: originalDownloadUrl,
            progress: 100,
          };

          setImages((prev) =>
            prev.map((img) => (img.clientId === clientId ? uploadedImage : img)),
          );

          // Revoke after the swap so the blob remains valid in case React
          // paints the old src one more time during the transition.
          URL.revokeObjectURL(localPreviewUrl);

          toast.success(t("uploaded", { name: file.name }));
        } catch (err) {
          console.error(err);

          URL.revokeObjectURL(localPreviewUrl);

          setImages((prev) => prev.filter((img) => img.clientId !== clientId));

          toast.error(t("uploadFailed", { name: file.name }));
        }
      }
    },
    [images.length, t, setImages],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: images.length >= MAX_FILES,
  });

  const removeImage = (key: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.key === key);

      if (imageToRemove?.url.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.url);
      }

      if (
        imageToRemove?.downloadUrl?.startsWith("blob:") &&
        imageToRemove.downloadUrl !== imageToRemove.url
      ) {
        URL.revokeObjectURL(imageToRemove.downloadUrl);
      }

      if (imageToRemove && !imageToRemove.url.startsWith("blob:")) {
        axios
          .post("/api/uploads/product-image/delete", { key: imageToRemove.key })
          .catch((err) => console.error("Failed to delete from S3:", err));
      }

      return prev.filter((img) => img.key !== key);
    });

    setPreviewImage((prev) => (prev?.key === key ? null : prev));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.key === active.id);
        const newIndex = items.findIndex((i) => i.key === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>

      <CardContent>
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`relative rounded-lg border-2 border-dashed p-4 text-center transition ${
            images.length >= MAX_FILES
              ? "cursor-not-allowed border-muted/50 opacity-50"
              : "cursor-pointer border-muted hover:border-foreground"
          }`}
        >
          <Input
            {...getInputProps()}
            type="file"
            multiple
            disabled={images.length >= MAX_FILES}
            className="absolute inset-0 cursor-pointer opacity-0"
          />

          {isDragActive ? (
            <p>{t("dropActive")}</p>
          ) : images.length >= MAX_FILES ? (
            <p>{t("maxReached", { count: MAX_FILES })}</p>
          ) : (
            <p>{t("dropHint")}</p>
          )}

          {images.length > 0 && images.length < MAX_FILES && (
            <p className="text-muted-foreground mt-2 text-xs">
              {t("counter", { remaining: MAX_FILES - images.length })}
            </p>
          )}
        </div>

        {/* Thumbnails sa drag & drop */}
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.clientId ?? img.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-4 grid grid-cols-4 gap-4">
              {images.map((img) => (
                <SortableItem
                  key={img.clientId ?? img.key}
                  img={img}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImage(img);
                  }}
                  onRemove={() => removeImage(img.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>

      {/* Preview Modal */}
      {previewImage && (
        <Dialog
          open={!!previewImage}
          onOpenChange={() => setPreviewImage(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("imagePreview")}</DialogTitle>
            </DialogHeader>

            <Image
              src={previewImage.downloadUrl ?? previewImage.url}
              alt="Preview"
              width={600}
              height={600}
              className="w-full rounded-md object-contain"
            />

            <DialogFooter>
              <Button type="button" onClick={() => setPreviewImage(null)}>
                {t("close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
