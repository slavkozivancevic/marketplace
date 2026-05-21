import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/env/server";

export const s3 = new S3Client({
  region: env.AWS_REGION!,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
  // AWS SDK v3.730+ auto-adds x-amz-checksum-crc32 to every PutObject. For
  // presigned URLs the SDK computes this against an empty body (no payload at
  // sign time), so the placeholder ends up in the URL. S3 then rejects the
  // PUT with 403 because the real upload's CRC32 doesn't match the placeholder.
  // WHEN_REQUIRED only adds the checksum if the caller asked for one.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const S3_BUCKET = env.S3_BUCKET_NAME!;
