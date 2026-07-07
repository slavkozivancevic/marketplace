import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/env/server";

export const s3 = new S3Client({
  region: env.AWS_REGION!,
  // Do NOT pass explicit `credentials` here. On Lambda the execution role hands
  // out *temporary* (ASIA...) STS credentials via env vars, and those are only
  // valid when the accompanying AWS_SESSION_TOKEN travels with the request. The
  // old explicit `{ accessKeyId, secretAccessKey }` block dropped the session
  // token, so presigned upload URLs came out without X-Amz-Security-Token and
  // S3 rejected the browser PUT with 403. Letting the default credential
  // provider chain resolve credentials picks up all three env vars (incl. the
  // session token) on Lambda, and still reads AWS_ACCESS_KEY_ID/SECRET locally.
  // AWS SDK v3.730+ auto-adds x-amz-checksum-crc32 to every PutObject. For
  // presigned URLs the SDK computes this against an empty body (no payload at
  // sign time), so the placeholder ends up in the URL. S3 then rejects the
  // PUT with 403 because the real upload's CRC32 doesn't match the placeholder.
  // WHEN_REQUIRED only adds the checksum if the caller asked for one.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const S3_BUCKET = env.S3_BUCKET_NAME!;
