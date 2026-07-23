"use client";
import { logger } from "@/lib/logger";

import * as React from "react";
import { useCallback, useId, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import axios, { AxiosProgressEvent } from "axios";
import { PlayCircle } from "lucide-react";
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
import { MediaLightbox } from "@/components/product/MediaLightbox";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_VIDEO_SIZE,
} from "@/constants/constants";
import {
  CreateProductMediaUploadResponse,
  PresignedUploadedMedia,
  ProcessProductImageResponse,
  ProcessProductVideoResponse,
} from "@/types/types";

type ProductMediaUploadProps = {
  media: PresignedUploadedMedia[];
  setMedia: React.Dispatch<React.SetStateAction<PresignedUploadedMedia[]>>;
};

// Fetch the image/poster into the browser cache before swapping the visible
// src. Resolves on success or failure so a missing/blocked URL never wedges
// the upload flow - at worst the user sees the usual fallback.
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

type SortableItemProps = {
  item: PresignedUploadedMedia;
  onClick: (e: React.MouseEvent) => void;
  onRemove: () => void;
};

function SortableItem({ item, onClick, onRemove }: SortableItemProps) {
  const sortableId = item.clientId ?? item.key;
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

  const isVideo = item.mediaType === "VIDEO";
  // For video tiles we prefer the server-generated poster; while the upload
  // is still in flight we show the local blob (a still <video> first frame).
  const thumbSrc = isVideo ? (item.posterUrl ?? item.url) : item.url;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group py-0 relative h-24 w-full cursor-pointer overflow-hidden ${isDragging ? "z-1" : ""}`}
    >
      <CardContent className="relative h-full w-full p-0" onClick={onClick}>
        {isVideo && !item.posterUrl ? (
          // Server poster not yet available - render the source video paused
          // on its first frame as a local preview.
          <video
            src={thumbSrc}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <Image
            src={thumbSrc}
            alt={isVideo ? "Video poster" : "Uploaded"}
            fill
            sizes="(max-width: 768px) 25vw, 160px"
            className="object-cover"
            unoptimized={thumbSrc.startsWith("blob:")}
          />
        )}

        {isVideo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <PlayCircle className="text-white drop-shadow" size={32} />
          </div>
        )}

        {item.progress !== undefined && item.progress < 100 && (
          <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${item.progress}%` }}
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

