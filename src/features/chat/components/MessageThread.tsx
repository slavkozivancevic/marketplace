"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef, useState, useCallback } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Send,
  Paperclip,
  X,
  FileText,
  Loader2,
  Clock,
  Check,
  CheckCheck,
  ChevronDown,
  Play,
  Video,
  Smile,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import { playSendSound } from "../utils/chatSounds";
import { useReactions } from "../hooks/useReactions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatMessage } from "../types";
import { UserProfile } from "../hooks/useUserProfiles";

type Attachment = {
  key: string;
  type: string;
  width?: number;
  height?: number;
  filename?: string;
  size?: number;
};

type PendingAttachment = {
  id: string;
  file: File;
  key?: string;
  width?: number;
  height?: number;
  progress: number;
  status: "uploading" | "done" | "error";
  abort?: AbortController;
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

interface Props {
  conversationId: string | null;
  messages: ChatMessage[];
  currentUserId: string;
  isLoading: boolean;
  profiles?: Record<string, UserProfile>;
  onSend: (text: string, attachments: Attachment[]) => void;
  onMarkRead: (messageIds: string[]) => void;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 5;

const EMOJI_SHORTCUTS: Record<string, string> = {
  ":)": "😊",
  ":-)": "😊",
  ":(": "😢",
  ":-(": "😢",
  ":D": "😄",
  ":-D": "😄",
  ":P": "😛",
  ":-P": "😛",
  ";)": "😉",
  ";-)": "😉",
  "<3": "❤️",
  "</3": "💔",
  ":o": "😮",
  ":O": "😮",
  ":-o": "😮",
  ":*": "😘",
  "B)": "😎",
  ">:(": "😠",
  ":')": "🥲",
  "^^": "😊",
  xD: "😂",
  XD: "😂",
};

/** Replace shortcodes that are word-bounded (used at send time for any remaining ones). */
function applyEmojiShortcodes(str: string): string {
  let result = str;
  for (const [code, emoji] of Object.entries(EMOJI_SHORTCUTS)) {
    const esc = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`(^|\\s)${esc}(?=\\s|$)`, "g"),
      `$1${emoji}`,
    );
  }
  return result;
}

/** True when no longer shortcode starts with this word (safe to replace immediately). */
function isCompleteShortcode(word: string): boolean {
  return (
    !!EMOJI_SHORTCUTS[word] &&
    !Object.keys(EMOJI_SHORTCUTS).some(
      (c) => c.startsWith(word) && c.length > word.length,
    )
  );
}

/** True when the message text is composed entirely of emoji (+ optional whitespace).
 *  Strips Extended_Pictographic base chars plus all modifiers that appear in emoji sequences:
 *  variation selectors (FE0E/FE0F), ZWJ (200D), combining enclosing mark (20E3), and whitespace.
 *  If nothing remains the string is emoji-only. */
function isEmojiOnly(str: string): boolean {
  const t = str.trim();
  if (!t.length) return false;
  return (
    t.replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u20E3\s]/gu, "")
      .length === 0
  );
}

function formatDateSeparator(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd.MM.yyyy");
}

function getInitials(
  name: string | null | undefined,
  fallback: string,
): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return fallback.slice(0, 2).toUpperCase();
}

// ── Attachment display ────────────────────────────────────────────────────────

function useAttachmentReadUrl(key: string) {
  return useQuery({
    queryKey: ["chat-attachment-url", key],
    queryFn: async () => {
      const { data } = await axios.get<{ url: string }>(
        `/api/chat/attachments/read-url?key=${encodeURIComponent(key)}`,
      );
      return data.url;
    },
    staleTime: 1000 * 60 * 50, // 50 min - presigned URL expires at 60 min (buffer of 10 min)
    retry: 1,
  });
}

// Rendered as a direct child (no portal) so Radix's dismiss logic never fires
// for clicks inside it. position:fixed + z-[200] still covers the full viewport.
function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-colors cursor-pointer"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="attachment"
        className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const IMG_MAX = 192; // max side length in px
