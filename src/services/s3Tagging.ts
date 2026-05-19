import {
  PutObjectTaggingCommand,
  DeleteObjectTaggingCommand,
} from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "./s3";
import { toThumbKey } from "./s3Copy";

// Objects with this tag are deleted by the bucket lifecycle rule after 24h.
// Removing the tag (commitS3Object) makes the object permanent.
export const PENDING_TAG_KEY = "lifecycle";
export const PENDING_TAG_VALUE = "pending";

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
 * Thumbnail tagging is best-effort — the original is authoritative.
 */
export async function tagProductImagePending(key: string): Promise<void> {
  await tagS3ObjectPending(key);
  await tagS3ObjectPending(toThumbKey(key)).catch(() => {});
}

/**
 * Commits a product image (original + thumbnail) — removes the pending tag
 * so the lifecycle rule no longer applies. Called when a product is saved
 * and the image becomes a real DB reference.
 */
export async function commitProductImage(key: string): Promise<void> {
  await commitS3Object(key);
  await commitS3Object(toThumbKey(key)).catch(() => {});
}