import { s3, S3_BUCKET } from "./s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { ImageInput, ImageProcessingResult } from "@/types/types";
import { ImageProcessorError } from "@/features/common/errors/domainErrors";
import { tagS3ObjectPending } from "./s3Tagging";
import { PENDING_TAG_HEADER_VALUE } from "@/constants/constants";

export async function processImage({
  key,
}: ImageInput): Promise<ImageProcessingResult> {
  if (!key) throw new ImageProcessorError("Missing key for image processing");

  try {
    // Defense-in-depth: the presigned PUT already tagged the original with
    // x-amz-tagging on upload, but we re-apply here in case that header was
    // ever stripped (proxy, misconfigured client) or the tag was somehow
    // cleared between upload and process. Idempotent — same tag value.
    await tagS3ObjectPending(key);

    const object = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );

    if (!object.Body) {
      throw new ImageProcessorError("S3 object body is empty");
    }

    const buffer = await streamToBuffer(object.Body);

    const thumbBuffer: Buffer = await sharp(buffer)
      .resize(300, 300, { fit: "cover" })
      .toFormat("webp")
      .toBuffer();

    const thumbKey: string =
      key.replace("/products/", "/products/thumbs/") + ".webp";

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: "image/webp",
        Tagging: PENDING_TAG_HEADER_VALUE,
      }),
    );

    const originalGetCommand = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    const originalDownloadUrl = await getSignedUrl(s3, originalGetCommand, {
      expiresIn: 3600,
    });

    const thumbGetCommand = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: thumbKey,
    });
    const thumbnailDownloadUrl = await getSignedUrl(s3, thumbGetCommand, {
      expiresIn: 3600,
    });

    return {
      key,
      thumbKey,
      originalDownloadUrl,
      thumbnailDownloadUrl,
    };
  } catch (err) {
    if (err instanceof Error) {
      throw new ImageProcessorError(err.message);
    }
    throw new ImageProcessorError("Unknown error during image processing");
  }
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  if (stream instanceof Buffer) {
    return stream;
  }

  if (typeof (stream as NodeJS.ReadableStream).pipe === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as NodeJS.ReadableStream) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks);
  }

  throw new ImageProcessorError("Unsupported S3 Body type");
}