const IMG_MIN = 72; // min side length in px

function imageContainerSize(
  width: number,
  height: number,
): { w: number; h: number } {
  const ratio = width / height;
  if (ratio >= 1) {
    return { w: IMG_MAX, h: Math.round(Math.max(IMG_MIN, IMG_MAX / ratio)) };
  }
  return { w: Math.round(Math.max(IMG_MIN, IMG_MAX * ratio)), h: IMG_MAX };
}

// ── PDF preview card ──────────────────────────────────────────────────────────

const PDF_PREVIEW_H = 56;

/**
 * In-memory cache: S3 key → rendered JPEG data URL + page count.
 * Keyed by the stable S3 key (not the presigned URL which rotates every 50 min).
 * Survives drawer open/close without re-rendering.
 */
type PdfCacheEntry = { dataUrl: string; numPages: number };
const pdfPreviewCache = new Map<string, PdfCacheEntry>();

// A single shared pdf.js worker, created lazily and reused across all previews
// (pdf.js multiplexes documents over one port). We build the URL at runtime so
// the bundler doesn't try to resolve the worker through its module graph -
// under Turbopack that turns pdf.js's fake-worker dynamic import into a
// "Failed to fetch dynamically imported module" error. Handing pdf.js a real
// Worker via workerPort sidesteps the fake-worker path entirely.
let pdfWorkerPort: Worker | null = null;
function getPdfWorkerPort(): Worker {
  pdfWorkerPort ??= new Worker(
    `${window.location.origin}/pdf.worker.min.mjs`,
    { type: "module" }
  );
  return pdfWorkerPort;
}

