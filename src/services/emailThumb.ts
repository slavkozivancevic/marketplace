import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { s3, S3_BUCKET } from "./s3";
import { toThumbKey, toEmailThumbKey } from "./s3Copy";
import { env } from "@/env/server";

// Product thumbnails are stored as WebP (see imageProcessor.ts). Most email
// clients (Gmail, Outlook, Apple Mail) won't render WebP and show a broken/empty
// frame, so for emails we derive an 80x80 JPEG once and host it publicly on S3,
// then reuse it for every later email. (Data-URIs are not an option - Gmail
// strips inline base64 images.) The key is derived via the shared
// `toEmailThumbKey` so the product delete paths can clean the derivative up.

async function s3GetBuffer(key: string): Promise<Buffer | null> {
  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
    const bytes = await obj.Body!.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

async function s3Exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a public, email-renderable (JPEG) thumbnail URL for a product/variant
 * image, generating and caching it in S3 on first use. The derivative is stored
 * untagged (permanent, public) so it survives the pending-asset lifecycle sweep.
 *
 * Best-effort: on any fetch/decode/upload failure it falls back to the original
 * image URL (often already JPEG/PNG), or null - a bad asset never blocks the
 * email from being sent.
 */
export async function getEmailThumbUrl(
  key: string | null,
  thumbKey: string | null,
  fallbackUrl: string | null,
): Promise<string | null> {
  const webpKey = thumbKey ?? (key ? toThumbKey(key) : null);
  // Prefer deriving from the small webp thumb; fall back to the original key
  // (older products may not have a generated thumbnail object).
  const candidateKeys = [webpKey, key].filter((k): k is string => !!k);
  if (candidateKeys.length === 0) return fallbackUrl;

  // Deterministic cache key, identical to what the product delete paths compute,
  // so the derivative is cleaned up with the rest of the media.
  const emailKey = key
    ? toEmailThumbKey(key, thumbKey)
    : webpKey!.replace(/\.webp$/i, "") + ".email.jpg";
  const publicUrl = `${env.S3_PUBLIC_URL}/${emailKey}`;

  if (await s3Exists(emailKey)) return publicUrl;

  for (const k of candidateKeys) {
    const buf = await s3GetBuffer(k);
    if (!buf) continue;
    try {
      const jpeg = await sharp(buf)
        .resize(80, 80, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: emailKey,
          Body: jpeg,
          ContentType: "image/jpeg",
        }),
      );
      return publicUrl;
    } catch {
      // Try the next candidate (e.g. webp thumb missing -> use the original).
    }
  }
  return fallbackUrl;
}