export const ProductMediaUpload: React.FC<ProductMediaUploadProps> = ({
  media,
  setMedia,
}) => {
  const t = useTranslations("mediaUpload");
  const dndId = useId();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

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
      if (media.length + acceptedFiles.length > MAX_FILES) {
        toast.error(t("tooManyFiles", { max: MAX_FILES }));
        return;
      }

      for (const file of acceptedFiles) {
        const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
        const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);

        if (!isImage && !isVideo) {
          toast.error(t("typeNotAllowed", { name: file.name }));
          continue;
        }

        const sizeLimit = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
        if (file.size > sizeLimit) {
          toast.error(t("tooLarge", { name: file.name }));
          continue;
        }

        const clientId = crypto.randomUUID();
        const tempKey = clientId;
        const localPreviewUrl = URL.createObjectURL(file);

        const tempItem: PresignedUploadedMedia = {
          key: tempKey,
          clientId,
          url: localPreviewUrl,
          downloadUrl: localPreviewUrl,
          mediaType: isVideo ? "VIDEO" : "IMAGE",
          mimeType: file.type,
          progress: 5,
        };

        setMedia((prev) => [...prev, tempItem]);

        try {
          const uploadEndpoint = isVideo
            ? "/api/uploads/product-video"
            : "/api/uploads/product-image";

          const { data } = await axios.post<CreateProductMediaUploadResponse>(
            uploadEndpoint,
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
              // x-amz-tagging is already in the presigned URL's query string
              // (the SDK puts it there when Tagging is set in PutObjectCommand),
              // so the object will be born tagged without an extra header.
            },
            onUploadProgress: (event: AxiosProgressEvent) => {
              if (!event.total) return;

              // Cap client upload at 90% so the bar stays visible during the
              // server-side processing step that runs afterwards.
              const ratio = event.loaded / event.total;
              const percent = Math.min(90, Math.round(ratio * 90));

              setMedia((prev) =>
                prev.map((m) =>
                  m.clientId === clientId ? { ...m, progress: percent } : m,
                ),
              );
            },
          });

          setMedia((prev) =>
            prev.map((m) =>
              m.clientId === clientId ? { ...m, progress: 95 } : m,
            ),
          );

          if (isVideo) {
            const { data: processed } =
              await axios.post<ProcessProductVideoResponse>(
                "/api/uploads/product-video/process",
                { key },
              );

            if (processed.error) {
              throw new Error(processed.message || "Video processing failed");
            }

            const {
              key: processedKey,
              thumbKey,
              videoDownloadUrl,
              posterDownloadUrl,
              mimeType,
              durationMs,
              width,
              height,
            } = processed.data;

            await preloadImage(posterDownloadUrl);

            const uploadedItem: PresignedUploadedMedia = {
              key: processedKey,
              clientId,
              url: videoDownloadUrl,
              downloadUrl: videoDownloadUrl,
              posterUrl: posterDownloadUrl,
              thumbKey,
              mediaType: "VIDEO",
              mimeType,
              durationMs,
              width,
              height,
              progress: 100,
            };

            setMedia((prev) =>
              prev.map((m) => (m.clientId === clientId ? uploadedItem : m)),
            );
          } else {
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

            await preloadImage(thumbnailDownloadUrl);

            const uploadedItem: PresignedUploadedMedia = {
              key: processedKey,
              clientId,
              url: thumbnailDownloadUrl,
              downloadUrl: originalDownloadUrl,
              mediaType: "IMAGE",
              mimeType: file.type,
              progress: 100,
            };

            setMedia((prev) =>
              prev.map((m) => (m.clientId === clientId ? uploadedItem : m)),
            );
          }

          URL.revokeObjectURL(localPreviewUrl);

          toast.success(t("uploaded", { name: file.name }));
        } catch (err) {
          logger.error(err);

          URL.revokeObjectURL(localPreviewUrl);

          setMedia((prev) => prev.filter((m) => m.clientId !== clientId));

          toast.error(t("uploadFailed", { name: file.name }));
        }
      }
    },
    [media.length, t, setMedia],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: media.length >= MAX_FILES,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "video/mp4": [],
      "video/webm": [],
    },
  });

  const removeItem = (key: string) => {
    setMedia((prev) => {
      const itemToRemove = prev.find((m) => m.key === key);

      if (itemToRemove?.url.startsWith("blob:")) {
        URL.revokeObjectURL(itemToRemove.url);
      }
      if (
        itemToRemove?.downloadUrl?.startsWith("blob:") &&
        itemToRemove.downloadUrl !== itemToRemove.url
      ) {
        URL.revokeObjectURL(itemToRemove.downloadUrl);
      }

      // Only hard-delete here for media uploaded THIS session (has a
      // clientId, set in onDrop) - it has no product row yet, so it's the
      // only cleanup path for it. Pre-existing product media (loaded from
      // the server, no clientId) must survive a Discard, so its S3 cleanup
      // is left to the server's syncProductMedia diff, which runs only once
      // the removal is actually saved - deleting it here would orphan the
      // reference the instant the user clicks Discard.
      if (itemToRemove?.clientId && !itemToRemove.url.startsWith("blob:")) {
        const deleteEndpoint =
          itemToRemove.mediaType === "VIDEO"
            ? "/api/uploads/product-video/delete"
            : "/api/uploads/product-image/delete";
        axios
          .post(deleteEndpoint, { key: itemToRemove.key })
          .catch((err) => logger.error("Failed to delete from S3:", err));
      }

      return prev.filter((m) => m.key !== key);
    });

    // Close the fullscreen preview if open; indices shift after removal.
    setPreviewIndex(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMedia((items) => {
        const oldIndex = items.findIndex(
          (i) => (i.clientId ?? i.key) === active.id,
        );
        const newIndex = items.findIndex(
          (i) => (i.clientId ?? i.key) === over.id,
        );

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
        <div
          {...getRootProps()}
          className={`relative rounded-lg border-2 border-dashed p-4 text-center transition ${
            media.length >= MAX_FILES
              ? "cursor-not-allowed border-muted/50 opacity-50"
              : "cursor-pointer border-muted hover:border-foreground"
          }`}
        >
          <Input
            {...getInputProps()}
            type="file"
            multiple
            disabled={media.length >= MAX_FILES}
            className="absolute inset-0 cursor-pointer opacity-0"
          />

          {isDragActive ? (
            <p>{t("dropActive")}</p>
          ) : media.length >= MAX_FILES ? (
            <p>{t("maxReached", { count: MAX_FILES })}</p>
          ) : (
            <p>{t("dropHint")}</p>
          )}

          {media.length > 0 && media.length < MAX_FILES && (
            <p className="text-muted-foreground mt-2 text-xs">
              {t("counter", { remaining: MAX_FILES - media.length })}
            </p>
          )}
        </div>

        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={media.map((m) => m.clientId ?? m.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-4 grid grid-cols-4 gap-4">
              {media.map((m, i) => (
                <SortableItem
                  key={m.clientId ?? m.key}
                  item={m}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(i);
                  }}
                  onRemove={() => removeItem(m.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>

      <MediaLightbox
        media={media.map((m) => {
          const src = m.downloadUrl ?? m.url;
          return {
            id: m.clientId ?? m.key,
            mediaType: m.mediaType,
            url: src,
            posterUrl: m.posterUrl,
            unoptimized: src.startsWith("blob:"),
          };
        })}
        index={previewIndex ?? 0}
        onIndexChange={setPreviewIndex}
        open={previewIndex !== null}
        onOpenChange={(o) => {
          if (!o) setPreviewIndex(null);
        }}
        title={t("mediaPreview")}
      />
    </Card>
  );
};