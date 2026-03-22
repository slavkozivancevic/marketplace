import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "./s3";
import { randomUUID } from "crypto";
import { ALLOWED_TYPES, MAX_FILE_SIZE } from "@/constants/constants";
import { ImageProcessorError } from "@/features/common/errors/domainErrors";

export async function createPresignedUploadUrl(organizationId: string, contentType: string, size: number) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ImageProcessorError("Invalid file type");
  }
  if (size > MAX_FILE_SIZE) {
    throw new ImageProcessorError("File too large");
  }

  const key = `orgs/${organizationId}/products/${randomUUID()}`;

  // PUT URL za upload
  const putCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3, putCommand, { expiresIn: 600 });

  // // GET URL za prikaz
  // const getCommand = new GetObjectCommand({
  //   Bucket: S3_BUCKET,
  //   Key: key,
  // });
  // const downloadUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });

  return { key, url };
  // return { key, url, downloadUrl };
}