function PdfPreviewCard({ attachment }: { attachment: Attachment }) {
  // Presigned URL - React Query caches this for 50 min (staleTime in useAttachmentReadUrl)
  const { data: presignedUrl } = useAttachmentReadUrl(attachment.key);

  // Initialise from cache synchronously so there's no flash of spinner on re-mount
  const [preview, setPreview] = useState<PdfCacheEntry | null>(
    () => pdfPreviewCache.get(attachment.key) ?? null,
  );
  const [renderFailed, setRenderFailed] = useState(false);
  // If the preview is already cached, skip the spinner entirely on first paint
  const [imgLoaded, setImgLoaded] = useState(
    () => !!pdfPreviewCache.get(attachment.key),
  );

  useEffect(() => {
    if (preview || !presignedUrl) return; // already cached, or URL not ready yet
    let cancelled = false;

    async function renderPdf() {
      try {
        // Double-check in case two cards raced to render the same key
        const hit = pdfPreviewCache.get(attachment.key);
        if (hit) {
          setPreview(hit);
          return;
        }

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerPort = getPdfWorkerPort();

        // S3 CORS now allows GET, so PDF.js can fetch the presigned URL directly
        const pdfDoc = await pdfjsLib.getDocument({ url: presignedUrl })
          .promise;
        if (cancelled) return;
        const numPages = pdfDoc.numPages;

        const page = await pdfDoc.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const scale = IMG_MAX / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Render into an offscreen canvas - never mounted in the DOM
        const offscreen = document.createElement("canvas");
        offscreen.width = scaledViewport.width;
        offscreen.height = scaledViewport.height;
        const ctx = offscreen.getContext("2d");
        if (!ctx || cancelled) return;
        await page.render({
          canvas: offscreen,
          canvasContext: ctx,
          viewport: scaledViewport,
        }).promise;
        if (cancelled) return;

        // toBlob is async and encodes off the main thread - avoids blocking
        // the CSS animation right before the preview appears (toDataURL is synchronous).
        const blob = await new Promise<Blob>((resolve, reject) => {
          offscreen.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error("toBlob failed"));
            },
            "image/jpeg",
            0.85,
          );
        });
        if (cancelled) return;

        const dataUrl = URL.createObjectURL(blob);
        const entry: PdfCacheEntry = { dataUrl, numPages };
        pdfPreviewCache.set(attachment.key, entry);
        setPreview(entry);
      } catch (err) {
        logger.warn("[pdf-preview] render failed", err);
        if (!cancelled) setRenderFailed(true);
      }
    }

    void renderPdf();
    return () => {
      cancelled = true;
    };
  }, [attachment.key, preview, presignedUrl]);

  const filename = attachment.filename ?? "document.pdf";
  const sizeStr = attachment.size ? formatFileSize(attachment.size) : null;
  const metaParts = [
    preview
      ? `${preview.numPages} page${preview.numPages === 1 ? "" : "s"}`
      : null,
    "PDF",
    sizeStr,
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      className="mt-1.5 rounded-xl overflow-hidden border border-black/10 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ width: IMG_MAX }}
      onClick={() => presignedUrl && window.open(presignedUrl, "_blank")}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && presignedUrl)
          window.open(presignedUrl, "_blank");
      }}
    >
      {/* Top: first-page preview */}
      <div
        className="bg-muted overflow-hidden relative"
        style={{ height: PDF_PREVIEW_H }}
      >
        {/* Shimmer - shown while image hasn't painted yet */}
        {!imgLoaded && !renderFailed && (
          <div className="absolute inset-0 z-10 skeleton-shimmer" />
        )}

        {/* Error state */}
        {renderFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
            <FileText className="size-8 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground">
              Preview unavailable
            </span>
          </div>
        )}

        {/* Image */}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.dataUrl}
            alt="PDF preview"
            onLoad={() => setImgLoaded(true)}
            style={{ width: "100%", position: "absolute", top: 0, left: 0 }}
          />
        )}
      </div>

      {/* Bottom: filename + metadata */}
      <div className="bg-background/80 border-t border-border px-2.5 py-2 flex items-start gap-2">
        <FileText className="size-4 shrink-0 mt-0.5 text-rose-500" />
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-medium leading-tight text-foreground break-all"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {filename}
          </p>
          {metaParts.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {metaParts.join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Video helpers ─────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VideoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/70 rounded-full p-2 transition-colors cursor-pointer"
      >
        <X className="size-5" />
      </button>
      <video
        src={url}
        controls
        autoPlay
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const VIDEO_H = Math.round(IMG_MAX * (9 / 16)); // 108px - 16:9

function VideoCard({ attachment }: { attachment: Attachment }) {
  const { data: url } = useAttachmentReadUrl(attachment.key);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const filename = attachment.filename ?? "video";
  const sizeStr = attachment.size ? formatFileSize(attachment.size) : null;

  return (
    <>
      {lightboxOpen && url && (
        <VideoLightbox url={url} onClose={() => setLightboxOpen(false)} />
      )}
      <div
        role="button"
        tabIndex={0}
        className="mt-1.5 rounded-xl overflow-hidden border border-black/10 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ width: IMG_MAX }}
        onClick={() => url && setLightboxOpen(true)}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && url) setLightboxOpen(true); }}
      >
        {/* Thumbnail */}
        <div className="bg-muted overflow-hidden relative" style={{ height: VIDEO_H }}>
          {!url ? (
            <div className="absolute inset-0 skeleton-shimmer" />
          ) : (
            <>
              <video
                ref={videoRef}
                src={url}
                preload="metadata"
                muted
                playsInline
                className="w-full h-full object-cover"
                onLoadedMetadata={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  setDuration(v.duration);
                  // seek to first frame so the thumbnail is visible
                  v.currentTime = 0.01;
                }}
              />
              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="size-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-xs">
                  <Play className="size-5 text-white fill-white ml-0.5" />
                </div>
              </div>
              {/* Duration badge */}
              {duration !== null && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-xs">
                  <Video className="size-2.5" />
                  <span>{formatDuration(duration)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom bar */}
        <div className="bg-background/80 border-t border-border px-2.5 py-2 flex items-start gap-2">
          <Video className="size-4 shrink-0 mt-0.5 text-blue-500" />
          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] font-medium leading-tight text-foreground break-all"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {filename}
            </p>
            {sizeStr && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{sizeStr}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Generic attachment display ────────────────────────────────────────────────

function AttachmentDisplay({ attachment }: { attachment: Attachment }) {
  // Route PDFs and videos to dedicated preview cards before calling any hooks
  if (attachment.type === "application/pdf")
    return <PdfPreviewCard attachment={attachment} />;

  if (attachment.type.startsWith("video/"))
    return <VideoCard attachment={attachment} />;

  return <InlineAttachmentDisplay attachment={attachment} />;
}

function InlineAttachmentDisplay({ attachment }: { attachment: Attachment }) {
  const {
    data: url,
    isLoading,
    isError,
  } = useAttachmentReadUrl(attachment.key);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Shimmer must cover BOTH phases: presigned-URL fetch AND the image bytes
  // download. Keying it off `url` alone dropped it the moment the URL arrived,
  // leaving a blank muted box while the image itself still loaded.
  const [imgLoaded, setImgLoaded] = useState(false);
  const isImage = attachment.type.startsWith("image/");

  if (isImage) {
    if (isError) {
      return (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs opacity-60">
          <FileText className="size-3.5 shrink-0" />
          <span>Attachment unavailable</span>
        </div>
      );
    }

    // Compute container size from stored dimensions (available immediately, before URL loads).
    // Falls back to a square when dimensions are unknown (legacy messages).
    const { w, h } =
      attachment.width && attachment.height
        ? imageContainerSize(attachment.width, attachment.height)
        : { w: IMG_MAX, h: IMG_MAX };

    return (
      <>
        {lightboxOpen && url && (
          <ImageLightbox url={url} onClose={() => setLightboxOpen(false)} />
        )}
        <button
          type="button"
          onClick={() => {
            if (url) setLightboxOpen(true);
          }}
          className="mt-1.5 block cursor-pointer"
          disabled={!url}
        >
          <div
            style={{ width: w, height: h }}
            className="relative rounded-lg overflow-hidden bg-muted"
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="attachment"
                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                // Cached images can be `complete` before React attaches
                // onLoad; the ref callback catches that (same pattern as
                // ProductImageCarousel / HoverImageCycler).
                ref={(img) => {
                  if (img?.complete && img.naturalWidth > 0) setImgLoaded(true);
                }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgLoaded(true)}
              />
            )}
            {!imgLoaded && (
              <div className="absolute inset-0 z-10 skeleton-shimmer" />
            )}
          </div>
        </button>
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-1.5 h-10 w-32 rounded-lg bg-black/10 animate-pulse" />
    );
  }

  if (isError || !url) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-xs opacity-60">
        <FileText className="size-3.5 shrink-0" />
        <span>Attachment unavailable</span>
      </div>
    );
  }

  const displayName =
    attachment.filename ?? attachment.key.split("/").pop() ?? "file";
  const label = attachment.type.startsWith("video/") ? "Video" : "File";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-1.5 text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
    >
      <FileText className="size-3.5 shrink-0" />
      <span>
        {label}: {displayName}
      </span>
    </a>
  );
}

