import {
  PutObjectTaggingCommand,
  DeleteObjectTaggingCommand,
} from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "./s3";
import { toThumbKey } from "./s3Copy";
import { PENDING_TAG_KEY, PENDING_TAG_VALUE } from "@/constants/constants";

// Objects with this tag are deleted by the bucket lifecycle rule after 24h.
// Removing the tag (commitS3Object) makes the object permanent.

export async function tagS3ObjectPending(key: string): Promise<void> {
  await s3.send(
    new PutObjectTaggingCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Tagging: {
        TagSet: [{ Key: PENDING_TAG_KEY, Value: PENDING_TAG_VALUE }],
      },
    }),
  );
}

export async function commitS3Object(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectTaggingCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );
}

/**
 * Marks a freshly uploaded product image (original + thumbnail) as pending.
 * The lifecycle rule will sweep both after 24h unless committed first.
 * Thumbnail tagging is best-effort - the original is authoritative.
 */
export async function tagProductImagePending(key: string): Promise<void> {
  await tagS3ObjectPending(key);
  await tagS3ObjectPending(toThumbKey(key)).catch(() => {});
}

/**
 * Marks a freshly uploaded product media item as pending. For images this
 * tags the original + the derived thumbnail key. For videos the caller passes
 * the explicit poster key returned by the video processor.
 */
export async function tagProductMediaPending(
  key: string,
  thumbKey?: string | null,
): Promise<void> {
  await tagS3ObjectPending(key);
  if (thumbKey) {
    await tagS3ObjectPending(thumbKey).catch(() => {});
  } else {
    await tagS3ObjectPending(toThumbKey(key)).catch(() => {});
  }
}

/**
 * Commits a product media item - removes the pending tag so the lifecycle rule
 * no longer applies. Called when the product is saved and the media becomes
 * a real DB reference. Thumbnail/poster commit is best-effort.
 */
export async function commitProductMedia(
  key: string,
  thumbKey?: string | null,
): Promise<void> {
  await commitS3Object(key);
  if (thumbKey) {
    await commitS3Object(thumbKey).catch(() => {});
  } else {
    await commitS3Object(toThumbKey(key)).catch(() => {});
  }
}

/** @deprecated Use {@link commitProductMedia}. Kept temporarily for callers mid-rename. */
export async function commitProductImage(key: string): Promise<void> {
  await commitProductMedia(key);
}