import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "./s3";
import { randomUUID } from "crypto";
import { ALLOWED_TYPES, MAX_FILE_SIZE } from "@/constants/constants";
import { ImageProcessorError } from "@/features/common/errors/domainErrors";
import { PresignedUpload } from "@/types/types";

export async function createPresignedUploadUrl(
  organizationId: string,
  contentType: string,
  size: number,
): Promise<PresignedUpload> {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ImageProcessorError("Invalid file type");
  }

  if (size > MAX_FILE_SIZE) {
    throw new ImageProcessorError("File too large");
  }

  const key = `orgs/${organizationId}/products/${randomUUID()}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 600 });

  return { url, key };
}