// ── File preview chip ─────────────────────────────────────────────────────────

function FileChip({
  file,
  progress,
  status,
  onRemove,
}: {
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoThumbRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isImage && !isVideo) return;
    const url = URL.createObjectURL(file);
    let active = true;
    queueMicrotask(() => { if (active) setPreviewUrl(url); });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file, isImage, isVideo]);

  return (
    <div className="relative shrink-0 group">
      <div
        className={cn(
          "relative size-14 rounded-lg overflow-hidden",
          status === "error" && "ring-1 ring-destructive",
        )}
      >
        {previewUrl && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file.name}
            className="size-14 rounded-lg object-cover border border-border"
          />
        ) : previewUrl && isVideo ? (
          <div className="size-14 rounded-lg overflow-hidden border border-border relative bg-black">
            <video
              ref={videoThumbRef}
              src={previewUrl}
              muted
              playsInline
              className="size-14 object-cover"
              onLoadedMetadata={() => {
                if (videoThumbRef.current) videoThumbRef.current.currentTime = 0.01;
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="size-4 text-white fill-white drop-shadow" />
            </div>
          </div>
        ) : (
          <div className="size-14 rounded-lg border border-border bg-muted flex flex-col justify-center gap-0.5 px-1.5 py-1.5">
            <div className="flex items-center gap-1">
              <FileText className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-[9px] font-semibold text-muted-foreground leading-tight">
                {file.name.split(".").pop()?.toUpperCase()}
              </span>
            </div>
            <span
              className="text-[8px] text-muted-foreground leading-tight break-all"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {file.name}
            </span>
          </div>
        )}

        {status === "uploading" && (
          <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
            <X className="size-4 text-destructive" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    img.src = url;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadOne(
  file: File,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<{ key: string; dims?: { width: number; height: number } }> {
  const [{ data }, dims] = await Promise.all([
    axios.post<{ key: string; url: string }>(
      "/api/chat/attachments/upload-url",
      { contentType: file.type, size: file.size },
      { signal },
    ),
    file.type.startsWith("image/")
      ? readImageDimensions(file).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  // Tagging is encoded into the presigned URL as an `x-amz-tagging` query
  // parameter (hoisted by the SDK, not a signed header) - we must NOT also
  // send it as an HTTP header or S3 rejects the signature.
  await axios.put(data.url, file, {
    headers: { "Content-Type": file.type },
    signal,
    onUploadProgress: (e) => {
      if (!e.total) return;
      // Cap S3 progress at 90 so the bar always has a final jump to 100
      // when the PUT resolves - keeps motion perceivable even on tiny
      // uploads where onUploadProgress fires only once or twice.
      const ratio = e.loaded / e.total;
      onProgress(Math.min(90, Math.round(ratio * 90)));
    },
  });
  return { key: data.key, dims };
}

export function MessageThread({
  conversationId,
  messages,
  currentUserId,
  isLoading,
  profiles = {},
  onSend,
  onMarkRead,
}: Props) {
  const [text, setText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Keep a ref in sync so handleFileChange can read the current length
  // without recreating itself on every state change.
  const pendingRef = useRef<PendingAttachment[]>([]);
  useEffect(() => {
    pendingRef.current = pendingAttachments;
  }, [pendingAttachments]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markedRef = useRef(new Set<string>());
  const pinnedToBottom = useRef(true);
  const [floatingDate, setFloatingDate] = useState<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const { reactions, toggle: toggleReaction } = useReactions(conversationId);

  // Close reaction picker on outside click
  useEffect(() => {
    if (!pickerOpenFor) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-reaction-picker]")) setPickerOpenFor(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpenFor]);

  // Jump to the actual bottom of the scroll container.
  // Images use a fixed-size container (w-48 h-48) for both loading and loaded
  // states, so scrollHeight is already the final value when this fires.
  const jumpToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, []);

  // Whenever new messages arrive: pin to bottom and jump.
  useEffect(() => {
    pinnedToBottom.current = true;
    jumpToBottom();
  }, [messages.length, jumpToBottom]);

  // When reactions change (badge appears/disappears), maintain scroll position if pinned.
  useEffect(() => {
    if (pinnedToBottom.current) jumpToBottom();
  }, [reactions, jumpToBottom]);

  useEffect(() => {
    const unread = messages
      .filter(
        (m) =>
          m.senderId !== currentUserId &&
          !(m.readBy ?? []).includes(currentUserId),
      )
      .map((m) => m.sk ?? `MSG#${m.createdAt}#${m.messageId}`)
      .filter((sk) => !markedRef.current.has(sk));

    if (unread.length > 0) {
      unread.forEach((sk) => markedRef.current.add(sk));
      onMarkRead(unread);
    }
  }, [messages, currentUserId, onMarkRead]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    pinnedToBottom.current = distanceFromBottom < 50;
    setShowScrollBtn(distanceFromBottom > 60);

    const containerTop = container.getBoundingClientRect().top;
    const msgEls = container.querySelectorAll<HTMLElement>("[data-msg-date]");
    let topDate: string | null = null;
    for (const el of msgEls) {
      if (el.getBoundingClientRect().top >= containerTop - 4) {
        topDate = el.dataset.msgDate ?? null;
        break;
      }
    }
    if (topDate) setFloatingDate(formatDateSeparator(new Date(topDate)));
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setFloatingDate(null), 1500);
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      e.target.value = "";
      setUploadError(null);

      if (selected.some((f) => !ALLOWED_TYPES.includes(f.type))) {
        setUploadError("Unsupported file type.");
        return;
      }
      if (selected.some((f) => f.size > MAX_SIZE)) {
        setUploadError("Each file must be under 20 MB.");
        return;
      }
      if (pendingRef.current.length + selected.length > MAX_FILES) {
        setUploadError(`Max ${MAX_FILES} files per message.`);
        return;
      }

      const newItems: PendingAttachment[] = selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 5,
        status: "uploading",
        abort: new AbortController(),
      }));
      setPendingAttachments((prev) => [...prev, ...newItems]);

      // Fire off each upload independently - they share no order requirement
      // and S3 handles parallel PUTs fine. Per-item state updates keep
      // progress, completion, and errors local to each chip.
      newItems.forEach((item) => {
        const signal = item.abort!.signal;
        void uploadOne(item.file, signal, (percent) => {
          setPendingAttachments((prev) =>
            prev.map((a) => (a.id === item.id ? { ...a, progress: percent } : a)),
          );
        })
          .then(({ key, dims }) => {
            setPendingAttachments((prev) =>
              prev.map((a) =>
                a.id === item.id
                  ? { ...a, key, ...dims, progress: 100, status: "done" }
                  : a,
              ),
            );
          })
          .catch((err) => {
            // Cancellation is a normal flow (user removed before completion).
            if (signal.aborted || err?.name === "CanceledError") return;
            logger.error("[chat upload]", err);
            setPendingAttachments((prev) =>
              prev.map((a) =>
                a.id === item.id ? { ...a, status: "error" } : a,
              ),
            );
          });
      });
    },
    [],
  );

  const removeFile = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.status === "uploading") item.abort?.abort();
      // For already-uploaded items we rely on the bucket lifecycle rule to
      // sweep the orphan after 24h - explicit S3 delete would need an extra
      // server endpoint and a round-trip per removal.
      return prev.filter((a) => a.id !== id);
    });
    setUploadError(null);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = applyEmojiShortcodes(text.trim());
    const done = pendingAttachments.filter((a) => a.status === "done");
    if (!trimmed && done.length === 0) return;

    const attachments: Attachment[] = done.map((a) => ({
      key: a.key!,
      type: a.file.type,
      filename: a.file.name,
      size: a.file.size,
      width: a.width,
      height: a.height,
    }));
    onSend(trimmed, attachments);
    playSendSound();
    setText("");
    setPendingAttachments([]);
    setUploadError(null);
  }, [text, pendingAttachments, onSend]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      const pos = e.target.selectionStart ?? newText.length;
      const before = newText.slice(0, pos);
      const sep = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n"));
      const word = before.slice(sep + 1);

      if (isCompleteShortcode(word)) {
        const emoji = EMOJI_SHORTCUTS[word];
        const prefix = before.slice(0, sep + 1);
        const replaced = prefix + emoji + newText.slice(pos);
        setText(replaced);
        const newPos = prefix.length + emoji.length;
        const el = e.target;
        requestAnimationFrame(() => el.setSelectionRange(newPos, newPos));
        return;
      }
      setText(newText);
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const hasUploading = pendingAttachments.some((a) => a.status === "uploading");
  const hasDone = pendingAttachments.some((a) => a.status === "done");
  const canSend =
    !hasUploading && (text.trim().length > 0 || hasDone);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn("flex gap-2", i % 2 === 0 ? "" : "flex-row-reverse")}
          >
            <Skeleton className="size-7 rounded-full shrink-0" />
            <Skeleton
              className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-36")}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages + scroll-to-bottom button */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-2 chat-message-bg"
        >
          {/* Floating date badge */}
          <div className="sticky top-3 z-10 h-0 overflow-visible flex items-start justify-center pointer-events-none">
            <span
              className={cn(
                "inline-flex items-center bg-black/50 text-white text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-xs transition-opacity duration-200 whitespace-nowrap",
                floatingDate ? "opacity-100" : "opacity-0",
              )}
            >
              {floatingDate ?? ""}
            </span>
          </div>

          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No messages yet. Say hello!
            </div>
          )}

          {[...messages].reverse().map((msg, index, arr) => {
            const isMine = msg.senderId === currentUserId;
            const readBy = msg.readBy ?? [];
            const senderProfile = profiles[msg.senderId];
            const senderInitials = getInitials(
              senderProfile?.name,
              msg.senderId,
            );
            const msgDate = new Date(msg.createdAt);
            const prevMsg = arr[index - 1];
            const showDateSeparator =
              !prevMsg ||
              format(new Date(prevMsg.createdAt), "yyyy-MM-dd") !==
                format(msgDate, "yyyy-MM-dd");

            const msgReactions = reactions[msg.messageId] ?? {};
            const hasAnyReaction = Object.keys(msgReactions).length > 0;
            const isTemp = msg.messageId.startsWith("temp-");

            return (
              <div
                key={msg.messageId}
                data-msg-date={format(msgDate, "yyyy-MM-dd")}
              >
                {showDateSeparator && (
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                      {formatDateSeparator(msgDate)}
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                )}
                <div
                  className={cn(
                    "flex gap-2 items-end group/msg",
                    isMine && "flex-row-reverse",
                  )}
                >
                  {!isMine && (
                    <>
                      {senderProfile?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={senderProfile.imageUrl}
                          alt={senderProfile.name ?? ""}
                          className="size-7 rounded-full shrink-0 object-cover mb-0.5"
                        />
                      ) : (
                        <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                          {senderInitials}
                        </div>
                      )}
                    </>
                  )}

                  <div
                    className={cn(
                      "flex flex-col gap-1 max-w-[75%]",
                      isMine && "items-end",
                    )}
                  >
                    {/* Message bubble + reaction trigger */}
                    <div className={cn("flex items-end gap-1.5", isMine && "flex-row-reverse")}>
                      <div className="flex flex-col">
                        {!msg.attachments?.length && isEmojiOnly(msg.text ?? "") ? (
                          <p className="text-4xl leading-none py-0.5 select-text">
                            {msg.text}
                          </p>
                        ) : (
                          <div
                            className={cn(
                              "px-3 py-2 rounded-2xl text-sm leading-snug wrap-break-word",
                              isMine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm",
                            )}
                          >
                            {msg.text && <p>{msg.text}</p>}
                            {msg.attachments?.map((att) => (
                              <AttachmentDisplay key={att.key} attachment={att} />
                            ))}
                          </div>
                        )}

                        {/* Reaction badges */}
                        {hasAnyReaction && (
                          <div className={cn("flex flex-wrap gap-1 mt-1", isMine && "justify-end")}>
                            {Object.entries(msgReactions).map(([emoji, userIds]) => {
                              const iReacted = userIds.includes(currentUserId);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => !isTemp && toggleReaction(msg.messageId, emoji, msg.text ?? "", currentUserId)}
                                  className={cn(
                                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors cursor-pointer",
                                    iReacted
                                      ? "bg-primary/10 border-primary/30 text-primary"
                                      : "bg-background border-border text-foreground hover:bg-muted",
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-medium">{userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Reaction trigger button - visible on hover */}
                      {!isTemp && (
                        <div className="relative mb-0.5" data-reaction-picker>
                          <button
                            type="button"
                            onClick={() =>
                              setPickerOpenFor((prev) =>
                                prev === msg.messageId ? null : msg.messageId
                              )
                            }
                            className={cn(
                              "size-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-all cursor-pointer",
                              pickerOpenFor === msg.messageId
                                ? "opacity-100"
                                : "opacity-0 group-hover/msg:opacity-100",
                            )}
                          >
                            <Smile className="size-3.5" />
                          </button>

                          {/* Emoji picker popover - JS-clamped to stay
                              inside the chat scroll container regardless of
                              where the message bubble sits. Without this,
                              wide bubbles push the picker past the drawer
                              edge and trigger horizontal scroll. */}
                          {pickerOpenFor === msg.messageId && (
                            <div
                              ref={(el) => {
                                if (!el || !scrollRef.current) return;
                                const parent = el.parentElement;
                                if (!parent) return;
                                const parentRect =
                                  parent.getBoundingClientRect();
                                const scrollRect =
                                  scrollRef.current.getBoundingClientRect();
                                const popupWidth = el.offsetWidth;
                                const PAD = 8;
                                const buttonCenter =
                                  parentRect.left + parentRect.width / 2;
                                let desiredLeft =
                                  buttonCenter - popupWidth / 2;
                                desiredLeft = Math.max(
                                  scrollRect.left + PAD,
                                  Math.min(
                                    desiredLeft,
                                    scrollRect.right - popupWidth - PAD,
                                  ),
                                );
                                el.style.left = `${desiredLeft - parentRect.left}px`;
                              }}
                              className="absolute bottom-full mb-1 z-20 flex gap-1 bg-background border border-border rounded-full px-2 py-1.5 shadow-lg"
                            >
                              {REACTION_EMOJIS.map((emoji) => {
                                const iReacted = (msgReactions[emoji] ?? []).includes(currentUserId);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      toggleReaction(msg.messageId, emoji, msg.text ?? "", currentUserId);
                                      setPickerOpenFor(null);
                                    }}
                                    className={cn(
                                      "text-base w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer hover:scale-125",
                                      iReacted && "bg-primary/10",
                                    )}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.createdAt), "HH:mm")}
                      </span>
                      {isMine &&
                        (isTemp ? (
                          <Clock className="size-3 text-muted-foreground" />
                        ) : readBy.some((id) => id !== currentUserId) ? (
                          <CheckCheck className="size-3 text-sky-500" />
                        ) : (
                          <Check className="size-3 text-muted-foreground" />
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom button */}
        <button
          type="button"
          onClick={() => {
            jumpToBottom();
            setShowScrollBtn(false);
          }}
          className={cn(
            "absolute bottom-4 right-4 z-10 size-8 rounded-full bg-background border shadow-md flex items-center justify-center hover:bg-muted cursor-pointer transition-all duration-200",
            showScrollBtn
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none",
          )}
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t relative">
        {/* File preview panel - absolutely positioned so it doesn't affect layout */}
        <div
          className={cn(
            "absolute bottom-full inset-x-2 bg-background border border-border rounded-t-xl shadow-md px-3 pt-3 pb-2 flex gap-2 flex-wrap transition-all duration-200 ease-out",
            pendingAttachments.length > 0
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-1 pointer-events-none",
          )}
        >
          {pendingAttachments.map((att) => (
            <FileChip
              key={att.id}
              file={att.file}
              progress={att.progress}
              status={att.status}
              onRemove={() => removeFile(att.id)}
            />
          ))}
        </div>

        {uploadError && (
          <p className="px-3 pt-2 text-xs text-destructive">{uploadError}</p>
        )}

        <div className="p-3 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileChange}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={pendingAttachments.length >= MAX_FILES}
          >
            <Paperclip className="size-4" />
          </Button>

          <Textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            className="min-h-9 max-h-32 resize-none text-sm"
            rows={1}
          />

          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!canSend}
            className="shrink-0"
          >
            {hasUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
