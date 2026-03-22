"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
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
  onUploadComplete: (images: PresignedUploadedImage[]) => void;
  initialImages?: PresignedUploadedImage[];
};

type SortableItemProps = {
  img: PresignedUploadedImage;
  onClick: (e: React.MouseEvent) => void;
  onRemove: () => void;
};

// Sortable thumbnail sa CardAction overlay
function SortableItem({ img, onClick, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: img.key });

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
      className={`group py-0 relative h-24 w-full cursor-pointer overflow-hidden ${isDragging ? 'z-1' : ''}`}
    >
      <CardContent className="h-full w-full p-0" onClick={onClick}>
        <Image
          src={img.url}
          alt="Uploaded"
          width={96}
          height={96}
          className="h-full w-full object-cover"
          placeholder="blur"
          blurDataURL={img.url}
        />

        {img.progress !== undefined && img.progress < 100 && (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-muted">
            <div
              className="h-full bg-primary"
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
  onUploadComplete,
  initialImages = [],
}) => {
  const [images, setImages] = useState<PresignedUploadedImage[]>(initialImages);
  const [previewImage, setPreviewImage] =
    useState<PresignedUploadedImage | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  }));

  /**
   * Ako parent promeni initialImages (npr edit mode / reset forme),
   * uskladi local state.
   */
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  /**
   * Jedino mesto gde obaveštavamo parent.
   * Nema side-effect unutar setImages updater funkcija.
   */
  useEffect(() => {
    onUploadComplete(images);
  }, [images, onUploadComplete]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (images.length + acceptedFiles.length > MAX_FILES) {
        toast.error(`You can only upload up to ${MAX_FILES} images.`);
        return;
      }

      for (const file of acceptedFiles) {
        if (!ALLOWED_TYPES.has(file.type)) {
          toast.error(`File type not allowed: ${file.name}`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File too large: ${file.name}`);
          continue;
        }

        const tempKey = crypto.randomUUID();
        const localPreviewUrl = URL.createObjectURL(file);

        const tempImage: PresignedUploadedImage = {
          key: tempKey,
          url: localPreviewUrl,
          downloadUrl: localPreviewUrl,
          progress: 0,
        };

        setImages((prev) => [...prev, tempImage]);

        try {
          // 1) Uzmi presigned PUT URL (bez downloadUrl fallback-a)
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

          // 2) Upload na S3 preko presigned PUT URL
          await axios.put(uploadUrl, file, {
            headers: {
              "Content-Type": file.type,
            },
            onUploadProgress: (event: AxiosProgressEvent) => {
              if (!event.total) return;

              const percent = Math.round((event.loaded * 100) / event.total);

              setImages((prev) =>
                prev.map((img) =>
                  img.key === tempKey ? { ...img, progress: percent } : img,
                ),
              );
            },
          });

          // 3) Procesiraj sliku (thumb + signed GET URL-ovi)
          const { data: processed } =
            await axios.post<ProcessProductImageResponse>(
              "/api/uploads/product-image/process",
              { key },
            );

          if (processed.error) {
            throw new Error(processed.message || "Image processing failed");
          }

          const { key: processedKey, thumbnailDownloadUrl, originalDownloadUrl } = processed.data;

          const uploadedImage: PresignedUploadedImage = {
            key: processedKey,
            url: thumbnailDownloadUrl,
            downloadUrl: originalDownloadUrl,
            progress: 100,
          };

          URL.revokeObjectURL(localPreviewUrl);

          setImages((prev) =>
            prev.map((img) => (img.key === tempKey ? uploadedImage : img)),
          );

          toast.success(`Uploaded: ${file.name}`);
        } catch (err) {
          console.error(err);

          URL.revokeObjectURL(localPreviewUrl);

          setImages((prev) => prev.filter((img) => img.key !== tempKey));

          toast.error(`Failed to upload: ${file.name}`);
        }
      }
    },
    [images.length],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: images.length >= MAX_FILES,
  });

  const removeImage = (key: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.key === key);

      // Revoke samo za blob URL-eve (lokalni preview), ne za signed https URL-eve
      if (imageToRemove?.url.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.url);
      }

      if (
        imageToRemove?.downloadUrl?.startsWith("blob:") &&
        imageToRemove.downloadUrl !== imageToRemove.url
      ) {
        URL.revokeObjectURL(imageToRemove.downloadUrl);
      }

      // Delete from S3 if uploaded
      if (imageToRemove && !imageToRemove.url.startsWith("blob:")) {
        axios.post("/api/uploads/product-image/delete", { key: imageToRemove.key })
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
        <CardTitle>Upload Product Images</CardTitle>
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
            <p>Drop files here...</p>
          ) : images.length >= MAX_FILES ? (
            <p>Maximum {MAX_FILES} images reached</p>
          ) : (
            <p>Drag & drop images here, or click to select</p>
          )}

          {/* Mini preview thumbnails unutar dropzone */}
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {images.map((img) => (
                <div
                  key={`mini-${img.key}`}
                  className="relative h-16 w-16 overflow-hidden rounded-lg border"
                >
                  <Image
                    src={img.url}
                    alt="Preview"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    placeholder="blur"
                    blurDataURL={img.url}
                  />

                  {img.progress !== undefined && img.progress < 100 && (
                    <div className="absolute right-0 bottom-0 left-0 h-1 bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${img.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnails sa drag & drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-4 grid grid-cols-4 gap-4">
              {images.map((img) => (
                <SortableItem
                  key={img.key}
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
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>

            <Image
              src={previewImage.downloadUrl ?? previewImage.url}
              alt="Preview"
              width={600}
              height={600}
              className="w-full rounded-md object-contain"
              placeholder="blur"
              blurDataURL={previewImage.downloadUrl ?? previewImage.url}
            />

            <DialogFooter>
              <Button type="button" onClick={() => setPreviewImage(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
