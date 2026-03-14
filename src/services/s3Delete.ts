import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "./s3";

export async function deleteS3Object(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );
}
