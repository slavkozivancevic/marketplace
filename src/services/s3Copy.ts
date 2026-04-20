import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "./s3";

/**
 * Copies an S3 object from sourceKey to destinationKey within the same bucket.
 * This is a pure server-side copy — no bytes leave AWS, no re-upload.
 */
export async function copyS3Object(
  sourceKey: string,
  destinationKey: string,
): Promise<void> {
  await s3.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${sourceKey}`,
      Key: destinationKey,
    }),
  );
}

/**
 * Derives the thumbnail S3 key from a product image key.
 * Original: orgs/{org}/products/{uuid}
 * Thumb:    orgs/{org}/products/thumbs/{uuid}.webp
 */
export function toThumbKey(originalKey: string): string {
  return originalKey.replace("/products/", "/products/thumbs/") + ".webp";
}

/**
 * Copies both the original image and its thumbnail to new keys.
 * Thumbnail copy errors are silently swallowed — the original is authoritative.
 *
 * @returns The new original key.
 */
export async function copyProductImage(
  sourceKey: string,
  destinationKey: string,
): Promise<void> {
  await copyS3Object(sourceKey, destinationKey);

  const sourceThumbKey = toThumbKey(sourceKey);
  const destThumbKey = toThumbKey(destinationKey);

  // Thumbnail may not exist for older products — swallow the error.
  await copyS3Object(sourceThumbKey, destThumbKey).catch(() => {});
}