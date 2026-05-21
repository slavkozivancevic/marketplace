export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
export const ALLOWED_MEDIA_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
]);

// Back-compat alias for any remaining `ALLOWED_TYPES` callers — points at the
// image set only, since those callers were image-specific.
export const ALLOWED_TYPES = ALLOWED_IMAGE_TYPES;

export const MAX_FILES = 10;

export const IMAGE_ZOOM_FACTOR = 2.5;
export const IMAGE_ZOOM_LENS_SIZE = 180;

// S3 object tag used by the bucket lifecycle rule to sweep abandoned uploads
// after 24h. Shared between server (presigned URL + processors) and client
// (PUT header) so the value is signed and verified end-to-end.
export const PENDING_TAG_KEY = "lifecycle";
export const PENDING_TAG_VALUE = "pending";
export const PENDING_TAG_HEADER_VALUE = `${PENDING_TAG_KEY}=${PENDING_TAG_VALUE}`;