import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "./s3";
import { randomUUID } from "crypto";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_FILE_SIZE,
  MAX_VIDEO_SIZE,
  PENDING_TAG_HEADER_VALUE,
} from "@/constants/constants";
import { ImageProcessorError } from "@/features/common/errors/domainErrors";

export async function createPresignedUploadUrl(
  organizationId: string,
  contentType: string,
  size: number,
) {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new ImageProcessorError("Invalid file type");
  }
  if (size > MAX_FILE_SIZE) {
    throw new ImageProcessorError("File too large");
  }

  const key = `orgs/${organizationId}/products/${randomUUID()}`;

  const putCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Tagging: PENDING_TAG_HEADER_VALUE,
  });
  const url = await getSignedUrl(s3, putCommand, { expiresIn: 600 });

  return { key, url };
}

export async function createPresignedVideoUploadUrl(
  organizationId: string,
  contentType: string,
  size: number,
) {
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    throw new ImageProcessorError("Invalid video type");
  }
  if (size > MAX_VIDEO_SIZE) {
    throw new ImageProcessorError("Video too large");
  }

  const key = `orgs/${organizationId}/products/videos/${randomUUID()}`;

  const putCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Tagging: PENDING_TAG_HEADER_VALUE,
  });
  // Videos can be larger than images, so allow a longer client upload window.
  const url = await getSignedUrl(s3, putCommand, { expiresIn: 1800 });

  return { key, url };
}
